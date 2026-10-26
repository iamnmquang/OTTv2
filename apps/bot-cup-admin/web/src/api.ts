/** The admin API at /admin-api (apps/bot-cup-admin/src/app.mjs), same-origin with the session cookie. */

export class AdminApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly detail: Record<string, unknown> | null) {
    super(code);
    this.name = "AdminApiError";
  }
}

/** Vietnamese text for the refusals organisers meet most; anything else shows its code. */
export const ERRORS: Readonly<Record<string, string>> = {
  phase_mismatch: "Sai thứ tự: giai đoạn hiện tại không cho bước này.",
  freeze_too_early: "Chưa tới giờ khóa code.",
  games_pending: "Còn ván chưa chấm xong",
  not_enough_teams: "Không đủ đội qua vòng sơ loại để đấu vòng loại.",
  already_started: "Vòng loại đã bắt đầu.",
  not_started: "Vòng loại chưa bắt đầu.",
  not_swiss: "Vòng loại không phải Swiss.",
  swiss_complete: "Đã đủ số vòng Swiss.",
  swiss_unfinished: "Chưa đấu đủ số vòng Swiss.",
  interviews_pending: "Còn đội trong 4 hạt giống đầu chưa phỏng vấn.",
  knockout_not_possible: "Dưới 4 đội: không đấu loại trực tiếp, dùng \"Kết thúc không cần loại trực tiếp\".",
  knockout_expected: "Đủ đội để đấu loại trực tiếp: hãy bắt đầu loại trực tiếp.",
  already_answered: "Khiếu nại đã được trả lời.",
  reason_required: "Cần ghi lý do (ít nhất 3 ký tự).",
  read_only: "Tài khoản chỉ xem, không được ghi.",
  same_admin: "Người đề nghị không tự duyệt được.",
  already_notified: "Đã ghi nhận báo đội trước đó.",
  already_decided: "Việc này đã được quyết định.",
  forbidden_origin: "Yêu cầu bị chặn (origin). Hãy tải lại trang.",
  login_failed: "Sai email, mật khẩu hoặc mã TOTP.",
  login_locked: "Sai quá nhiều lần, thử lại sau 15 phút.",
  not_an_admin: "Tài khoản này không phải BTC.",
  invalid_request: "Dữ liệu gửi lên không hợp lệ.",
  not_found: "Không tìm thấy.",
};

export function errorText(error: unknown): string {
  if (!(error instanceof AdminApiError)) return error instanceof Error ? error.message : String(error);
  const base = ERRORS[error.code];
  if (!base) return `lỗi ${error.code}`;
  const pending = error.detail?.pending;
  return typeof pending === "number" ? `${base} (${pending} ván).` : base;
}

export class AdminApi {
  constructor(private readonly base = "/admin-api", private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  url(path: string): string {
    return `${this.base}${path}`;
  }

  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(this.url(path), {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const type = response.headers.get("content-type") || "";
    const payload: unknown = type.includes("json") ? await response.json() : await response.text();
    if (!response.ok) {
      const detail = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
      throw new AdminApiError(response.status, typeof detail?.error === "string" ? detail.error : `HTTP ${response.status}`, detail);
    }
    return payload as T;
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T = unknown>(path: string, body: unknown = {}): Promise<T> {
    return this.request<T>("POST", path, body);
  }
}
