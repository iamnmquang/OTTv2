import { useState, type FormEvent } from "react";
import { Button } from "@web/shared/ui/Button";
import { errorText } from "../api";
import { Loaded, useAdmin, useLoad } from "../admin";
import { time } from "../format";
import { ActButton, DataTable, Section } from "../components/parts";
import styles from "../admin.module.css";

interface AnnouncementRow { readonly id: string; readonly title: string; readonly body: string; readonly published_at: number | null; readonly withdrawn_at: number | null }

export function Announcements() {
  const { api, writer, notify, refresh } = useAdmin();
  const load = useLoad((client) => client.get<{ announcements: AnnouncementRow[] }>("/announcements"));
  const [draft, setDraft] = useState({ title: "", body: "", publish: false });
  const [busy, setBusy] = useState(false);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/announcements", draft);
      notify("Đã tạo thông báo.", "success");
      setDraft({ title: "", body: "", publish: false });
      refresh();
    } catch (error) {
      notify(`Tạo thông báo: ${errorText(error)}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Loaded load={load}>
      {({ announcements }) => (
        <Section title="Thông báo cho người chơi">
          {writer ? (
            <form className={styles.form} onSubmit={create} aria-label="Tạo thông báo">
              <label className={styles.field}><span>Tiêu đề</span>
                <input required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.currentTarget.value })} /></label>
              <label className={styles.field}><span>Nội dung</span>
                <textarea required rows={4} maxLength={4000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.currentTarget.value })} /></label>
              <label className={styles.check}><input type="checkbox" checked={draft.publish} onChange={(e) => setDraft({ ...draft, publish: e.currentTarget.checked })} /> Đăng ngay</label>
              <Button type="submit" disabled={busy}>Tạo thông báo</Button>
            </form>
          ) : null}
          <DataTable caption="Thông báo" headers={["Tiêu đề", "Nội dung", "Trạng thái", ""]} empty="Chưa có thông báo."
            rows={announcements.map((item) => ({
              key: item.id,
              cells: [item.title, item.body, item.withdrawn_at ? "đã gỡ" : item.published_at ? `đăng ${time(item.published_at)}` : "nháp",
                item.published_at && !item.withdrawn_at
                  ? <ActButton key="w" variant="quiet" label="Gỡ" spec={{ title: `Gỡ thông báo “${item.title}”`, path: `/announcements/${item.id}/withdraw`, needsReason: false }} />
                  : <ActButton key="p" label="Đăng" spec={{ title: `Đăng thông báo “${item.title}”`, path: `/announcements/${item.id}/publish`, needsReason: false }} />],
            }))} />
        </Section>
      )}
    </Loaded>
  );
}
