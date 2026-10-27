import { useState } from "react";
import { Loaded, useLoad } from "../admin";
import { ActButton, DataTable, Section } from "../components/parts";
import styles from "../admin.module.css";

interface MatchRow {
  readonly id: string; readonly stage: string; readonly round: number | null; readonly map_id: string; readonly a_name: string | null; readonly b_name: string | null;
  readonly status: string; readonly outcome: string | null; readonly winner: string | null; readonly reason: string | null; readonly plies: number | null;
  readonly published: boolean;
}

const STATUS: Readonly<Record<string, string>> = { queued: "chờ", running: "đang chạy", finished: "xong", failed: "lỗi", cancelled: "huỷ" };

export function Matches() {
  const load = useLoad((api) => api.get<{ matches: MatchRow[] }>("/matches"));
  const [query, setQuery] = useState("");
  return (
    <Loaded load={load}>
      {({ matches }) => {
        const needle = query.trim().toLowerCase();
        const shown = matches.filter((match) => !needle || `${match.a_name} ${match.b_name} ${match.stage} ${match.id}`.toLowerCase().includes(needle));
        return (
          <Section title={`Trận (${matches.length} gần nhất)`} actions={<>
            <label className={styles.field} data-inline="true"><span>Tìm</span><input type="search" value={query} placeholder="Đội, giai đoạn, mã trận" onChange={(event) => setQuery(event.currentTarget.value)} /></label>
            <a className={styles.linkButton} href="/admin-api/export/results.csv">Xuất CSV kết quả</a>
          </>}>
            <DataTable caption="Trận" headers={["Giai đoạn", "Vòng", "Bản đồ", "Đỏ (A)", "Xanh (B)", "Trạng thái", "Kết quả", ""]}
              rows={shown.map((match) => ({
                key: match.id,
                cells: [match.stage, match.round ?? "—", match.map_id, match.a_name ?? "—", match.b_name ?? "—", STATUS[match.status] ?? match.status,
                  match.outcome ? `${match.outcome} ${match.winner ?? ""} · ${match.reason ?? ""} · ${match.plies ?? 0} nước` : "—",
                  match.published ? <span className={styles.muted} key="a">Đã công bố</span> : <div className={styles.actions} key="a">
                    <ActButton variant="quiet" label="Chạy lại" spec={{ title: "Chạy lại trận", path: `/matches/${match.id}/rerun`, description: `${match.a_name} – ${match.b_name} (${match.id})` }} />
                    <ActButton variant="quiet" label="Sửa kết quả" spec={{
                      title: "Sửa kết quả (cần admin thứ hai duyệt)", path: `/matches/${match.id}/result`, danger: true,
                      description: `${match.a_name} (Đỏ) – ${match.b_name} (Xanh)`,
                      fields: [{ name: "result", label: "Kết quả mới", kind: "select", options: [["A", "Đỏ (A) thắng"], ["B", "Xanh (B) thắng"], ["D", "Hòa"]] }],
                      bodyFrom: (values) => (values.result === "D" ? { outcome: "draw" } : { outcome: "win", winner: values.result }),
                    }} />
                  </div>],
              }))} />
          </Section>
        );
      }}
    </Loaded>
  );
}
