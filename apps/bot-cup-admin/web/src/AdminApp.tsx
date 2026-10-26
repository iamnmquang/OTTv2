import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@web/shared/ui/Button";
import { ThemeToggle } from "@web/shared/ui/ThemeToggle";
import { ToastRegion } from "@web/shared/ui/ToastRegion";
import { useToasts } from "@web/shared/ui/useToasts";
import { AdminApiError, errorText, type AdminApi } from "./api";
import { AdminContext, type ActionSpec, type AdminContextValue, type Tab } from "./admin";
import { ActionDialog } from "./components/ActionDialog";
import { useAutoRun, type StepOutcome } from "./autoRun";
import { PHASE_LABEL, isTrialEvent, milestones, until } from "./format";
import type { Me, Overview as OverviewData } from "./types";
import { Login } from "./screens/Login";
import { Overview } from "./screens/Overview";
import { Tournament } from "./screens/Tournament";
import { Bracket } from "./screens/Bracket";
import { Matches } from "./screens/Matches";
import { Teams } from "./screens/Teams";
import { Submissions } from "./screens/Submissions";
import { Flags } from "./screens/Flags";
import { Runners } from "./screens/Runners";
import { Pending } from "./screens/Pending";
import { Announcements } from "./screens/Announcements";
import { Audit } from "./screens/Audit";
import styles from "./admin.module.css";

type CountKey = keyof OverviewData["alerts"];
const NAV: ReadonlyArray<readonly [string, ReadonlyArray<readonly [Tab, string, CountKey?]>]> = [
  ["Giải đấu", [["overview", "Tổng quan"], ["tournament", "Điều phối giải"], ["bracket", "Nhánh đấu"], ["matches", "Trận"]]],
  ["Đội & bài", [["teams", "Đội"], ["submissions", "Bài nộp"]]],
  ["Giám sát", [["flags", "Cờ gian lận", "openFlags"], ["runners", "Runner & job", "failedJobs"]]],
  ["Quản trị", [["pending", "Chờ duyệt", "pendingApprovals"], ["announcements", "Thông báo"], ["audit", "Audit log"]]],
];
const TABS = new Set<string>(NAV.flatMap(([, items]) => items.map(([tab]) => tab)));
const SCREENS: Record<Tab, () => JSX.Element> = {
  overview: Overview, tournament: Tournament, bracket: Bracket, matches: Matches, teams: Teams, submissions: Submissions,
  flags: Flags, runners: Runners, pending: Pending, announcements: Announcements, audit: Audit,
};

const tabFromHash = (): Tab => {
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  return (TABS.has(hash) ? hash : "overview") as Tab;
};

type Auth = { readonly status: "checking" } | { readonly status: "signed-out"; readonly notice: string | null } | { readonly status: "signed-in"; readonly me: Me };

