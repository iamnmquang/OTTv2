import { useState } from "react";
import { Button } from "@web/shared/ui/Button";
import { errorText } from "../api";
import { Loaded, useAdmin, useLoad } from "../admin";
import { percent, short, time } from "../format";
import { ActButton, Code, DataTable, Section, Tag } from "../components/parts";
import styles from "../admin.module.css";

interface FlagRow {
  readonly id: string; readonly kind: string; readonly status: string; readonly score: number | null; readonly details: string | null;
  readonly team_name: string; readonly seq: number; readonly submission_id: string; readonly other_submission_id: string | null;
  readonly other_team_name: string | null; readonly other_seq: number | null; readonly reference: string | null; readonly notified_at: number | null;
}
interface ProbeSet { readonly probe_set: string; readonly jobs: number; readonly done: number; readonly pending: number; readonly failed: number; readonly fingerprints: number; readonly started_at: number }
interface Anomaly {
  readonly kind: string; readonly team: string; readonly teamName: string; readonly opponent: string; readonly opponentName: string;
  readonly ratio?: number; readonly compared?: number; readonly matchId?: string; readonly stage?: string; readonly reason?: string; readonly plies?: number;
  readonly shareElsewhere?: number; readonly gamesElsewhere?: number; readonly practiceRate?: number; readonly opponentPracticeRate?: number; readonly share?: number; readonly games?: number;
}

const KIND: Readonly<Record<string, string>> = { hash: "Trùng chuẩn hóa", jplag: "JPlag", behavior: "Vân tay hành vi", collusion: "Thông đồng" };
const STATUS: ReadonlyArray<readonly [string, string]> = [["open", "Đang mở"], ["confirmed", "Đã xác nhận"], ["cleared", "Đã bỏ"]];
const ANOMALY: Readonly<Record<string, string>> = { behaviour_twin: "Vân tay gần trùng", thrown_game: "Thua bất thường", practice_upset: "Lệch phong độ luyện tập" };

