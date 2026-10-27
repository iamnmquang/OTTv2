import { useCallback, useEffect, useRef, useState } from "react";
import { AdminApiError, errorText, type AdminApi } from "./api";
import type { StepSummary, TournamentAdminView } from "./types";

export const AUTO_REASON = "Demo: điều phối tự động";
const WAIT = new Set(["games_pending", "freeze_too_early"]);
/** Pauses before each retry of a transient failure; one more failure after the last one stops the run. */
export const RETRY_DELAYS_MS: readonly number[] = [2000, 4000, 8000, 8000, 8000];

export type StepOutcome =
  | { readonly kind: "done"; readonly step: string; readonly summary: StepSummary }
  | { readonly kind: "wait"; readonly code: string; readonly pending?: number }
  | { readonly kind: "finished" };

/** A server error (5xx) or a request that never got an answer: worth another try. Refusals (4xx) are not. */
export function isTransient(error: unknown): boolean {
  if (error instanceof AdminApiError) return error.status >= 500;
  return error instanceof TypeError;
}

/**
 * One move of the demo organiser (same order as `driveEvent` in scripts/bot-cup/showcase.mjs): the next step the phase
 * allows, the top 4 passing their interviews. Pending games or an early freeze are a wait, anything else is an error.
 */
export async function nextStep(api: AdminApi): Promise<StepOutcome> {
  const view = await api.get<TournamentAdminView>("/tournament");
  const step = async (name: string, extra: Record<string, unknown> = {}) => {
    try {
      return { name, summary: await api.post<StepSummary>(`/tournament/${name}`, { reason: AUTO_REASON, ...extra }), code: null };
    } catch (error) {
      if (error instanceof AdminApiError) return { name, summary: null, code: error.code, error };
      throw error;
    }
  };
  if (view.phase === "finished") return { kind: "finished" };
  let result;
  if (view.phase === "registration" || view.phase === "practice") result = await step("freeze");
  else if (view.phase === "frozen") result = await step("gate-start");
  else if (view.phase === "gate") result = await step("gate-close");
  else if (view.phase === "qualifying") {
    if (!view.standings.format) result = await step("qualifying-start");
    else {
      result = await step("swiss-next");
      if (result.code === "swiss_complete" || result.code === "not_swiss") result = await step("qualifying-close");
    }
  } else if (view.phase === "verification") {
    const waiting = view.interviews?.waitingFor ?? [];
    if (waiting.length) result = await step("interviews", { teamIds: waiting, result: "pass" });
    else {
      result = await step("knockout-start");
      if (result.code === "knockout_not_possible") result = await step("finish");
    }
  } else if (view.phase === "knockout") result = await step("knockout-advance");
  else throw new Error(`Giai đoạn lạ: ${view.phase}`);

  if (result.summary) return { kind: "done", step: result.name, summary: result.summary };
  if (result.code && WAIT.has(result.code)) {
    const pending = result.error?.detail?.pending;
    return typeof pending === "number" ? { kind: "wait", code: result.code, pending } : { kind: "wait", code: result.code };
  }
  throw result.error ?? new Error(result.code ?? "unknown");
}

/** What the organiser reads under the auto-run button while it runs. */
export function waitText(outcome: Extract<StepOutcome, { kind: "wait" }>): string {
  if (outcome.code === "freeze_too_early") return "Đang chờ tới giờ khóa code.";
  return typeof outcome.pending === "number" ? `Đang chờ chấm xong ${outcome.pending} ván.` : "Đang chờ chấm xong các ván.";
}

/**
 * The auto-run loop without React: one step after another until the event ends or `live()` turns false. Pending games
 * are a wait; a transient failure is retried after each of `retryDelays`; anything else, or one failure too many, throws.
 */
export async function runAuto({ step, live, sleep, onStep, onStatus, waitMs = 5000, retryDelays = RETRY_DELAYS_MS }: {
  readonly step: () => Promise<StepOutcome>;
  readonly live: () => boolean;
  readonly sleep: (ms: number) => Promise<void>;
  readonly onStep: (outcome: StepOutcome) => void;
  readonly onStatus: (text: string | null) => void;
  readonly waitMs?: number;
  readonly retryDelays?: readonly number[];
}): Promise<void> {
  let failures = 0;
  while (live()) {
    let outcome: StepOutcome;
    try {
      outcome = await step();
    } catch (cause) {
      if (!isTransient(cause) || failures >= retryDelays.length) throw cause;
      onStatus(`${errorText(cause)} Thử lại ${failures + 1}/${retryDelays.length}…`);
      await sleep(retryDelays[failures]);
      failures += 1;
      continue;
    }
    failures = 0;
    if (!live()) return;
    onStep(outcome);
    if (outcome.kind === "finished") return;
    if (outcome.kind === "wait") {
      onStatus(waitText(outcome));
      await sleep(waitMs);
    } else onStatus(null);
  }
}

/** Runs `nextStep` until the event ends, waiting `waitMs` while games are pending; stoppable at any time. */
export function useAutoRun(api: AdminApi, { onStep, waitMs = 5000 }: { readonly onStep: (outcome: StepOutcome) => void; readonly waitMs?: number }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const live = useRef(false);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const stop = useCallback(() => {
    live.current = false;
    setRunning(false);
    setStatus(null);
  }, []);

  const start = useCallback(async () => {
    if (live.current) return;
    live.current = true;
    setRunning(true);
    setError(null);
    setStatus(null);
    try {
      await runAuto({
        step: () => nextStep(api),
        live: () => live.current,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        onStep: (outcome) => onStepRef.current(outcome),
        onStatus: setStatus,
        waitMs,
      });
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      live.current = false;
      setRunning(false);
      setStatus(null);
    }
  }, [api, waitMs]);

  useEffect(() => () => { live.current = false; }, []);
  return { running, error, status, start, stop };
}
