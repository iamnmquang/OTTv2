/** Formatting shared by the lobby banner and the Bot Cup screens; kept apart so the banner stays small. */
import type { BotCupEvent } from "./BotCupApiGateway";

const DATE_TIME = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit", minute: "2-digit", hourCycle: "h23", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
});

/** "23:59, 31/12/2026" in Vietnam time. */
export function formatDateTime(epochMs: number | null | undefined): string {
  if (!epochMs) return "—";
  const part = Object.fromEntries(DATE_TIME.formatToParts(epochMs).map(({ type, value }) => [type, value]));
  return `${part.hour}:${part.minute}, ${part.day}/${part.month}/${part.year}`;
}

/** The one line the lobby banner shows: the next milestone of the event. */
export function bannerLine(event: BotCupEvent | null, now: number): string {
  if (!event) return "Giải đấu lập trình bot Oẳn Tù Tì cho sinh viên UET";
  if (now < event.registrationOpensAt) return `Mở đăng ký ${formatDateTime(event.registrationOpensAt)}`;
  if (now < event.registrationClosesAt) return `Đang mở đăng ký · hạn chót ${formatDateTime(event.registrationClosesAt)}`;
  if (event.codeFreezeAt && now < event.codeFreezeAt) return `Khóa code ${formatDateTime(event.codeFreezeAt)}`;
  if (event.finalsAt && now < event.finalsAt) return `Chung kết ${formatDateTime(event.finalsAt)}`;
  return "Xem kết quả giải đấu";
}
