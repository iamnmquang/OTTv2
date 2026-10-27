import { useMemo, useState } from "react";
import { Button } from "@web/shared/ui/Button";
import { Loaded, useAdmin, useLoad, type ActionSpec } from "../admin";
import { PHASE_LABEL, PHASE_ORDER, describePreview, time } from "../format";
import type { StepSummary, TournamentAdminView } from "../types";
import { ActButton, Code, DataTable, Section, Tag } from "../components/parts";
import styles from "../admin.module.css";

/** The steps each phase allows, in the order the organisers press them. */
const STEPS: Readonly<Record<string, ReadonlyArray<readonly [string, string]>>> = {
  registration: [["freeze", "Khóa code và niêm phong"]],
  practice: [["freeze", "Khóa code và niêm phong"]],
  frozen: [["gate-start", "Bắt đầu vòng sơ loại"]],
  gate: [["gate-close", "Chốt vòng sơ loại"]],
  qualifying: [["qualifying-start", "Bắt đầu vòng loại"], ["swiss-next", "Tạo vòng Swiss kế tiếp"], ["qualifying-close", "Chốt vòng loại"]],
  verification: [["knockout-start", "Bắt đầu loại trực tiếp"], ["finish", "Kết thúc không cần loại trực tiếp"]],
  knockout: [["knockout-advance", "Chốt vòng loại trực tiếp hiện tại"]],
  finished: [],
};
const STAGE_LABEL: Readonly<Record<string, string>> = { sealed: "Bài niêm phong", gate: "Vòng sơ loại", qualifying: "Vòng loại", final: "Chung cuộc" };
const INTERVIEW: Readonly<Record<string, string>> = { pending: "chưa", pass: "đạt", fail: "không đạt" };

export function Tournament() {
  const { api, show, autoRun, writer } = useAdmin();
  const load = useLoad((client) => client.get<TournamentAdminView>("/tournament"));
  const [query, setQuery] = useState("");

  const stepSpec = (step: string, label: string): ActionSpec => ({
    title: label,
    path: `/tournament/${step}`,
    description: "Bước này ghi vào audit log và không hoàn tác được.",
    preview: async () => describePreview(await api.post<StepSummary>(`/tournament/${step}`, { dryRun: true })),
  });

  return (
    <Loaded load={load}>
      {(data) => <TournamentView data={data} query={query} setQuery={setQuery} stepSpec={stepSpec} openBracket={() => show("bracket")} autoRun={autoRun} writer={writer} />}
    </Loaded>
  );
}