/** The organisers' site (plan 2026-10-26 §3.4): sign-in, then a sidebar of screens over the admin API. */
export function AdminApp({ api }: { readonly api: AdminApi }) {
  const [auth, setAuth] = useState<Auth>({ status: "checking" });
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [overview, setOverview] = useState<{ readonly data: OverviewData; readonly receivedAt: number } | null>(null);
  const [version, setVersion] = useState(0);
  const [action, setAction] = useState<ActionSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { toasts, pushToast, dismissToast } = useToasts({ maxToasts: 4, duration: 5000 });

  const check = useCallback(async () => {
    try {
      setAuth({ status: "signed-in", me: await api.get<Me>("/me") });
    } catch (error) {
      if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
        setAuth({ status: "signed-out", notice: error.status === 403 ? "Tài khoản này không phải BTC." : null });
      } else {
        setAuth({ status: "signed-out", notice: `Không kết nối được API: ${errorText(error)}` });
      }
    }
  }, [api]);
  useEffect(() => { void check(); }, [check]);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const signedIn = auth.status === "signed-in";
  // The header (phase, next milestone, alert counts) follows every write and refreshes each minute.
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api.get<OverviewData>("/overview").then((data) => {
      if (!live) return;
      setOverview({ data, receivedAt: Date.now() });
      document.title = `BTC · ${data.event?.name ?? "OTT Bot Cup"}`;
    }, () => undefined);
    return () => { live = false; };
  }, [api, signedIn, version, Math.floor(now / 60_000)]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const show = useCallback((next: Tab) => {
    setMenuOpen(false);
    if (window.location.hash !== `#${next}`) window.location.hash = next;
    setTab(next);
  }, []);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  const notify = useCallback((message: string, tone: "info" | "success" | "warning" | "error" = "info") => { pushToast(message, tone); }, [pushToast]);

  const onAutoStep = useCallback((outcome: StepOutcome) => {
    if (outcome.kind === "done") {
      notify(`Tự chạy: ${outcome.step} xong.`, "success");
      refresh();
    } else if (outcome.kind === "finished") {
      notify("Tự chạy: giải đã kết thúc.", "success");
      refresh();
    }
  }, [notify, refresh]);
  const auto = useAutoRun(api, { onStep: onAutoStep });
  useEffect(() => { if (auto.error) notify(`Tự chạy dừng: ${auto.error}`, "error"); }, [auto.error, notify]);

  const context = useMemo<AdminContextValue | null>(() => auth.status !== "signed-in" ? null : {
    api, me: auth.me, writer: auth.me.role === "admin", overview: overview?.data ?? null, version, refresh, show, notify,
    act: setAction,
    signedOut: () => setAuth({ status: "signed-out", notice: "Phiên đăng nhập đã hết, hãy đăng nhập lại." }),
    autoRun: { available: auth.me.authMode === "demo" && auth.me.role === "admin", running: auto.running, error: auto.error, start: () => void auto.start(), stop: auto.stop },
  }, [api, auth, overview, version, refresh, show, notify, auto.running, auto.error, auto.start, auto.stop]);

  const confirm = async (body: Record<string, unknown>) => {
    if (!action) return;
    setBusy(true);
    try {
      const result = await api.post<{ pendingId?: string }>(action.path, body);
      notify(result?.pendingId ? `${action.title}: đã gửi, chờ admin thứ hai duyệt.` : `${action.title}: xong.`, "success");
      setAction(null);
      refresh();
    } catch (error) {
      notify(`${action.title}: ${errorText(error)}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    auto.stop();
    await api.post("/logout").catch(() => undefined);
    setOverview(null);
    setAuth({ status: "signed-out", notice: null });
  };

  const toastRegion = <ToastRegion toasts={toasts} onDismiss={dismissToast} aria-label="Thông báo" />;
  if (auth.status === "checking") return <main className={styles.center}><p className={styles.muted} role="status">Đang kết nối…</p></main>;
  if (auth.status === "signed-out" || !context) {
    return <>{<Login api={api} notice={auth.status === "signed-out" ? auth.notice : null} onSignedIn={() => void check()} />}{toastRegion}</>;
  }

  const event = overview?.data.event ?? null;
  const clock = overview ? overview.data.serverTime + (now - overview.receivedAt) : now;
  // A finished event has no milestone left to count down to, whatever its dates say.
  const next = event && event.phase !== "finished" ? milestones(event, clock).next : null;
  const Screen = SCREENS[tab];

  return (
    <AdminContext.Provider value={context}>
      <a className={styles.skip} href="#view">Bỏ qua tới nội dung</a>
      <header className={styles.top}>
        <button type="button" className={styles.menuToggle} aria-controls="sidebar" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
        <div className={styles.brand}>
          <img src="/uet-logo.webp" alt="Logo Trường Đại học Công nghệ, ĐHQGHN" width={44} height={44} />
          <div>
            <span className={styles.eyebrow}>Trường ĐH Công nghệ · ĐHQGHN</span>
            <h1>OTT Bot Cup · Ban tổ chức</h1>
          </div>
        </div>
        <div className={styles.chips} aria-live="polite">
          {event ? <span className={styles.chip} data-kind="phase" title="Giai đoạn hiện tại">{PHASE_LABEL[event.phase] ?? event.phase}</span> : null}
          {next ? <span className={styles.chip}>{next.label} sau {until(next.at - clock)}</span> : null}
          {isTrialEvent(event) ? <span className={styles.chip} data-kind="trial" title={`Sự kiện ${event?.id}, chế độ ${event?.mode}`}>THỬ NGHIỆM · {event?.id}</span> : null}
          {auto.running ? <button type="button" className={styles.chip} data-kind="auto" onClick={auto.stop}>Đang tự chạy · Dừng</button> : null}
        </div>
        <div className={styles.account}>
          <span>{auth.me.email} · {auth.me.role === "admin" ? "admin" : "chỉ xem"}</span>
          <ThemeToggle className={styles.onBlue} />
          {auth.me.authMode === "access" ? null : <Button variant="secondary" className={styles.onBlue} onClick={() => void logout()}>Đăng xuất</Button>}
        </div>
      </header>
      <div className={styles.shell}>
        <nav id="sidebar" className={styles.sidebar} data-open={menuOpen || undefined} aria-label="Mục quản trị">
          {NAV.map(([group, items]) => (
            <div key={group} className={styles.navGroup}>
              <p>{group}</p>
              {items.map(([id, label, count]) => {
                const value = count ? overview?.data.alerts[count] ?? 0 : 0;
                return (
                  <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => show(id)}>
                    {label}{value ? <span className={styles.count} aria-label={`${value} cần xử lý`}>{value}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <main id="view" className={styles.view} tabIndex={-1}>
          <Screen key={tab} />
        </main>
      </div>
      {action ? <ActionDialog spec={action} busy={busy} onCancel={() => setAction(null)} onConfirm={(body) => void confirm(body)} /> : null}
      {toastRegion}
    </AdminContext.Provider>
  );
}
