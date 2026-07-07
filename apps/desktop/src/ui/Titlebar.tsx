/** Frameless-window titlebar: drag region + window controls. */
import { Minus, Square, X } from "lucide-react";
import { closeCurrent, dragMoveCurrent, maximizeOrRestoreCurrent, minimizeCurrent } from "@/lib/ow/windows";

export function Titlebar({ compact }: { compact?: boolean }) {
  return (
    <div
      className="spread"
      style={{
        height: compact ? 30 : 36,
        padding: "0 4px 0 12px",
        borderBottom: "1px solid var(--line)",
        background: "var(--bg-1)",
        flexShrink: 0,
      }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        dragMoveCurrent();
      }}
    >
      <div className="row" style={{ gap: 8 }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.02em" }}>
          SIEGE<span style={{ color: "var(--accent)" }}>IQ</span>
        </span>
        {compact ? null : <span className="tiny dim">Rainbow Six improvement coach</span>}
      </div>
      <div className="row" style={{ gap: 2 }}>
        <button className="ghost" aria-label="Minimize" onClick={() => void minimizeCurrent()}>
          <Minus size={13} />
        </button>
        {compact ? null : (
          <button className="ghost" aria-label="Maximize" onClick={() => void maximizeOrRestoreCurrent()}>
            <Square size={11} />
          </button>
        )}
        <button className="ghost" aria-label="Close" onClick={() => void closeCurrent()}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
