import { useEffect, useState } from "react";
import { Dialog } from "../ui/Dialog";
import { DEMO_NAV_GROUPS, isCurrentLink, isDemoNavEnabled } from "./demoNavLinks";
import styles from "./demoNav.module.css";

/** Set on <body> while the finals projector is open: the floating button hides there, Alt+K still opens the switcher. */
export const PROJECTOR_BODY_ATTRIBUTE = "data-ott-projector";

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

  if (!enabled) return null;
  return (
    <>
      <button type="button" className={styles.fab} onClick={() => setOpen(true)} aria-label="Chuyển trang (Alt+K)" title="Chuyển trang (Alt+K)">
        <span aria-hidden="true">🧭</span>
      </button>
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
