import { useEffect, useState, type ReactNode } from "react";
import { Badge, type BadgeStatus } from "@web/shared/ui/Badge";
import { Button } from "@web/shared/ui/Button";
import { useAdmin, type ActionSpec } from "../admin";
import styles from "../admin.module.css";

const PAGE = 50;

/** A table with a page of 50 rows at a time (100 teams, hundreds of games). */
export function DataTable({ caption, headers, rows, empty = "Không có dữ liệu." }: {
  readonly caption: string;
  readonly headers: readonly string[];
  readonly rows: ReadonlyArray<{ readonly key: string; readonly cells: readonly ReactNode[]; readonly current?: boolean }>;
  readonly empty?: string;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  useEffect(() => { if (page >= pages) setPage(pages - 1); }, [page, pages]);
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div className={styles.tableBlock}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.visuallyHidden}>{caption}</caption>
          <thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`} scope="col">{header}</th>)}</tr></thead>
          <tbody>
            {shown.length ? shown.map((row) => (
              <tr key={row.key} aria-current={row.current ? "true" : undefined}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>
            )) : <tr><td colSpan={headers.length} className={styles.muted}>{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav className={styles.pager} aria-label={`Trang của bảng ${caption}`}>
          <Button variant="quiet" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
          <span>Trang {page + 1}/{pages} · {rows.length} dòng</span>
          <Button variant="quiet" disabled={page === pages - 1} onClick={() => setPage(page + 1)}>Sau</Button>
        </nav>
      ) : null}
    </div>
  );
}

export function Section({ title, actions, children }: { readonly title: ReactNode; readonly actions?: ReactNode; readonly children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2>{title}</h2>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Tag({ status = "neutral", children }: { readonly status?: BadgeStatus; readonly children: ReactNode }) {
  return <Badge status={status}>{children}</Badge>;
}

/** A button that opens the confirmation dialog for a write; hidden for read-only accounts. */
export function ActButton({ spec, label, variant = "secondary" }: { readonly spec: ActionSpec; readonly label: string; readonly variant?: "primary" | "secondary" | "quiet" | "danger" }) {
  const { act, writer } = useAdmin();
  if (!writer) return null;
  return <Button variant={variant} onClick={() => act(spec)}>{label}</Button>;
}

export function StatCard({ label, value, alert = false, onOpen }: { readonly label: string; readonly value: number; readonly alert?: boolean; readonly onOpen?: () => void }) {
  const body = <><strong>{value}</strong><span>{label}</span></>;
  const tone = alert ? (value ? "alert" : "quiet") : undefined;
  return onOpen
    ? <button type="button" className={styles.card} data-tone={tone} onClick={onOpen}>{body}</button>
    : <div className={styles.card} data-tone={tone}>{body}</div>;
}

export function Code({ value, n }: { readonly value: string | null | undefined; readonly n?: number }) {
  return <code className={styles.code} title={value ?? ""}>{n ? (value ? value.slice(0, n) : "—") : value ?? "—"}</code>;
}
