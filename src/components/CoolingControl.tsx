// src/components/CoolingControl.tsx — Button hierarchy: primary / secondary / danger
import { IconFan } from "./icons";

const R = 13;
const CIRC = 2 * Math.PI * R;

function CooldownRing({
  seconds,
  total = 60,
}: {
  seconds: number;
  total?: number;
}) {
  const progress = Math.max(0, Math.min(100, (seconds / total) * 100));
  return (
    <svg className="ring" viewBox="0 0 32 32" aria-hidden="true">
      <circle className="ring__track" cx="16" cy="16" r={R} />
      <circle
        className="ring__bar"
        cx="16"
        cy="16"
        r={R}
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - progress / 100)}
      />
    </svg>
  );
}

interface Props {
  cpuFan: number;
  gpuFan: number;
  cpuRpm: number;
  gpuRpm: number;
  cooldownSeconds: number;
  onAuto: () => void;
  onMax: () => void;
  onStartCooldown: () => void;
  onCancelCooldown: () => void;
}

export default function CoolingControl({
  cpuFan,
  gpuFan,
  cpuRpm,
  gpuRpm,
  cooldownSeconds,
  onAuto,
  onMax,
  onStartCooldown,
  onCancelCooldown,
}: Props) {
  const isAuto = cpuFan === 0 && gpuFan === 0;
  const isMax = cpuFan === 100 && gpuFan === 100;

  return (
    <section className="panel panel--cooling">
      <header className="panel__head">
        <div className="hwcard__ident">
          <span className="hwcard__icon">
            <IconFan />
          </span>
          <h2 className="panel__title">Cooling Control</h2>
        </div>
        <span
          className={`badge ${isMax ? "badge--hot" : isAuto ? "badge--accent" : "badge--ok"}`}
        >
          {isMax ? "MAXIMUM" : isAuto ? "AUTOMATIC" : "MANUAL"}
        </span>
      </header>

      <div className="fanreadout">
        <div className="fanreadout__item">
          <span className="fanreadout__key">CPU FAN</span>
          <span className="fanreadout__val">
            {cpuFan}
            <i>%</i>
          </span>
          <span className="fanreadout__rpm">{cpuRpm} RPM</span>
        </div>
        <span className="fanreadout__div" aria-hidden="true" />
        <div className="fanreadout__item">
          <span className="fanreadout__key">GPU FAN</span>
          <span className="fanreadout__val">
            {gpuFan}
            <i>%</i>
          </span>
          <span className="fanreadout__rpm">{gpuRpm} RPM</span>
        </div>
      </div>

      <div className="cool-actions">
        <button
          type="button"
          onClick={onAuto}
          className={`btn ${isAuto ? "is-active" : ""}`}
        >
          Auto
        </button>
        <button
          type="button"
          onClick={onMax}
          className={`btn btn--danger ${isMax ? "is-active" : ""}`}
        >
          Max
        </button>
        {cooldownSeconds > 0 ? (
          <button
            type="button"
            onClick={onCancelCooldown}
            className="btn btn--warn is-counting"
          >
            <CooldownRing seconds={cooldownSeconds} />
            <span className="btn__stack">
              <span className="btn__top">Hủy</span>
              <span className="btn__sub">{cooldownSeconds}s</span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartCooldown}
            className="btn btn--primary"
          >
            <span className="btn__stack">
              <span className="btn__top">Cool Down</span>
              <span className="btn__sub">60s burst</span>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
