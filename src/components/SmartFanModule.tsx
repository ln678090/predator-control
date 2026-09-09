// src/components/SmartFanModule.tsx
// Automation module — CHỈ hiển thị field backend thực sự trả về.
import { IconFan } from "./icons";
import type { FanAutoStatus } from "../types";
import { tempTone } from "../lib/format";

export default function SmartFanModule({
  enabled,
  autoStatus,
  onToggle,
}: {
  enabled: boolean;
  autoStatus: FanAutoStatus | null;
  onToggle: () => void;
}) {
  return (
    <section className="panel panel--smart">
      <header className="panel__head">
        <div className="hwcard__ident">
          <span className="hwcard__icon">
            <IconFan />
          </span>
          <div>
            <h2 className="panel__title">Smart Fan</h2>
            <p className="hwcard__sub">Tự động điều chỉnh quạt theo nhiệt độ</p>
          </div>
        </div>
        <span className={`badge ${enabled ? "badge--ok" : "badge--muted"}`}>
          {enabled ? "ACTIVE" : "INACTIVE"}
        </span>
      </header>

      {enabled && autoStatus ? (
        <dl className="automation">
          <div className="automation__item">
            <dt className="stat__label">MAX TEMP</dt>
            <dd
              className={`stat__value stat__value--${tempTone(autoStatus.max_temp_c)}`}
            >
              {autoStatus.max_temp_c.toFixed(0)}°C
            </dd>
          </div>
          <div className="automation__item">
            <dt className="stat__label">TARGET FAN</dt>
            <dd className="stat__value">
              {autoStatus.fan_percent > 0
                ? `${autoStatus.fan_percent}%`
                : "HOLD"}
            </dd>
          </div>
          <div className="automation__item automation__item--wide">
            <dt className="stat__label">STATUS</dt>
            <dd className="automation__msg">{autoStatus.message}</dd>
          </div>
        </dl>
      ) : (
        <p className="automation__idle">
          Bật để hệ thống tự đặt tốc độ quạt dựa trên cảm biến nhiệt.
        </p>
      )}

      <button
        type="button"
        onClick={onToggle}
        className={`btn ${enabled ? "btn--danger" : "btn--primary"} btn--block`}
        aria-pressed={enabled}
      >
        {enabled ? "Tắt Smart Fan" : "Bật Smart Fan"}
      </button>
    </section>
  );
}
