import { Loaded, useAdmin, useLoad } from "../admin";
import { time } from "../format";
import { ActButton, DataTable, Section, Tag } from "../components/parts";
import styles from "../admin.module.css";

interface PendingRow {
  readonly id: string; readonly action: string; readonly target: string; readonly reason: string; readonly requested_by: string;
  readonly requested_at: number; readonly status: string; readonly decided_by: string | null;
}

const ACTION: Readonly<Record<string, string>> = { "team.disqualify": "Loại đội", "match.set_result": "Sửa kết quả", "flag.confirm": "Xác nhận vi phạm" };

/** Four eyes (plan §11.4): another admin approves; the one who asked cannot. */
export function Pending() {
  const { me } = useAdmin();
  const load = useLoad((api) => api.get<{ pending: PendingRow[] }>("/pending"));
  return (
    <Loaded load={load}>
      {({ pending }) => (
        <Section title="Chờ duyệt (quy tắc hai người)">
          <p className={styles.muted}>Người đề nghị không tự duyệt được. Ở bản demo, đăng xuất rồi vào bằng tài khoản BTC khác để duyệt.</p>
          <DataTable caption="Chờ duyệt" headers={["Việc", "Đối tượng", "Lý do", "Người đề nghị", "Lúc", "Trạng thái", ""]} empty="Không có việc chờ duyệt."
            rows={pending.map((item) => ({
              key: item.id,
              cells: [ACTION[item.action] ?? item.action, item.target, item.reason, item.requested_by, time(item.requested_at),
                item.status === "pending" ? <Tag key="s" status="warning">chờ</Tag> : `${item.status} · ${item.decided_by}`,
                item.status === "pending" && item.requested_by !== me.email ? (
                  <div className={styles.actions} key="a">
                    <ActButton label="Duyệt" spec={{ title: `Duyệt: ${ACTION[item.action] ?? item.action}`, path: `/pending/${item.id}/approve`, needsReason: false, description: `${item.target} · lý do: ${item.reason}` }} />
                    <ActButton variant="quiet" label="Từ chối" spec={{ title: `Từ chối: ${ACTION[item.action] ?? item.action}`, path: `/pending/${item.id}/reject`, description: item.target }} />
                  </div>
                ) : item.status === "pending" ? <span className={styles.muted} key="o">chờ admin khác</span> : null],
            }))} />
        </Section>
      )}
    </Loaded>
  );
}
