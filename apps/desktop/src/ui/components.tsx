import type { ReactNode } from "react";

export function Panel(props: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`panel ${props.className ?? ""}`}>
      {props.title ? (
        <div className="spread" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
          <span className="section-title">{props.title}</span>
          {props.actions}
        </div>
      ) : null}
      <div className="panel-pad">{props.children}</div>
    </div>
  );
}

export function Pill(props: { tone?: "gold" | "green" | "red" | "blue" | "orange"; children: ReactNode }) {
  return <span className={`pill ${props.tone ?? ""}`}>{props.children}</span>;
}

export function StatusDot(props: { state: "on" | "off" | "idle" }) {
  return <span className={`dot ${props.state}`} />;
}

export function Stat(props: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="col" style={{ gap: 2 }}>
      <span className="tiny dim" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {props.label}
      </span>
      <span style={{ fontSize: 20, fontWeight: 600 }}>{props.value}</span>
      {props.sub ? <span className="tiny muted">{props.sub}</span> : null}
    </div>
  );
}

export function EmptyState(props: { title: string; children?: ReactNode }) {
  return (
    <div className="col" style={{ alignItems: "center", padding: "28px 16px", gap: 6, textAlign: "center" }}>
      <span className="muted" style={{ fontWeight: 600 }}>{props.title}</span>
      {props.children ? <span className="small dim" style={{ maxWidth: 420 }}>{props.children}</span> : null}
    </div>
  );
}
