import { Button } from "@web/shared/ui/Button";
import { Loaded, useAdmin, useLoad, type Tab } from "../admin";
import { PHASE_LABEL, milestones, time, until } from "../format";
import type { Overview as OverviewData } from "../types";
import { Section, StatCard, Tag } from "../components/parts";
import styles from "../admin.module.css";

const PHASE_TODO: Readonly<Record<string, string>> = {
  registration: "Theo dõi đăng ký; tới giờ khóa code thì bấm “Khóa code và niêm phong”.",
  practice: "Tới giờ khóa code thì bấm “Khóa code và niêm phong”.",
  frozen: "Chạy JPlag trên bài niêm phong, rồi bắt đầu vòng sơ loại.",
  gate: "Chờ mỗi đội đủ 6 ván sơ loại rồi chốt vòng sơ loại.",
  qualifying: "Khi mọi ván của vòng xong: tạo vòng Swiss kế tiếp hoặc chốt vòng loại.",
  verification: "Phỏng vấn code 4 hạt giống đầu, rồi bắt đầu loại trực tiếp.",
  knockout: "Khi mọi ván của vòng xong: chốt vòng loại trực tiếp hiện tại.",
  finished: "Giải đã kết thúc: trả lời khiếu nại và tải kết quả đã công bố.",
};

const sum = (values: Readonly<Record<string, number>> | undefined) => Object.values(values ?? {}).reduce((a, b) => a + b, 0);

export function Overview() {
  const { show } = useAdmin();
  const load = useLoad((api) => api.get<OverviewData>("/overview"));
  return (
    <Loaded load={load}>
      {(data) => {
        const { event, alerts } = data;
        const { rows, next } = milestones(event, data.serverTime);
        const todo: Array<readonly [string, Tab]> = [];
        if (alerts.pendingApprovals) todo.push([`${alerts.pendingApprovals} việc chờ admin thứ hai duyệt.`, "pending"]);
        if (alerts.openFlags) todo.push([`${alerts.openFlags} cờ gian lận chưa xử lý.`, "flags"]);
        if (alerts.failedJobs) todo.push([`${alerts.failedJobs} job lỗi: xem lỗi rồi đưa lại hàng đợi.`, "runners"]);
        if (alerts.suspectRunners) todo.push([`${alerts.suspectRunners} runner bị nghi vấn.`, "runners"]);
        if (!data.runnersOnline && ["gate", "qualifying", "knockout"].includes(event?.phase ?? "")) todo.push(["Không có runner online: các ván sẽ không được chơi.", "runners"]);
        if (event && PHASE_TODO[event.phase]) todo.push([PHASE_TODO[event.phase], "tournament"]);
        const open = (tab: Tab) => () => show(tab);
        return (
          <>
            <Section title={event?.name ?? "Giải"}>
              <p className={styles.muted}>Chế độ {event?.mode ?? "—"} · giờ máy chủ {time(data.serverTime)}</p>
              <p>
                Giai đoạn: <Tag status="info">{PHASE_LABEL[event?.phase ?? ""] ?? event?.phase ?? "—"}</Tag>
                {next ? ` · ${next.label} sau ${until(next.at - data.serverTime)} (${time(next.at)})` : ""}
              </p>
              <h3>Việc cần làm tiếp</h3>
              <ul className={styles.todo}>
                {todo.map(([text, tab]) => (
                  <li key={text}><span>{text}</span><Button variant="quiet" onClick={open(tab)}>Mở</Button></li>
                ))}
              </ul>
            </Section>
            <Section title="Số liệu">
              <h3>Đội và bài nộp</h3>
              <div className={styles.cards}>
                <StatCard label="Đội (mọi trạng thái)" value={sum(data.teams)} onOpen={open("teams")} />
                <StatCard label="Đội đủ điều kiện" value={data.teams.active ?? 0} onOpen={open("teams")} />
                <StatCard label="Chờ thành viên / đội trưởng" value={(data.teams.pending_members ?? 0) + (data.teams.pending_captain ?? 0)} onOpen={open("teams")} />
                <StatCard label="Đội bị loại" value={data.disqualifiedTeams} onOpen={open("teams")} />
                <StatCard label="Bài sẵn sàng" value={data.submissions.ready ?? 0} onOpen={open("submissions")} />
                <StatCard label="Bài nộp 24 giờ qua" value={data.submissionsLast24h} onOpen={open("submissions")} />
              </div>
              <h3>Máy chấm</h3>
              <div className={styles.cards}>
                <StatCard label="Runner online" value={data.runnersOnline} onOpen={open("runners")} />
                <StatCard label="Job đang chờ" value={data.jobs.queued ?? 0} onOpen={open("runners")} />
                <StatCard label="Job đang chạy" value={data.jobs.leased ?? 0} onOpen={open("runners")} />
              </div>
              <h3>Cần xử lý</h3>
              <div className={styles.cards}>
                <StatCard label="Chờ duyệt" value={alerts.pendingApprovals} alert onOpen={open("pending")} />
                <StatCard label="Cờ chưa xử lý" value={alerts.openFlags} alert onOpen={open("flags")} />
                <StatCard label="Job lỗi" value={alerts.failedJobs} alert onOpen={open("runners")} />
                <StatCard label="Runner nghi vấn" value={alerts.suspectRunners} alert onOpen={open("runners")} />
              </div>
            </Section>
            {rows.length ? (
              <Section title="Mốc thời gian">
                <ol className={styles.milestones}>
                  {rows.map((row) => (
                    <li key={row.key} data-state={row === next ? "next" : row.at <= data.serverTime ? "past" : undefined}>
                      <b>{row.label}</b><span>{time(row.at)}</span>
                    </li>
                  ))}
                </ol>
              </Section>
            ) : null}
          </>
        );
      }}
    </Loaded>
  );
}
