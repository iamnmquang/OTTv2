import { Loaded, useLoad } from "../admin";
import { time } from "../format";
import { ActButton, Code, DataTable, Section, Tag } from "../components/parts";
import styles from "../admin.module.css";

interface RunnerRow {
  readonly id: string; readonly name: string; readonly revoked_at: number | null; readonly online: boolean; readonly last_seen_at: number | null;
  readonly image_id: string | null; readonly active: number | null; readonly slots: number | null; readonly suspect_at: number | null; readonly suspect_reason: string | null;
}
interface JobRow { readonly id: string; readonly kind: string; readonly stage: string | null; readonly attempts: number; readonly last_error: string | null; readonly updated_at: number }

export function Runners() {
  const load = useLoad(async (api) => {
    const [runners, jobs] = await Promise.all([api.get<{ runners: RunnerRow[] }>("/runners"), api.get<{ jobs: JobRow[] }>("/jobs?status=failed")]);
    return { runners: runners.runners, jobs: jobs.jobs };
  });
  return (
    <Loaded load={load}>
      {({ runners, jobs }) => (
        <>
          <Section title="Runner">
            <DataTable caption="Runner" headers={["Tên", "Trạng thái", "Lần cuối", "Image", "Slot", "Nghi vấn", ""]} empty="Chưa có runner."
              rows={runners.map((runner) => ({
                key: runner.id,
                cells: [runner.name,
                  runner.revoked_at ? <Tag key="s" status="danger">thu hồi</Tag> : runner.online ? <Tag key="s" status="success">online</Tag> : <Tag key="s" status="warning">offline</Tag>,
                  time(runner.last_seen_at), <Code key="i" value={runner.image_id} n={19} />, `${runner.active ?? 0}/${runner.slots ?? 0}`, runner.suspect_reason ?? "—",
                  <div className={styles.actions} key="a">
                    {runner.suspect_at ? <ActButton variant="quiet" label="Bỏ nghi vấn" spec={{ title: `Bỏ nghi vấn runner ${runner.name}`, path: `/runners/${runner.id}/clear-suspect` }} /> : null}
                    {runner.revoked_at ? null : <ActButton variant="danger" label="Thu hồi" spec={{ title: `Thu hồi token của ${runner.name}`, path: `/runners/${runner.id}/revoke`, danger: true }} />}
                  </div>],
              }))} />
          </Section>
          <Section title={`Job lỗi (${jobs.length})`}>
            <DataTable caption="Job lỗi" headers={["Loại", "Giai đoạn", "Lần chạy", "Lỗi cuối", "Cập nhật", ""]} empty="Không có job lỗi."
              rows={jobs.map((job) => ({
                key: job.id,
                cells: [job.kind, job.stage ?? "check", job.attempts, <code key="e" className={styles.code}>{job.last_error ?? ""}</code>, time(job.updated_at),
                  <ActButton key="r" variant="quiet" label="Đưa lại hàng đợi" spec={{ title: "Đưa job lại hàng đợi", path: `/jobs/${job.id}/requeue` }} />],
              }))} />
          </Section>
        </>
      )}
    </Loaded>
  );
}
