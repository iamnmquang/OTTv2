import { useState } from "react";
import { Button } from "@web/shared/ui/Button";
import { Loaded, useLoad } from "../admin";
import { TEAM_KIND, TEAM_STATUS, time } from "../format";
import { ActButton, Code, DataTable, Section, Tag } from "../components/parts";
import styles from "../admin.module.css";

interface TeamRow {
  readonly id: string; readonly handle: string; readonly display_name: string; readonly kind: string; readonly status: string;
  readonly disqualified_at: number | null; readonly members: number; readonly submissions: number;
}
interface TeamDetail {
  readonly team: { readonly display_name: string; readonly handle: string; readonly disqualified_at: number | null; readonly dq_reason: string | null };
  readonly members: ReadonlyArray<{ readonly mssv: string; readonly full_name: string; readonly email: string; readonly role: string; readonly status: string }>;
  readonly submissions: ReadonlyArray<{ readonly id: string; readonly seq: number; readonly language: string; readonly status: string; readonly sha256: string; readonly created_at: number }>;
  readonly finalSubmissionId: string | null;
}

export function Teams() {
  const load = useLoad((api) => api.get<{ teams: TeamRow[] }>("/teams"));
  const [filter, setFilter] = useState({ q: "", kind: "", status: "" });
  const [open, setOpen] = useState<string | null>(null);

  const matches = (team: TeamRow) => {
    if (filter.kind && team.kind !== filter.kind) return false;
    if (filter.status === "disqualified" ? !team.disqualified_at : filter.status && (team.status !== filter.status || team.disqualified_at)) return false;
    const needle = filter.q.trim().toLowerCase();
    return !needle || `${team.handle} ${team.display_name}`.toLowerCase().includes(needle);
  };

  return (
    <Loaded load={load}>
      {({ teams }) => {
        const shown = teams.filter(matches);
        return (
          <>
            <Section title={`Đội (${shown.length}/${teams.length})`} actions={<a className={styles.linkButton} href="/admin-api/export/teams.csv">Xuất CSV (có dữ liệu cá nhân, được ghi audit)</a>}>
              <div className={styles.toolbar}>
                <label className={styles.field}><span>Tìm</span>
                  <input type="search" value={filter.q} placeholder="Tên đội hoặc tên đăng nhập" onChange={(e) => setFilter({ ...filter, q: e.currentTarget.value })} /></label>
                <label className={styles.field}><span>Loại</span>
                  <select value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.currentTarget.value })}>
                    <option value="">Tất cả</option>
                    {Object.entries(TEAM_KIND).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select></label>
                <label className={styles.field}><span>Trạng thái</span>
                  <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.currentTarget.value })}>
                    <option value="">Tất cả</option>
                    {Object.entries(TEAM_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    <option value="disqualified">bị loại</option>
                  </select></label>
              </div>
              <DataTable caption="Đội" headers={["Tên đăng nhập", "Tên đội", "Loại", "Trạng thái", "TV", "Bài", ""]}
                rows={shown.map((team) => ({
                  key: team.id,
                  current: open === team.id,
                  cells: [team.handle, team.display_name, TEAM_KIND[team.kind] ?? team.kind,
                    team.disqualified_at ? <Tag key="s" status="danger">bị loại</Tag> : <Tag key="s" status={team.status === "active" ? "success" : "warning"}>{TEAM_STATUS[team.status] ?? team.status}</Tag>,
                    team.members, team.submissions,
                    <div className={styles.actions} key="a">
                      <Button variant="quiet" aria-pressed={open === team.id} onClick={() => setOpen(open === team.id ? null : team.id)}>Chi tiết</Button>
                      <ActButton variant="quiet" label="Đổi tên" spec={{
                        title: `Đổi tên đội ${team.display_name}`, path: `/teams/${team.id}/rename`,
                        fields: [{ name: "displayName", label: "Tên đội mới", initial: team.display_name }], bodyFrom: (values) => ({ displayName: values.displayName.trim() }),
                      }} />
                      {team.disqualified_at ? null : <ActButton variant="danger" label="Loại đội" spec={{
                        title: "Loại đội (cần admin thứ hai duyệt)", path: `/teams/${team.id}/disqualify`, danger: true, description: `Đề nghị loại đội ${team.display_name}.`,
                      }} />}
                    </div>],
                }))} />
            </Section>
            {open ? <TeamDetailView id={open} /> : null}
          </>
        );
      }}
    </Loaded>
  );
}

function TeamDetailView({ id }: { readonly id: string }) {
  const load = useLoad((api) => api.get<TeamDetail>(`/teams/${id}`), [id]);
  return (
    <Loaded load={load}>
      {(data) => (
        <Section title={`${data.team.display_name} (${data.team.handle})`}>
          {data.team.disqualified_at ? <p><Tag status="danger">Đã bị loại</Tag> {data.team.dq_reason}</p> : null}
          <DataTable caption="Thành viên" headers={["MSSV", "Họ tên", "Email", "Vai trò", "Trạng thái", ""]}
            rows={data.members.map((member) => ({
              key: member.mssv,
              cells: [member.mssv, member.full_name, member.email, member.role, member.status,
                member.status === "pending" ? <ActButton key="c" variant="quiet" label="Xác minh tay" spec={{ title: `Xác minh thủ công ${member.mssv}`, path: `/teams/${id}/members/${member.mssv}/confirm` }} /> : null],
            }))} />
          <h3>Bài nộp</h3>
          <DataTable caption="Bài nộp của đội" headers={["Bản", "Ngôn ngữ", "Trạng thái", "SHA-256", "Nộp lúc"]}
            rows={data.submissions.map((s) => ({
              key: s.id,
              cells: [`v${s.seq}${s.id === data.finalSubmissionId ? " ★" : ""}`, s.language, s.status, <Code key="s" value={s.sha256} />, time(s.created_at)],
            }))} />
        </Section>
      )}
    </Loaded>
  );
}
