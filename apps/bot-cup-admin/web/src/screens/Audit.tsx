import { useState } from "react";
import { Loaded, useLoad } from "../admin";
import { short, time } from "../format";
import { Code, DataTable, Section, Tag } from "../components/parts";
import styles from "../admin.module.css";

interface AuditRow { readonly seq: number; readonly at: number; readonly actor_email: string; readonly action: string; readonly target: string | null; readonly reason: string | null; readonly hash: string }
type Verify = { readonly ok: true; readonly rows: number; readonly head: string } | { readonly ok: false; readonly seq: number; readonly error: string };

export function Audit() {
  const load = useLoad(async (api) => {
    const [log, check] = await Promise.all([api.get<{ rows: AuditRow[] }>("/audit"), api.get<Verify>("/audit/verify")]);
    return { rows: log.rows, check };
  });
  const [query, setQuery] = useState("");
  return (
    <Loaded load={load}>
      {({ rows, check }) => {
        const needle = query.trim().toLowerCase();
        const shown = rows.filter((row) => !needle || `${row.actor_email} ${row.action} ${row.target ?? ""} ${row.reason ?? ""}`.toLowerCase().includes(needle));
        return (
          <Section title="Audit log" actions={
            <label className={styles.field} data-inline="true"><span>Tìm</span><input type="search" value={query} placeholder="Người, việc, đối tượng" onChange={(e) => setQuery(e.currentTarget.value)} /></label>
          }>
            <p>{check.ok
              ? <Tag status="success">Chuỗi băm hợp lệ · {check.rows} dòng · đầu chuỗi {short(check.head, 16)}</Tag>
              : <Tag status="danger">Chuỗi băm SAI ở dòng {check.seq} ({check.error})</Tag>}</p>
            <DataTable caption="Audit log" headers={["#", "Lúc", "Ai", "Việc", "Đối tượng", "Lý do", "Hash"]}
              rows={shown.map((row) => ({
                key: String(row.seq),
                cells: [row.seq, time(row.at), row.actor_email, row.action, row.target ?? "", row.reason ?? "", <Code key="h" value={row.hash} n={12} />],
              }))} />
          </Section>
        );
      }}
    </Loaded>
  );
}
