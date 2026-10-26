"use strict";

/**
 * Showcase event (plan 2026-10-26-bot-cup-admin-showcase §3.5): the seed SQL of scripts/bot-cup/showcase.mjs on SQLite with
 * the real migrations, the simulated runner (apps/bot-cup-runner/src/simulate.mjs) settling every job through the runner
 * API, so each game is replayed by the Worker code, and `driveEvent` pressing every organiser step to the end.
 */
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const { createHarness, START, DAY } = require("./bot-cup/harness");

const ADMIN_ORIGIN = "https://btc.test";
const EVENT = "showcase-test";

let showcase;
let simulate;
let runnerMain;
before(async () => {
  showcase = await import("../scripts/bot-cup/showcase.mjs");
  simulate = await import("../apps/bot-cup-runner/src/simulate.mjs");
  runnerMain = await import("../apps/bot-cup-runner/src/main.mjs");
});

describe("bot-cup showcase: synthetic teams", () => {
  it("makes 100 distinct teams with a spread of strengths, each in its own bot source", () => {
    const teams = showcase.showcaseTeams(100);
    assert.equal(new Set(teams.map((team) => team.name)).size, 100);
    assert.ok(teams.every((team) => team.strength >= 0.55 && team.strength <= 1));
    const weak = teams.filter((team) => team.strength < 0.68).length;
    assert.ok(weak > 20 && weak < 40, `about 3 in 10 should miss the gate, got ${weak}`);
    assert.deepEqual(showcase.showcaseTeams(100), teams, "deterministic");
    for (const team of teams.slice(0, 5)) assert.equal(simulate.parseStrength(showcase.botSource(team)), team.strength);
    assert.equal(simulate.parseStrength("print('a real bot')"), null);
  });

  it("runs only against the showcase Worker or localhost, and needs no image there", () => {
    const env = (url) => ({ BOT_CUP_RUNNER_URL: url, BOT_CUP_RUNNER_TOKEN: "t".repeat(40), BOT_CUP_RUNNER_SIMULATE: "true" });
    assert.equal(runnerMain.readConfig(env("https://ottv2-bot-cup-api-showcase.someone.workers.dev")).simulate, true);
    assert.equal(runnerMain.readConfig(env("http://localhost:8789")).simulate, true);
    for (const url of ["https://ottv2-bot-cup-api-staging.someone.workers.dev", "https://ottv2-bot-cup-api.someone.workers.dev", "https://ottv2-bot-cup-api-showcaseXsomeone.workers.dev"]) {
      assert.throws(() => runnerMain.readConfig(env(url)), /showcase Worker/, url);
    }
  });
});

describe("bot-cup showcase: a whole event, simulated", () => {
  it("seeds 20 teams, plays every game for real and ends with a published final", async () => {
    const h = await createHarness({ config: { eventId: EVENT } });
    const sqlite = h.db.sqlite;
    const teams = showcase.showcaseTeams(20);
    sqlite.exec(showcase.seedSql({ eventId: EVENT, teams, now: START, freezeAt: START + DAY }));
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM submissions WHERE event_id = ? AND status = 'ready'").get(EVENT).n, 20);

    h.env.clock = START + DAY; // code freeze time; the 12-hour admin session starts here
    const adminMod = await import("../apps/bot-cup-admin/src/app.mjs");
    const admin = adminMod.createAdminApi({ db: h.db, now: () => h.env.clock, config: { eventId: EVENT, authMode: "demo", allowedOrigins: [ADMIN_ORIGIN] } });
    const login = await admin.fetch(new Request(`${ADMIN_ORIGIN}/admin-api/login`, { method: "POST", headers: { origin: ADMIN_ORIGIN, "content-type": "application/json" }, body: "{}" }));
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const call = async (method, url, json) => {
      const response = await admin.fetch(new Request(`${ADMIN_ORIGIN}/admin-api${url}`, { method, headers: { cookie, ...(json ? { origin: ADMIN_ORIGIN, "content-type": "application/json" } : {}) }, body: json ? JSON.stringify(json) : undefined }));
      return { status: response.status, body: await response.json() };
    };

    const token = h.runner();
    const executor = simulate.createSimulatedExecutor({ fetchSource: async (sha256) => new Uint8Array((await h.call("GET", `/runner/source/${sha256}`, { token })).body) });
    let games = 0;
    // What the runner loop would do, inline: claim, play in process, report; the Worker replays and scores each game.
    const idle = async () => {
      for (;;) {
        const jobs = (await h.call("POST", "/runner/claim", { token, json: { slots: 8 } })).body.jobs;
        if (!jobs.length) return;
        for (const job of jobs) {
          assert.equal(job.kind, "match");
          const played = await executor.runMatch(job);
          const done = await h.call("POST", "/runner/complete", { token, json: { jobId: job.jobId, attempt: job.attempt, replay: played.replay, stderr: played.stderr } });
          assert.equal(done.status, 200, JSON.stringify(done.body));
          games += 1;
        }
      }
    };
    const steps = [];
    await showcase.driveEvent(call, { idle, say: (name) => steps.push(name) });

    assert.equal(steps.at(-1), "finished");
    for (const name of ["freeze", "gate-start", "gate-close", "qualifying-start", "qualifying-close", "interviews", "knockout-start", "knockout-advance"]) {
      assert.ok(steps.includes(name), `${name} in ${steps.join(",")}`);
    }
    const view = (await call("GET", "/tournament")).body;
    const qualified = view.entrants.filter((entrant) => entrant.gateStatus === "qualified").length;
    assert.ok(qualified >= 8, `enough teams pass the gate for a bracket of 8 (got ${qualified})`);
    assert.equal(view.bracket.size, qualified >= 16 ? 16 : 8);
    assert.ok(view.bracket.rounds.every((round) => round.slots.every((slot) => slot.pairing?.winner)));
    const final = (await h.call("GET", "/api/t/results/final")).body;
    assert.equal(final.ranking.length, qualified);
    // Strength shows: the champion is among the stronger half of the field.
    const strengthOf = new Map(teams.map((team) => [team.name, team.strength]));
    assert.ok(strengthOf.get(final.ranking[0].team) >= 0.75, `${final.ranking[0].team} won`);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM matches WHERE event_id = ? AND status <> 'finished'").get(EVENT).n, 0);
    assert.ok(games > 120, `${games} games played`);
  });
});
