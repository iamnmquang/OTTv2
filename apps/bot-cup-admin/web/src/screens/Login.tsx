import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@web/shared/ui/Button";
import { errorText, type AdminApi } from "../api";
import type { LoginInfo } from "../types";
import styles from "../admin.module.css";

/** Sign-in: one button per organiser in demo mode, password + TOTP in password mode; Access mode never shows it. */
export function Login({ api, notice, onSignedIn }: { readonly api: AdminApi; readonly notice: string | null; readonly onSignedIn: () => void }) {
  const [info, setInfo] = useState<LoginInfo | null>(null);
  const [message, setMessage] = useState<string | null>(notice);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", totp: "" });

  useEffect(() => {
    api.get<LoginInfo>("/login").then(setInfo, () => setInfo({ authMode: "password" }));
  }, [api]);
  useEffect(() => setMessage(notice), [notice]);

  const signIn = async (body: Record<string, string>) => {
    setBusy(true);
    setMessage(null);
    try {
      await api.post("/login", body);
      onSignedIn();
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void signIn(form);
  };

  return (
    <main className={styles.login} aria-labelledby="login-title">
      <div className={styles.loginCard}>
        <img src="/uet-logo.webp" alt="" width={72} height={72} />
        <h1 id="login-title">Đăng nhập Ban tổ chức</h1>
        <p className={styles.muted}>Chỉ tài khoản có trong danh sách BTC. Mọi thao tác ghi đều vào audit log.</p>
        {info === null ? <p className={styles.muted} role="status">Đang tải…</p> : null}
        {info?.authMode === "demo" ? (
          <div className={styles.demoAccounts}>
            <p className={styles.muted}>Bản demo: bấm để vào, không cần mật khẩu.</p>
            {(info.admins ?? []).map((account) => (
              <Button key={account.email} disabled={busy} onClick={() => void signIn({ email: account.email })}>
                Đăng nhập: {account.email}{account.role === "admin" ? "" : " (chỉ xem)"}
              </Button>
            ))}
          </div>
        ) : null}
        {info?.authMode === "password" ? (
          <form className={styles.loginForm} onSubmit={submit} aria-label="Đăng nhập bằng mật khẩu">
            <label className={styles.field}><span>Email</span>
              <input type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} /></label>
            <label className={styles.field}><span>Mật khẩu</span>
              <input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.currentTarget.value })} /></label>
            <label className={styles.field}><span>Mã TOTP (6 số)</span>
              <input inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required value={form.totp} onChange={(e) => setForm({ ...form, totp: e.currentTarget.value })} /></label>
            <Button type="submit" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</Button>
          </form>
        ) : null}
        {info?.authMode === "access" ? <p>Trang này đăng nhập qua Cloudflare Access. Hãy tải lại trang hoặc dùng email có trong danh sách BTC.</p> : null}
        {message ? <p className={styles.error} role="alert">{message}</p> : null}
      </div>
    </main>
  );
}
