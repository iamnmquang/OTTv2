import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@web/shared/ui/Button";
import { Dialog } from "@web/shared/ui/Dialog";
import { errorText } from "../api";
import type { ActionSpec } from "../admin";
import styles from "../admin.module.css";

type Preview = { readonly status: "loading" } | { readonly status: "ready"; readonly lines: readonly string[] } | { readonly status: "refused"; readonly message: string };

/**
 * Confirms a write (replaces window.prompt/confirm of the old page): the preview of what will happen, the inputs, and the
 * reason that goes into the audit log. A preview the server refuses (e.g. games still pending) blocks the action.
 */
export function ActionDialog({ spec, busy, onCancel, onConfirm }: {
  readonly spec: ActionSpec;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (body: Record<string, unknown>) => void;
}) {
  const id = useId();
  const needsReason = spec.needsReason ?? true;
  const [reason, setReason] = useState(spec.defaultReason ?? "");
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries((spec.fields ?? []).map((field) => [field.name, field.initial ?? field.options?.[0]?.[0] ?? ""])));
  const [preview, setPreview] = useState<Preview | null>(spec.preview ? { status: "loading" } : null);

  useEffect(() => {
    if (!spec.preview) return;
    let live = true;
    spec.preview().then(
      (lines) => { if (live) setPreview({ status: "ready", lines }); },
      (error) => { if (live) setPreview({ status: "refused", message: errorText(error) }); },
    );
    return () => { live = false; };
  }, [spec]);

  const reasonOk = !needsReason || reason.trim().length >= 3;
  const fieldsOk = (spec.fields ?? []).every((field) => values[field.name]?.trim());
  const blocked = preview?.status === "loading" || preview?.status === "refused";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!reasonOk || !fieldsOk || blocked || busy) return;
    const body = { ...(spec.body ?? {}), ...(spec.bodyFrom ? spec.bodyFrom(values) : {}) };
    onConfirm(needsReason ? { ...body, reason: reason.trim() } : body);
  };

  return (
    <Dialog open title={spec.title} closeLabel="Đóng" onClose={onCancel} className={styles.dialog}>
      <form className={styles.dialogBody} onSubmit={submit} aria-label={spec.title}>
        {spec.description ? <p>{spec.description}</p> : null}
        {preview ? (
          <section className={styles.preview} aria-label="Xem trước">
            <h3>Xem trước</h3>
            {preview.status === "loading" ? <p className={styles.muted} role="status">Đang kiểm tra với máy chủ…</p> : null}
            {preview.status === "refused" ? <p className={styles.error} role="alert">Chưa làm được: {preview.message}</p> : null}
            {preview.status === "ready" ? (
              preview.lines.length ? <ul>{preview.lines.map((line) => <li key={line}>{line}</li>)}</ul> : <p className={styles.muted}>Không có thông tin thêm.</p>
            ) : null}
          </section>
        ) : null}
        {(spec.fields ?? []).map((field) => (
          <label key={field.name} className={styles.field}>
            <span>{field.label}</span>
            {field.kind === "select" ? (
              <select value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.currentTarget.value })}>
                {field.options?.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            ) : (
              <input value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.currentTarget.value })} />
            )}
          </label>
        ))}
        {needsReason ? (
          <label className={styles.field}>
            <span>Lý do (ghi vào audit log)</span>
            <textarea id={`${id}-reason`} rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.currentTarget.value)} />
          </label>
        ) : null}
        <div className={styles.dialogActions}>
          <Button variant="secondary" onClick={onCancel}>Huỷ</Button>
          <Button type="submit" variant={spec.danger ? "danger" : "primary"} disabled={!reasonOk || !fieldsOk || blocked || busy}>
            {busy ? "Đang gửi…" : "Xác nhận"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
