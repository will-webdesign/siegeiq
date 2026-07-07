/**
 * ToastStack — renders bus notifications as restrained overlay cards.
 * Deliberately plain: a left accent bar by kind, title, optional body. No
 * animation beyond a subtle fade so it never distracts during a round.
 */
import type { Toast, ToastKind } from "@/core/bus";

const ACCENT: Record<ToastKind, string> = {
  info: "var(--info)",
  success: "var(--positive)",
  warning: "var(--warning)",
  coach: "var(--accent)",
};

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="col" style={{ position: "absolute", right: 8, bottom: 8, gap: 6, width: 260, pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className="col"
          style={{
            pointerEvents: "auto",
            cursor: "pointer",
            gap: 2,
            padding: "8px 10px",
            background: "rgba(11, 13, 16, 0.94)",
            border: "1px solid var(--line-strong)",
            borderLeft: `2px solid ${ACCENT[t.kind]}`,
            borderRadius: 5,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600 }}>{t.title}</span>
          {t.body ? <span className="tiny dim">{t.body}</span> : null}
        </div>
      ))}
    </div>
  );
}
