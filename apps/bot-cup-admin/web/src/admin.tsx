import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AdminApi } from "./api";
import { AdminApiError, errorText } from "./api";
import type { Me, Overview } from "./types";
import styles from "./admin.module.css";

export type Tab = "overview" | "tournament" | "bracket" | "matches" | "teams" | "submissions" | "flags" | "runners" | "pending" | "announcements" | "audit";

export interface ActionField {
  readonly name: string;
  readonly label: string;
  readonly kind?: "text" | "select";
  readonly options?: ReadonlyArray<readonly [string, string]>;
  readonly initial?: string;
}

/** A write the organiser confirms in a dialog: what it is, its preview, its inputs and the reason that goes into the audit log. */
export interface ActionSpec {
  readonly title: string;
  readonly path: string;
  readonly body?: Record<string, unknown>;
  /** Default true: the API refuses most writes without a reason (≥ 3 characters). */
  readonly needsReason?: boolean;
  readonly defaultReason?: string;
  readonly description?: string;
  readonly danger?: boolean;
  /** Lines describing what will happen, e.g. from a dry run; a rejection is shown and blocks the action. */
  readonly preview?: () => Promise<readonly string[]>;
  readonly fields?: readonly ActionField[];
  /** Turns the field values into the request body. */
  readonly bodyFrom?: (values: Record<string, string>) => Record<string, unknown>;
}

export interface AdminContextValue {
  readonly api: AdminApi;
  readonly me: Me;
  readonly writer: boolean;
  readonly overview: Overview | null;
  /** Bumped after every successful write: screens reload on it. */
  readonly version: number;
  readonly refresh: () => void;
  readonly show: (tab: Tab) => void;
  readonly act: (spec: ActionSpec) => void;
  readonly notify: (message: string, tone?: "info" | "success" | "warning" | "error") => void;
  readonly signedOut: () => void;
  /** Demo mode only: presses the next tournament step whenever the server allows it. */
  readonly autoRun: { readonly available: boolean; readonly running: boolean; readonly error: string | null; readonly start: () => void; readonly stop: () => void };
}

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin outside AdminContext");
  return value;
}

type Load<T> = { readonly status: "loading" } | { readonly status: "error"; readonly message: string } | { readonly status: "ready"; readonly data: T };

/** Loads `fetcher` and again after each write (or when `deps` change); a 401 sends the organiser back to sign in. */
export function useLoad<T>(fetcher: (api: AdminApi) => Promise<T>, deps: readonly unknown[] = []): Load<T> & { readonly reload: () => void } {
  const { api, version, signedOut } = useAdmin();
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fetcher(api).then(
      (data) => { if (live) setState({ status: "ready", data }); },
      (error) => {
        if (!live) return;
        if (error instanceof AdminApiError && error.status === 401) signedOut();
        else setState({ status: "error", message: errorText(error) });
      },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, version, tick, ...deps]);
  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { ...state, reload };
}

export function Loaded<T>({ load, children }: { readonly load: Load<T>; readonly children: (data: T) => ReactNode }) {
  if (load.status === "loading") return <p className={styles.muted} role="status">Đang tải…</p>;
  if (load.status === "error") return <p className={styles.error} role="alert">Không tải được: {load.message}</p>;
  return <>{children(load.data)}</>;
}
