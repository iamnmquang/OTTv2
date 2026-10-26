import { useCallback, useEffect, useRef, useState } from "react";
import { AdminApiError, errorText, type AdminApi } from "./api";
import type { StepSummary, TournamentAdminView } from "./types";

export const AUTO_REASON = "Demo: điều phối tự động";
const WAIT = new Set(["games_pending", "freeze_too_early"]);

export type StepOutcome = { readonly kind: "done"; readonly step: string; readonly summary: StepSummary } | { readonly kind: "wait"; readonly code: string } | { readonly kind: "finished" };

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
  if (result.code && WAIT.has(result.code)) return { kind: "wait", code: result.code };
  throw result.error ?? new Error(result.code ?? "unknown");
}

/** Runs `nextStep` until the event ends, waiting `waitMs` while games are pending; stoppable at any time. */
export function useAutoRun(api: AdminApi, { onStep, waitMs = 5000 }: { readonly onStep: (outcome: StepOutcome) => void; readonly waitMs?: number }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useRef(false);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const stop = useCallback(() => {
    live.current = false;
    setRunning(false);
  }, []);

  const start = useCallback(async () => {
    if (live.current) return;
    live.current = true;
    setRunning(true);
    setError(null);
    try {
      while (live.current) {
        const outcome = await nextStep(api);
        if (!live.current) break;
        onStepRef.current(outcome);
        if (outcome.kind === "finished") break;
        if (outcome.kind === "wait") await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      live.current = false;
      setRunning(false);
    }
  }, [api, waitMs]);

  useEffect(() => () => { live.current = false; }, []);
  return { running, error, start, stop };
}
