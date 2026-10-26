import { useState } from "react";
import { Button } from "@web/shared/ui/Button";
import { errorText } from "../api";
import { Loaded, useAdmin, useLoad } from "../admin";
import { time } from "../format";
import { ActButton, Code, DataTable, Section, Tag } from "../components/parts";
import styles from "../admin.module.css";

interface SubmissionRow {
  readonly id: string; readonly display_name: string; readonly seq: number; readonly filename: string; readonly status: string;
  readonly open_flags: number; readonly sha256: string; readonly created_at: number;
}

export function Submissions() {
  const { api, notify } = useAdmin();
  const load = useLoad((client) => client.get<{ submissions: SubmissionRow[] }>("/submissions"));
  const [source, setSource] = useState<{ readonly title: string; readonly text: string } | null>(null);
  const [query, setQuery] = useState("");

  const view = async (row: SubmissionRow) => {
    try {
      setSource({ title: `${row.display_name} v${row.seq} — ${row.filename}`, text: await api.get<string>(`/submissions/${row.id}/source`) });
    } catch (error) {
      notify(`Xem mã: ${errorText(error)}`, "error");
    }
  };

  return (
    <Loaded load={load}>
      {({ submissions }) => {
        const needle = query.trim().toLowerCase();
        const shown = submissions.filter((row) => !needle || `${row.display_name} ${row.filename} ${row.sha256}`.toLowerCase().includes(needle));
        return (
          <>
            <Section title={`Bài nộp (${submissions.length} gần nhất)`} actions={
              <label className={styles.field} data-inline="true"><span>Tìm</span><input type="search" value={query} placeholder="Đội, file, SHA-256" onChange={(e) => setQuery(e.currentTarget.value)} /></label>
            }>
              <DataTable caption="Bài nộp" headers={["Đội", "Bản", "File", "Trạng thái", "Cờ", "SHA-256", "Nộp lúc", ""]}
                rows={shown.map((row) => ({
                  key: row.id,
                  cells: [row.display_name, `v${row.seq}`, row.filename, row.status,
                    row.open_flags ? <Tag key="f" status="danger">{row.open_flags}</Tag> : "0",
                    <Code key="s" value={row.sha256} n={12} />, time(row.created_at),
                    <div className={styles.actions} key="a">
                      <Button variant="quiet" onClick={() => void view(row)}>Xem mã</Button>
                      <ActButton variant="quiet" label="Kiểm tra lại" spec={{ title: "Kiểm tra lại bài nộp", path: `/submissions/${row.id}/recheck`, description: `${row.display_name} v${row.seq}` }} />
                    </div>],
                }))} />
            </Section>
            {source ? (
              <Section title={source.title} actions={<Button variant="quiet" onClick={() => setSource(null)}>Đóng</Button>}>
                <pre className={styles.source}>{source.text}</pre>
              </Section>
            ) : null}
          </>
        );
      }}
    </Loaded>
  );
}
