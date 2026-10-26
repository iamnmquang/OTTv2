import type { EventRow, StepSummary } from "./types";

export const time = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—");
export const short = (text: string | null | undefined, n = 12) => (text ? String(text).slice(0, n) : "—");
export const percent = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${Math.round(value * 1000) / 10}%`);

export const PHASE_LABEL: Readonly<Record<string, string>> = {
  registration: "Đăng ký / luyện tập", practice: "Luyện tập", frozen: "Đã khóa code", gate: "Vòng sơ loại",
  qualifying: "Vòng loại", verification: "Phỏng vấn code", knockout: "Loại trực tiếp", finished: "Đã kết thúc",
};
export const PHASE_ORDER = ["registration", "frozen", "gate", "qualifying", "verification", "knockout", "finished"] as const;
export const TEAM_STATUS: Readonly<Record<string, string>> = { pending_captain: "chờ đội trưởng xác minh", pending_members: "chờ thành viên", active: "đủ điều kiện" };
export const TEAM_KIND: Readonly<Record<string, string>> = { solo: "cá nhân", group: "nhóm" };

const MILESTONES: ReadonlyArray<readonly [keyof EventRow, string]> = [
  ["registrationOpensAt", "Mở đăng ký"], ["practiceOpensAt", "Mở luyện tập"], ["registrationClosesAt", "Đóng đăng ký"], ["codeFreezeAt", "Khóa code"], ["finalsAt", "Chung kết"],
];

/** "3 ngày 4 giờ", "2 giờ 5 phút", "12 phút". */
export function until(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days) return `${days} ngày${hours ? ` ${hours} giờ` : ""}`;
  if (hours) return `${hours} giờ${minutes % 60 ? ` ${minutes % 60} phút` : ""}`;
  return `${minutes} phút`;
}

/** Milestones of the event in time order; `next` is the first one still ahead of the server clock. */
export function milestones(event: EventRow | null, serverTime: number) {
  const rows = MILESTONES.filter(([key]) => event?.[key]).map(([key, label]) => ({ key, label, at: Number(event?.[key]) })).sort((a, b) => a.at - b.at);
  return { rows, next: rows.find((row) => row.at > serverTime) ?? null };
}

/** Anything that is not the real event gets a red chip, so nobody runs a step on staging thinking it is production. */
export const isTrialEvent = (event: EventRow | null) => event?.mode === "demo" || /staging|rehearsal|showcase|mock|test|demo|preview/i.test(event?.id ?? "");

const list = (slots: readonly string[] | undefined) => (slots?.length ? slots.join(", ") : "—");

/** What a tournament step would do, from its dry-run summary, one fact per line. */
export function describePreview(p: StepSummary): string[] {
  const parts: string[] = [];
  if (p.sealed !== undefined) parts.push(`${p.sealed} bài niêm phong, ${p.notSealed ?? 0} đội không có bài`);
  if (p.entrants !== undefined) parts.push(`${p.entrants} đội đấu sơ loại`);
  if (p.teams !== undefined) parts.push(`${p.teams} đội`);
  if (p.qualified !== undefined) parts.push(`${p.qualified} đội đạt sơ loại`);
  if (p.games !== undefined) parts.push(`${p.games} ván`);
  if (p.format) parts.push(`Thể thức ${p.format === "round_robin" ? "vòng tròn" : p.format}`);
  if (p.pairings !== undefined) parts.push(Array.isArray(p.pairings) ? `Cặp ${list(p.pairings as readonly string[])}` : `${p.pairings} cặp`);
  if (p.round !== undefined) parts.push(`Vòng ${p.round}${p.rounds ? `/${p.rounds}` : ""}`);
  if (p.map) parts.push(`Bản đồ ${p.map}`);
  if (p.size !== undefined) parts.push(`Nhánh ${p.size} đội`);
  if (p.tiebreaks?.length) parts.push(`Tie-break ${list(p.tiebreaks.map((t) => t.slot))}`);
  if (p.finished) parts.push("Kết thúc giải, công bố kết quả cuối");
  return parts;
}
