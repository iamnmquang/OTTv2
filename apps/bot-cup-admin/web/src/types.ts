import type { BracketView, KnockoutPairing, QualifyingRound, StandingRow } from "@web/features/bot-cup/BotCupApiGateway";

export type Role = "admin" | "viewer";
export type AuthMode = "access" | "password" | "demo";

export interface Me {
  readonly email: string;
  readonly role: Role;
  readonly authMode: AuthMode;
  readonly fourEyes: readonly string[];
  readonly publicWebOrigin: string | null;
}

export interface LoginInfo {
  readonly authMode: AuthMode;
  readonly admins?: ReadonlyArray<{ readonly email: string; readonly role: Role }>;
}

export interface EventRow {
  readonly id: string;
  readonly name: string;
  readonly mode: "demo" | "production";
  readonly phase: string;
  readonly registrationOpensAt: number;
  readonly registrationClosesAt: number;
  readonly practiceOpensAt: number | null;
  readonly codeFreezeAt: number | null;
  readonly finalsAt: number | null;
}

export interface Alerts {
  readonly suspectRunners: number;
  readonly failedJobs: number;
  readonly openFlags: number;
  readonly pendingApprovals: number;
}

export interface Overview {
  readonly event: EventRow | null;
  readonly serverTime: number;
  readonly teams: Readonly<Record<string, number>>;
  readonly disqualifiedTeams: number;
  readonly submissions: Readonly<Record<string, number>>;
  readonly submissionsLast24h: number;
  readonly jobs: Readonly<Record<string, number>>;
  readonly runnersOnline: number;
  readonly alerts: Alerts;
}

export interface Entrant {
  readonly teamId: string;
  readonly team: string;
  readonly version: number;
  readonly language: string;
  readonly sha256: string;
  readonly gatePoints: number | null;
  readonly gateStatus: "pending" | "qualified" | "not_qualified";
  readonly seed: number | null;
  readonly interview: "pending" | "pass" | "fail";
  readonly disqualified: boolean;
}

export type AdminStandingRow = StandingRow & { readonly teamId: string; readonly h2h?: number };
export type AdminQualifyingRound = QualifyingRound & {
  readonly pairings: ReadonlyArray<QualifyingRound["pairings"][number] & { readonly teamA: string | null; readonly teamB: string | null }>;
};

export interface TournamentAdminView {
  readonly phase: string;
  readonly codeFreezeAt: number | null;
  readonly mode: "demo" | "production";
  readonly knockoutSize: 4 | 8 | 16;
  readonly entrants: readonly Entrant[];
  readonly gateProgress: ReadonlyArray<{ readonly team: string; readonly played: number; readonly verdict: { readonly status: string; readonly points: number } | null }>;
  readonly standings: { readonly format: "round_robin" | "swiss" | null; readonly rows: readonly AdminStandingRow[] };
  readonly rounds: readonly AdminQualifyingRound[];
  readonly knockout: ReadonlyArray<KnockoutPairing & { readonly id: string }>;
  readonly bracket: BracketView;
  readonly interviews: { readonly size: number; readonly ready: boolean; readonly seeded: readonly string[]; readonly waitingFor: readonly string[] } | null;
  readonly documents: ReadonlyArray<{ readonly stage: string; readonly sha256: string; readonly published_at: number }>;
  readonly appeals: ReadonlyArray<{
    readonly id: string; readonly display_name: string; readonly stage: string; readonly body: string; readonly status: "open" | "answered";
    readonly response: string | null; readonly answered_by: string | null; readonly created_at: number;
  }>;
}

/** A tournament step's summary, from `{ dryRun: true }` or the step itself. */
export interface StepSummary {
  readonly sealed?: number;
  readonly notSealed?: number;
  readonly entrants?: number;
  readonly teams?: number;
  readonly qualified?: number;
  readonly games?: number;
  readonly format?: string;
  readonly pairings?: number | readonly string[];
  readonly round?: number;
  readonly rounds?: number;
  readonly map?: string;
  readonly size?: number;
  readonly tiebreaks?: ReadonlyArray<{ readonly slot: string; readonly mapId: string }>;
  readonly finished?: boolean;
  readonly sha256?: string;
}
