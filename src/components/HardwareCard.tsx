// src/components/HardwareCard.tsx
// Thay 12 props phẳng bằng API rõ ràng: variant quyết định visual weight.
import type { ReactNode } from "react";
import type { Tone } from "../types";
import { clampPct } from "../lib/format";

export interface Stat {
  label: string;
  value: string;
  tone?: Tone;
}

interface Props {
  icon: ReactNode;
  title: string;
  subtitle: string;
  variant?: "primary" | "secondary";
  className?: string;
  primary: string;
  unit?: string;
  caption: string;
  meter: number;
  meterTone: Tone;
  stats: Stat[];
  offline?: boolean;
  offlineTitle?: string;
  offlineHint?: string;
}

export default function HardwareCard({
  icon,
  title,
  subtitle,
  variant = "secondary",
  className = "",
  primary,
  unit,
  caption,
  meter,
  meterTone,
  stats,
  offline,
  offlineTitle,
  offlineHint,
}: Props) {
  return (
    <section
      className={`panel hwcard hwcard--${variant} ${offline ? "is-offline" : ""} ${className}`}
    >
      <header className="panel__head">
        <div className="hwcard__ident">
          <span className="hwcard__icon">{icon}</span>
          <div>
            <h2 className="panel__title">{title}</h2>
            <p className="hwcard__sub">{subtitle}</p>
          </div>
        </div>
        {offline && <span className="badge badge--muted">OFFLINE</span>}
      </header>

      {offline ? (
        <div className="hwcard__sleep">
          <span className="hwcard__sleep-title">{offlineTitle}</span>
          <span className="hwcard__sleep-hint">{offlineHint}</span>
        </div>
      ) : (
        <>
          <div className="hwcard__primary">
            <span className="hwcard__value">{primary}</span>
            {unit && <span className="hwcard__unit">{unit}</span>}
            <span className="hwcard__caption">{caption}</span>
          </div>

          <div className="meter" role="presentation">
            <span
              className={`meter__fill meter__fill--${meterTone}`}
              style={{ width: `${clampPct(meter)}%` }}
            />
          </div>

          <dl className="hwcard__stats">
            {stats.map((s) => (
              <div key={s.label} className="stat">
                <dt className="stat__label">{s.label}</dt>
                <dd className={`stat__value stat__value--${s.tone ?? "ok"}`}>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
