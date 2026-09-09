// src/components/HeroCockpit.tsx
// Điểm neo thị giác: 1 radial nhiệt độ trung tâm + 3 metric vệ tinh.
// Chỉ dùng giá trị hiện tại từ backend — KHÔNG dựng dữ liệu lịch sử.
import type { SystemStatus } from "../types";
import { clampPct, loadTone, tempTone, thermalLabel } from "../lib/format";

const R = 78;
const CIRC = 2 * Math.PI * R;

function Satellite({
  label,
  value,
  unit,
  pct,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  pct: number;
  tone: string;
}) {
  return (
    <div className="sat">
      <span className="sat__label">{label}</span>
      <span className="sat__value">
        {value}
        <i className="sat__unit">{unit}</i>
      </span>
      <div className="sat__track" role="presentation">
        <span
          className={`sat__fill sat__fill--${tone}`}
          style={{ width: `${clampPct(pct)}%` }}
        />
      </div>
    </div>
  );
}

export default function HeroCockpit({
  status,
}: {
  status: SystemStatus | null;
}) {
  const t = status?.telemetry;
  const hottest = t
    ? Math.max(t.cpu_temp, t.ram_temp, t.nvme_temp, t.motherboard_temp)
    : 0;
  const tone = tempTone(hottest);
  const arc = clampPct(((hottest - 30) / 65) * 100);

  return (
    <section className="hero" aria-label="System status overview">
      <div className="hero__dial">
        <svg viewBox="0 0 200 200" className="hero__svg" aria-hidden="true">
          <defs>
            <linearGradient id="dialGrad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor={`var(--tone-${tone})`} />
            </linearGradient>
          </defs>
          <circle className="hero__track" cx="100" cy="100" r={R} />
          <circle
            className="hero__arc"
            cx="100"
            cy="100"
            r={R}
            stroke="url(#dialGrad)"
            strokeDasharray={`${CIRC * 0.75} ${CIRC}`}
            strokeDashoffset={CIRC * 0.75 * (1 - arc / 100)}
          />
        </svg>
        <div className="hero__center">
          <span className="hero__eyebrow">HOTTEST</span>
          <span className="hero__metric">
            {hottest > 0 ? hottest.toFixed(0) : "--"}
            <i className="hero__deg">°C</i>
          </span>
          <span className={`hero__state hero__state--${tone}`}>
            {thermalLabel(hottest)}
          </span>
        </div>
      </div>

      <div className="hero__grid">
        <Satellite
          label="CPU LOAD"
          value={t ? t.cpu_usage.toFixed(1) : "--"}
          unit="%"
          pct={t?.cpu_usage ?? 0}
          tone={t ? loadTone(t.cpu_usage) : "muted"}
        />
        <Satellite
          label="GPU LOAD"
          value={t?.gpu_usage != null ? String(t.gpu_usage) : "--"}
          unit={t?.gpu_usage != null ? "%" : ""}
          pct={t?.gpu_usage ?? 0}
          tone={t?.gpu_usage != null ? loadTone(t.gpu_usage) : "muted"}
        />
        <Satellite
          label="MEMORY"
          value={t ? t.ram_percent.toFixed(0) : "--"}
          unit="%"
          pct={t?.ram_percent ?? 0}
          tone={t ? loadTone(t.ram_percent) : "muted"}
        />
        <Satellite
          label="POWER MODE"
          value={
            status ? status.profile.toUpperCase().replace(/-/g, " ") : "--"
          }
          unit=""
          pct={100}
          tone="accent"
        />
      </div>
    </section>
  );
}
