#!/usr/bin/env node
/**
 * OTT Bot Cup runner (plan §3.2, §9.2): pulls jobs from the Bot Cup API over outbound HTTPS and runs them in the
 * container sandbox on this machine.
 *
 *   BOT_CUP_RUNNER_URL=https://ottv2-bot-cup-api-staging.<account>.workers.dev \
 *   BOT_CUP_RUNNER_TOKEN_FILE=var/bot-cup/runner-token.txt \
 *   ARENA_RUNNER_IMAGE_ID=sha256:8e3ea65c… \
 *   npm run bot-cup:runner
 *
 * Environment:
 *   BOT_CUP_RUNNER_URL          Worker origin (required)
 *   BOT_CUP_RUNNER_TOKEN        bearer token, or BOT_CUP_RUNNER_TOKEN_FILE (a file keeps it out of shell history)
 *   ARENA_RUNNER_IMAGE_ID       image ID the sandbox must run (required; `docker inspect --format {{.Id}} <image>`)
 *   ARENA_RUNNER_IMAGE          image name (default ottv2-arena-runner:local)
 *   BOT_CUP_RUNNER_SLOTS        games at once (default 4; P0 found more than 4 makes the clocks unfair on Docker Desktop)
 *   BOT_CUP_RUNNER_POLL_MS      idle poll interval (default 15000)
 *   BOT_CUP_RUNNER_ONCE         "true": stop when the queue is empty (rehearsals and evidence runs)
 *   BOT_CUP_RUNNER_SIMULATE     "true": showcase events only (src/simulate.mjs). Games are played in this process by the
 *                               in-game AI at each synthetic team's strength; no container, no image ID. Refused unless
 *                               the URL is the showcase Worker or localhost.
 *   BOT_CUP_PROBE_DIR           secret position sets for behaviour fingerprints (default var/bot-cup/probe-sets; never in
 *                               git; `node scripts/bot-cup/probe-positions.mjs` writes one). A probe job names its set by
 *                               the SHA-256 of the file; a runner without that file reports an infrastructure error.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseProbeSet } from "../../../packages/bot-cup-core/src/index.mjs";
import { createArtifactStore } from "../../../packages/arena-node/src/artifacts/artifact-store.mjs";
import { probeContainerRuntime, PINNED_RUNNER_IMAGE } from "../../../packages/arena-node/src/execution/container-executor.mjs";
import { createRunnerClient } from "./client.mjs";
import { createExecutor, warmUpContainer } from "./executor.mjs";
import { houseBotSources } from "./house-bots.mjs";
import { createRunner } from "./runner.mjs";
import { createSimulatedExecutor } from "./simulate.mjs";

const VERSION = "bot-cup-runner/1";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function log(event, fields = {}) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), event, ...fields })}\n`);
}

/** Where a simulated runner may pull work: Workers of synthetic events, or a local dev Worker. */
export const SIMULATE_URL = /^(https:\/\/ottv2-bot-cup-api-showcase\.[\w-]+\.workers\.dev|http:\/\/(localhost|127\.0\.0\.1):\d+)\/?$/;

export function readConfig(env = process.env) {
  const token = env.BOT_CUP_RUNNER_TOKEN || (env.BOT_CUP_RUNNER_TOKEN_FILE ? fs.readFileSync(env.BOT_CUP_RUNNER_TOKEN_FILE, "utf8").trim() : "");
  const simulate = env.BOT_CUP_RUNNER_SIMULATE === "true";
  const missing = [];
  if (!env.BOT_CUP_RUNNER_URL) missing.push("BOT_CUP_RUNNER_URL");
  if (!token) missing.push("BOT_CUP_RUNNER_TOKEN or BOT_CUP_RUNNER_TOKEN_FILE");
  if (!env.ARENA_RUNNER_IMAGE_ID && !simulate) missing.push("ARENA_RUNNER_IMAGE_ID");
  if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
  if (simulate && !SIMULATE_URL.test(env.BOT_CUP_RUNNER_URL)) throw new Error("BOT_CUP_RUNNER_SIMULATE only runs against the showcase Worker or localhost");
  const slots = Number(env.BOT_CUP_RUNNER_SLOTS || 4);
  if (!Number.isInteger(slots) || slots < 1 || slots > 8) throw new Error("BOT_CUP_RUNNER_SLOTS must be 1..8");
  return {
    url: env.BOT_CUP_RUNNER_URL,
    token,
    image: env.ARENA_RUNNER_IMAGE || PINNED_RUNNER_IMAGE,
    imageId: env.ARENA_RUNNER_IMAGE_ID,
    slots,
    pollMs: Number(env.BOT_CUP_RUNNER_POLL_MS || 15_000),
    once: env.BOT_CUP_RUNNER_ONCE === "true",
    simulate,
    probeDir: env.BOT_CUP_PROBE_DIR || path.join(ROOT, "var/bot-cup/probe-sets")
  };
}