const detailsOf = (flag: FlagRow): Record<string, unknown> => {
  try {
    return JSON.parse(flag.details || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
};

function evidence(flag: FlagRow): string {
  const details = detailsOf(flag);
  if (flag.kind === "behavior") return `${details.same}/${details.compared} thế cờ giống nhau`;
  if (flag.kind === "jplag") return `${details.tool || "JPlag"} · ${details.language || ""} · max ${percent(details.max as number)}`;
  if (flag.kind === "collusion") return String(details.note ?? "");
  return "Mã giống hệt sau khi bỏ chú thích, khoảng trắng và đổi tên";
}

function anomalyDetail(row: Anomaly): string {
  if (row.kind === "behaviour_twin") return `${percent(row.ratio)} trên ${row.compared} thế cờ`;
  if (row.kind === "thrown_game") return `Trận ${row.matchId} (${row.stage}): thua do ${row.reason} sau ${row.plies} nước; với đối thủ khác đạt ${percent(row.shareElsewhere)} điểm (${row.gamesElsewhere} ván)`;
  return `Luyện tập ${percent(row.practiceRate)} so với ${percent(row.opponentPracticeRate)}, nhưng chỉ lấy ${percent(row.share)} điểm cặp này (${row.games} ván)`;
}

export function Flags() {
  const { api, act, notify, writer } = useAdmin();
  const [status, setStatus] = useState("open");
  const load = useLoad(async (client) => {
    const [flags, probes, anomalies] = await Promise.all([
      client.get<{ flags: FlagRow[] }>(`/flags?status=${status}`),
      client.get<{ sets: ProbeSet[] }>("/anticheat/probes"),
      client.get<{ rows: Anomaly[]; probeSet: string | null }>("/anticheat/anomalies"),
    ]);
    return { flags: flags.flags, sets: probes.sets, anomalies };
  }, [status]);
  const [compare, setCompare] = useState<{ readonly title: string; readonly left: string; readonly right: string } | null>(null);
  const [probeSet, setProbeSet] = useState("");
  const [probeScope, setProbeScope] = useState("sealed");

  const showCode = async (flag: FlagRow) => {
    try {
      const left = await api.get<string>(`/submissions/${flag.submission_id}/source`);
      const right = flag.other_submission_id ? await api.get<string>(`/submissions/${flag.other_submission_id}/source`) : `Kho tham chiếu công khai: ${flag.reference}`;
      const other = flag.other_team_name ? `${flag.other_team_name} v${flag.other_seq}` : flag.reference;
      setCompare({ title: `So sánh: ${flag.team_name} v${flag.seq} ↔ ${other}`, left, right });
    } catch (error) {
      notify(`Xem mã: ${errorText(error)}`, "error");
    }
  };

  const importJplag = async (file: File | undefined) => {
    if (!file) return;
    let report: unknown;
    try {
      report = JSON.parse(await file.text());
    } catch {
      return notify("File không phải JSON.", "error");
    }
    act({ title: "Nhập báo cáo JPlag", path: "/anticheat/jplag", body: { report }, defaultReason: "JPlag sau khóa code", description: `${file.name}: cặp ≥ 70% thành cờ, ≥ 85% đánh dấu ưu tiên.` });
  };

  const queueProbes = () => {
    if (!/^[0-9a-f]{64}$/.test(probeSet.trim())) return notify("SHA-256 phải gồm 64 ký tự 0-9 a-f.", "error");
    act({ title: "Xếp job vân tay hành vi", path: "/anticheat/probes", body: { probeSet: probeSet.trim(), scope: probeScope } });
  };

  return (
    <Loaded load={load}>
      {({ flags, sets, anomalies }) => (
        <>
          <Section title={`Cờ nghi vấn (${flags.length})`}>
            <p className={styles.muted}>Cờ chỉ là nghi vấn. Quy trình: hai BTC xem mã và replay → báo đội, cho 48 giờ giải trình → quyết định có lý do. Xác nhận vi phạm cần admin thứ hai duyệt ở tab Chờ duyệt.</p>
            <div className={styles.segmented} role="group" aria-label="Lọc cờ theo trạng thái">
              {STATUS.map(([value, label]) => <button key={value} type="button" aria-pressed={value === status} onClick={() => setStatus(value)}>{label}</button>)}
            </div>
            <DataTable caption="Cờ nghi vấn" headers={["Loại", "Đội", "Trùng với", "Mức giống", "Bằng chứng", "Báo đội", ""]} empty="Không có cờ."
              rows={flags.map((flag) => ({
                key: flag.id,
                cells: [KIND[flag.kind] ?? flag.kind, `${flag.team_name} v${flag.seq}`,
                  flag.reference ? <Code key="r" value={flag.reference} /> : `${flag.other_team_name} v${flag.other_seq}`,
                  <span key="p">{percent(flag.score)}{detailsOf(flag).priority ? <> <Tag status="danger">ưu tiên</Tag></> : null}</span>,
                  evidence(flag),
                  flag.notified_at ? `${time(flag.notified_at)} · hạn giải trình ${time(flag.notified_at + 48 * 3600 * 1000)}` : "chưa",
                  <div className={styles.actions} key="a">
                    <Button variant="quiet" onClick={() => void showCode(flag)}>Xem mã</Button>
                    {flag.notified_at ? null : <ActButton variant="quiet" label="Đã báo đội" spec={{ title: "Đã báo đội (bắt đầu 48 giờ giải trình)", path: `/flags/${flag.id}/notify` }} />}
                    {flag.status === "open" ? <ActButton variant="quiet" label="Bỏ cờ" spec={{ title: "Bỏ cờ", path: `/flags/${flag.id}`, body: { status: "cleared" } }} /> : null}
                    {flag.status === "open" ? <ActButton variant="danger" label="Xác nhận vi phạm" spec={{ title: "Xác nhận vi phạm (cần admin thứ hai duyệt)", path: `/flags/${flag.id}`, body: { status: "confirmed" }, danger: true }} /> : null}
                  </div>],
              }))} />
          </Section>
          {compare ? (
            <Section title={compare.title} actions={<Button variant="quiet" onClick={() => setCompare(null)}>Đóng</Button>}>
              <div className={styles.compare}><pre className={styles.source}>{compare.left}</pre><pre className={styles.source}>{compare.right}</pre></div>
            </Section>
          ) : null}
          <Section title="JPlag (so mã cùng ngôn ngữ)">
            <ol>
              <li>Tải gói mã: <a href="/admin-api/anticheat/export?scope=sealed">bài niêm phong</a> · <a href="/admin-api/anticheat/export?scope=final">bản thi đấu hiện tại</a> (có ghi audit).</li>
              <li>Trên máy BTC: <code>npm run bot-cup:similarity -- --bundle &lt;file vừa tải&gt;</code></li>
              <li>Nhập report.json: cặp ≥ 70% thành cờ, ≥ 85% đánh dấu ưu tiên.</li>
            </ol>
            {writer ? (
              <label className={styles.field}><span>Báo cáo JPlag (report.json)</span>
                <input type="file" accept="application/json,.json" onChange={(event) => { void importJplag(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
            ) : null}
          </Section>
          <Section title="Vân tay hành vi (bắt cả bản dịch sang ngôn ngữ khác)">
            <p className={styles.muted}>Bộ thế cờ bí mật chỉ nằm trên máy runner (<code>npm run bot-cup:probe-set</code>); ở đây chỉ nhập SHA-256 của file. Runner cho từng bot và ai.js easy/medium/hard chọn nước; ≥ 90% nước giống nhau thì gắn cờ.</p>
            {writer ? (
              <div className={styles.toolbar}>
                <label className={styles.field}><span>SHA-256 bộ thế cờ</span><input value={probeSet} size={66} placeholder="64 ký tự hex" onChange={(e) => setProbeSet(e.currentTarget.value)} /></label>
                <label className={styles.field}><span>Phạm vi</span>
                  <select value={probeScope} onChange={(e) => setProbeScope(e.currentTarget.value)}><option value="sealed">Bài niêm phong</option><option value="final">Bản thi đấu hiện tại</option></select></label>
                <Button onClick={queueProbes}>Xếp job vân tay</Button>
              </div>
            ) : null}
            <DataTable caption="Bộ thế cờ" headers={["Bộ thế cờ", "Job", "Xong", "Đang chờ", "Lỗi", "Vân tay", "Bắt đầu"]} empty="Chưa xếp job vân tay nào."
              rows={sets.map((set) => ({
                key: set.probe_set,
                cells: [<Code key="p" value={set.probe_set} n={12} />, set.jobs, set.done, set.pending, set.failed ? <Tag key="f" status="danger">{set.failed}</Tag> : "0", set.fingerprints, time(set.started_at)],
              }))} />
          </Section>
          <Section title="Bất thường kết quả">
            <p className={styles.muted}>Gợi ý để xem replay, không phải kết luận. Vân tay theo bộ {anomalies.probeSet ? short(anomalies.probeSet, 12) : "— (chưa có)"}.</p>
            <DataTable caption="Bất thường" headers={["Loại", "Đội", "Đối thủ", "Chi tiết", ""]} empty="Không thấy bất thường."
              rows={anomalies.rows.map((row, index) => ({
                key: `${row.kind}-${row.team}-${row.opponent}-${index}`,
                cells: [ANOMALY[row.kind] ?? row.kind, row.teamName, row.opponentName, anomalyDetail(row),
                  <ActButton key="c" variant="quiet" label="Gắn cờ thông đồng" spec={{
                    title: "Gắn cờ thông đồng", path: "/anticheat/collusion",
                    body: { teamId: row.team, opponentId: row.opponent, note: `${ANOMALY[row.kind]}: ${anomalyDetail(row)}` },
                  }} />],
              }))} />
          </Section>
        </>
      )}
    </Loaded>
  );
}
