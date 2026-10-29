import { useEffect, useState } from "react";
import { Dialog } from "../ui/Dialog";
import { DEMO_NAV_GROUPS, isCurrentLink, isDemoNavEnabled } from "./demoNavLinks";
import styles from "./demoNav.module.css";

/** Set on <body> while the finals projector is open: the floating button hides there, Alt+K still opens the switcher. */
export const PROJECTOR_BODY_ATTRIBUTE = "data-ott-projector";

/** Remembers, per origin, that the visitor has found the switcher, so the pointer bubble stops showing. */
export const HINT_STORAGE_KEY = "ott:demo-nav-hint-dismissed";

function readHintDismissed(): boolean {
  try {
    return window.localStorage.getItem(HINT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeHintDismissed(): void {
  try {
    window.localStorage.setItem(HINT_STORAGE_KEY, "true");
  } catch {
    // Storage blocked: the bubble simply shows again next visit.
  }
}

export interface DemoNavProps {
  /** Defaults to window.location; tests pass their own. */
  readonly place?: Pick<Location, "origin" | "search">;
  readonly env?: { readonly [key: string]: unknown };
}

/**
 * Page switcher for the demo environments (plan 2026-10-27-demo-nav): a floating button and Alt+K open a list of every
 * demo page, so the presenter never copies a link. Mounted beside the app root, it knows nothing of games or sessions.
 */
export function DemoNav({ place, env = import.meta.env }: DemoNavProps) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(() => !readHintDismissed());
  const here = place ?? window.location;
  const enabled = isDemoNavEnabled(here, env);

  useEffect(() => {
    if (!enabled) return;
    function onKey(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== "KeyK") return;
      event.preventDefault();
      setOpen((value) => !value);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  useEffect(() => {
    if (open && hint) {
      setHint(false);
      writeHintDismissed();
    }
  }, [open, hint]);

  if (!enabled) return null;
  const dismissHint = () => {
    setHint(false);
    writeHintDismissed();
  };
  return (
    <>
      <div className={styles.dock}>
        {hint ? (
          <div className={styles.pointer} role="note">
            <span>Bấm vào đây để xem các trang demo</span>
            <button type="button" className={styles.pointerClose} onClick={dismissHint} aria-label="Ẩn gợi ý">✕</button>
            <svg className={styles.arrow} viewBox="0 0 24 32" width="24" height="32" aria-hidden="true">
              <path d="M12 2v24M3 17l9 10 9-10" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
            </svg>
          </div>
        ) : null}
        <button type="button" className={`${styles.fab} ${hint ? styles.attention : ""}`} onClick={() => setOpen(true)}
          aria-label="Khám phá demo · Chuyển trang (Alt+K)" title="Chuyển trang (Alt+K)">
          <span aria-hidden="true">🧭</span>
          <span aria-hidden="true">Khám phá demo</span>
        </button>
      </div>
      <Dialog open={open} title="Chuyển trang" closeLabel="Đóng" onClose={() => setOpen(false)} className={styles.dialog}>
        <nav aria-label="Các trang demo" className={styles.groups}>
          {DEMO_NAV_GROUPS.map((group) => (
            <section key={group.title} className={styles.group}>
              <h3 className={styles.groupTitle}>{group.title}</h3>
              <ul className={styles.list}>
                {group.links.map((link) => {
                  const current = isCurrentLink(link.href, here);
                  return (
                    <li key={link.href}>
                      <a href={link.href} className={styles.link} aria-current={current ? "page" : undefined}>
                        <span className={styles.label}>{link.label}</span>
                        {current ? <span className={styles.here}>đang ở</span> : link.hint ? <span className={styles.hint}>{link.hint}</span> : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
        <p className={styles.footer}>Phím tắt: <kbd>Alt</kbd> + <kbd>K</kbd></p>
      </Dialog>
    </>
  );
}