function TournamentView({ data, query, setQuery, stepSpec, openBracket, autoRun, writer }: {
  readonly data: TournamentAdminView;
  readonly query: string;
  readonly setQuery: (value: string) => void;
  readonly stepSpec: (step: string, label: string) => ActionSpec;
  readonly openBracket: () => void;
  readonly autoRun: ReturnType<typeof useAdmin>["autoRun"];
  readonly writer: boolean;
}) {
  const at = PHASE_ORDER.indexOf((data.phase === "practice" ? "registration" : data.phase) as (typeof PHASE_ORDER)[number]);
  const steps = STEPS[data.phase] ?? [];
  const waiting = new Set(data.interviews?.waitingFor ?? []);
  const seeded = new Set(data.interviews?.seeded ?? []);
  const entrantOf = useMemo(() => new Map(data.entrants.map((entrant) => [entrant.teamId, entrant])), [data.entrants]);
  const needle = query.trim().toLowerCase();
  const entrants = data.entrants.filter((entrant) => !needle || entrant.team.toLowerCase().includes(needle));
  const openAppeals = data.appeals.filter((item) => item.status === "open").length;

  return (
    <>
      <Section title="Điều phối giải" actions={<Button variant="secondary" onClick={openBracket}>Xem nhánh đấu</Button>}>
        <ol className={styles.stepper} aria-label="Các giai đoạn">
          {PHASE_ORDER.map((phase, index) => (
            <li key={phase} data-state={index < at ? "done" : index === at ? "current" : undefined} aria-current={index === at ? "step" : undefined}>{PHASE_LABEL[phase]}</li>
          ))}
        </ol>
        <p>
          Giai đoạn: <Tag status="info">{PHASE_LABEL[data.phase] ?? data.phase}</Tag> · Chế độ {data.mode} · Nhánh loại trực tiếp {data.knockoutSize} đội · Khóa code {time(data.codeFreezeAt)}
        </p>
        {steps.length ? (
          <div className={styles.actions}>
            {steps.map(([step, label], index) => <ActButton key={step} label={label} variant={index === 0 ? "primary" : "secondary"} spec={stepSpec(step, label)} />)}
          </div>
        ) : <p className={styles.muted}>Không còn bước nào.</p>}
        <p className={styles.muted}>Mỗi bước kiểm tra giai đoạn và chờ mọi ván của giai đoạn trước kết thúc; hộp xác nhận cho xem trước bước sẽ làm gì.</p>
        {autoRun.available && data.phase !== "finished" ? (
          <div className={styles.autoRun}>
            <div>
              <strong>Tự chạy tới hết (chỉ bản demo)</strong>
              <p className={styles.muted}>Bấm bước kế tiếp mỗi khi máy chủ cho phép, cho 4 hạt giống đầu đạt phỏng vấn. Mỗi bước vẫn ghi audit với lý do “Demo: điều phối tự động”. Cần runner đang chạy.</p>
              {autoRun.running && autoRun.status ? <p role="status">{autoRun.status}</p> : null}
              {!autoRun.running && autoRun.error ? <p role="alert">Đã dừng: {autoRun.error} Bấm “Tự chạy tới hết” để chạy tiếp.</p> : null}
            </div>
            {autoRun.running
              ? <Button variant="danger" onClick={autoRun.stop}>Dừng tự chạy</Button>
              : <Button onClick={autoRun.start}>Tự chạy tới hết</Button>}
          </div>
        ) : null}
      </Section>

      {data.interviews ? (
        <Section title={`Phỏng vấn code · nhánh ${data.interviews.size} đội`}
          actions={writer && data.interviews.waitingFor.length ? (
            <ActButton label={`Đạt tất cả ${data.interviews.waitingFor.length} đội đang chờ`} spec={{
              title: `Phỏng vấn ${data.interviews.waitingFor.length} đội: đạt`, path: "/tournament/interviews",
              body: { teamIds: data.interviews.waitingFor, result: "pass" },
              description: data.interviews.waitingFor.map((id) => entrantOf.get(id)?.team ?? id).join(", "),
            }} />
          ) : null}>
          <p className={styles.muted}>Chỉ 4 hạt giống đầu phải phỏng vấn. Đội trượt được thay bằng đội kế tiếp trên bảng; hạt giống 5 trở xuống vào thẳng nhánh.</p>
          <DataTable caption="Phỏng vấn" headers={["Hạng", "Đội", "Điểm", "Trạng thái", ""]}
            rows={data.standings.rows.slice(0, Math.max(data.interviews.size + 4, 8)).map((row) => {
              const entrant = entrantOf.get(row.teamId);
              const state = waiting.has(row.teamId) ? <Tag status="warning">cần phỏng vấn</Tag>
                : seeded.has(row.teamId) ? <Tag status="success">vào nhánh{entrant?.interview === "pass" ? " · đạt phỏng vấn" : ""}</Tag>
                : entrant?.interview === "fail" ? <Tag status="danger">không đạt</Tag> : <span className={styles.muted}>ngoài nhánh</span>;
              return {
                key: row.teamId,
                cells: [row.rank, row.displayName, row.points, state, (
                  <div className={styles.actions} key="a">
                    <ActButton variant="quiet" label="Đạt" spec={{ title: `Phỏng vấn ${row.displayName}: đạt`, path: "/tournament/interview", body: { teamId: row.teamId, result: "pass" } }} />
                    <ActButton variant="danger" label="Không đạt" spec={{ title: `Phỏng vấn ${row.displayName}: không đạt`, path: "/tournament/interview", body: { teamId: row.teamId, result: "fail" }, danger: true }} />
                  </div>
                )],
              };
            })} />
        </Section>
      ) : null}

      {data.gateProgress.length && data.phase === "gate" ? (
        <Section title="Tiến độ sơ loại">
          <DataTable caption="Tiến độ sơ loại" headers={["Đội", "Đã chơi", "Kết quả"]} rows={data.gateProgress.map((row) => ({
            key: row.team,
            cells: [row.team, `${row.played}/6`, row.verdict ? `${row.verdict.points} điểm · ${row.verdict.status === "qualified" ? "đạt" : "không đạt"}` : "đang chơi"],
          }))} />
        </Section>
      ) : null}

      <Section title={`Bài niêm phong (${data.entrants.length})`} actions={
        <label className={styles.field} data-inline="true"><span>Tìm đội</span><input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>
      }>
        <DataTable caption="Bài niêm phong" headers={["Đội", "Bản", "Ngôn ngữ", "SHA-256", "Sơ loại", "Hạt giống", "Phỏng vấn"]} empty="Chưa khóa code."
          rows={entrants.map((entrant) => ({
            key: entrant.teamId,
            cells: [
              <span key="t">{entrant.team}{entrant.disqualified ? <> <Tag status="danger">bị loại</Tag></> : null}</span>,
              entrant.version, entrant.language, <Code key="s" value={entrant.sha256} n={16} />,
              entrant.gatePoints === null ? "—" : `${entrant.gatePoints} điểm · ${entrant.gateStatus === "qualified" ? "đạt" : "không đạt"}`,
              entrant.seed ?? "—", INTERVIEW[entrant.interview] ?? entrant.interview,
            ],
          }))} />
      </Section>

      <Section title="Kết quả đã công bố">
        <DataTable caption="Kết quả đã công bố" headers={["Giai đoạn", "SHA-256", "Lúc", ""]} empty="Chưa công bố tài liệu nào."
          rows={data.documents.map((doc) => ({
            key: doc.stage,
            cells: [STAGE_LABEL[doc.stage] ?? doc.stage, <Code key="s" value={doc.sha256} />, time(doc.published_at),
              <a key="a" href={`/admin-api/tournament/results/${doc.stage}`} target="_blank" rel="noopener noreferrer">Tải JSON</a>],
          }))} />
      </Section>

      <Section title={`Khiếu nại (${openAppeals} chưa trả lời)`}>
        <DataTable caption="Khiếu nại" headers={["Đội", "Giai đoạn", "Nội dung", "Lúc", "Trả lời", ""]} empty="Chưa có khiếu nại."
          rows={data.appeals.map((item) => ({
            key: item.id,
            cells: [item.display_name, STAGE_LABEL[item.stage] ?? item.stage, item.body, time(item.created_at),
              item.response ? `${item.response} · ${item.answered_by}` : <Tag key="w" status="warning">chưa trả lời</Tag>,
              item.status === "open" ? <ActButton key="r" variant="quiet" label="Trả lời" spec={{
                title: `Trả lời khiếu nại của ${item.display_name}`, path: `/tournament/appeals/${item.id}/answer`, needsReason: false,
                description: item.body, fields: [{ name: "response", label: "Câu trả lời (gửi cho đội)" }], bodyFrom: (values) => ({ response: values.response }),
              }} /> : null],
          }))} />
      </Section>
    </>
  );
}