/** Secret sets by the SHA-256 of their file. */
export function loadProbeSets(dir) {
  const sets = new Map();
  if (!fs.existsSync(dir)) return sets;
  for (const name of fs.readdirSync(dir).filter((file) => file.endsWith(".json")).sort()) {
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    sets.set(crypto.createHash("sha256").update(text).digest("hex"), parseProbeSet(text));
  }
  return sets;
}

/** Showcase mode: no Docker at all; the image ID reported is a marker the showcase Worker does not check. */
async function simulated(config) {
  log("simulate", { url: config.url, slots: config.slots });
  const client = createRunnerClient({ baseUrl: config.url, token: config.token });
  return createRunner({
    client,
    executor: createSimulatedExecutor({ fetchSource: (sha256) => client.source(sha256) }),
    slots: config.slots,
    pollMs: config.once ? 2_000 : config.pollMs,
    info: { version: `${VERSION}+simulated`, imageId: "simulated", host: os.hostname() },
    log
  });
}

async function main() {
  const config = readConfig();
  const runner = config.simulate ? await simulated(config) : await containerRunner(config);
  let stopping = false;
  const stop = async (signal) => {
    if (stopping) return;
    stopping = true;
    log("stopping", { signal, active: runner.active });
    await runner.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  await runner.start();
  log("started", { url: config.url });
  if (config.once) {
    // Rehearsal mode: leave once nothing has run for three polls in a row.
    let idle = 0;
    const timer = setInterval(() => {
      idle = runner.active === 0 ? idle + 1 : 0;
      if (idle >= 3) {
        clearInterval(timer);
        stop("queue_empty");
      }
    }, 2_000);
  }
}

async function containerRunner(config) {
  const probe = probeContainerRuntime({ image: config.image, expectedImageId: config.imageId });
  if (!probe.available) throw new Error(`container runtime not usable: ${probe.reason}`);
  log("runtime", { docker: probe.dockerVersion, imageId: probe.imageId, slots: config.slots });
  log("warm_up", { ok: await warmUpContainer(probe.imageId) });

  const client = createRunnerClient({ baseUrl: config.url, token: config.token });
  const probeSets = loadProbeSets(config.probeDir);
  // Only the first 12 characters: enough to match the admin page, and the file itself never leaves this machine.
  log("probe_sets", { sets: [...probeSets].map(([sha, positions]) => ({ set: sha.slice(0, 12), positions: positions.length })) });
  const storageDir = path.join(ROOT, "var/bot-cup/runner-artifacts");
  fs.mkdirSync(storageDir, { recursive: true });
  const executor = createExecutor({
    artifactStore: createArtifactStore({ storageDir }),
    image: config.image,
    expectedImageId: config.imageId,
    probe: () => probe,
    fetchSource: (sha256) => client.source(sha256),
    houseSources: await houseBotSources(),
    probeSets
  });
  return createRunner({
    client,
    executor,
    slots: config.slots,
    pollMs: config.once ? 2_000 : config.pollMs,
    info: { version: VERSION, imageId: probe.imageId, host: os.hostname() },
    log
  });
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    log("fatal", { message: error.message });
    process.exit(1);
  });
}
