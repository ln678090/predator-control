// src/components/ThermalPanel.tsx — Thang COOL → HOT + breakdown 4 cảm biến
import type { HardwareTelemetry } from "../types";
import { tempTone, thermalLabel, thermalScalePct } from "../lib/format";

const SENSORS = [
  { key: "cpu_temp", label: "CPU" },
  { key: "ram_temp", label: "RAM" },
  { key: "nvme_temp", label: "NVMe" },
  { key: "motherboard_temp", label: "BOARD" },
] as const;

export default function ThermalPanel({
  t,
}: {
  t: HardwareTelemetry | undefined;
}) {
  const hottest = t
    ? Math.max(t.cpu_temp, t.ram_temp, t.nvme_temp, t.motherboard_temp)
    : 0;
  const tone = tempTone(hottest);

  return (
    <section className="panel panel--thermal">
      <header className="panel__head">
        <h2 className="panel__title">Thermal Status</h2>
        <span className={`badge badge--${tone}`}>{thermalLabel(hottest)}</span>
      </header>

      <div className="thermo">
        <div className="thermo__scale" role="presentation">
          <span className="thermo__gradient" />
          <span
            className="thermo__marker"
            style={{ left: `${thermalScalePct(hottest)}%` }}
          />
        </div>
        <div className="thermo__legend">
          <span>COOL</span>
          <span>NORMAL</span>
          <span>WARM</span>
          <span>HOT</span>
        </div>
      </div>

      <dl className="sensors">
        {SENSORS.map(({ key, label }) => {
          const v = t?.[key] ?? 0;
          return (
            <div key={key} className="sensors__item">
              <dt className="sensors__key">{label}</dt>
              <dd className={`sensors__val sensors__val--${tempTone(v)}`}>
                {v > 0 ? `${v.toFixed(1)}°` : "--"}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
