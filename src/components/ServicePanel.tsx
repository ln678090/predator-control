// src/components/ServicePanel.tsx — Log nằm trong <details>, mặc định thu gọn
import { useState } from "react";
import { IconChevron, IconGauge } from "./icons";
import type { FanServiceLog, FanServiceStatus } from "../types";

export default function ServicePanel({
  status,
  log,
  onToggle,
}: {
  status: FanServiceStatus | null;
  log: FanServiceLog | null;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = !!status?.active;
  const hasLog = !!log && log.lines.length > 0;

  return (
    <section className="panel panel--service">
      <header className="panel__head">
        <div className="hwcard__ident">
          <span className="hwcard__icon">
            <IconGauge />
          </span>
          <div>
            <h2 className="panel__title">Fan Service</h2>
            <p className="hwcard__sub">Background fan control service</p>
          </div>
        </div>
        <span className={`badge ${active ? "badge--ok" : "badge--muted"}`}>
          {active ? "RUNNING" : status?.enabled ? "ENABLED" : "STOPPED"}
        </span>
      </header>

      <div className="service">
        <div className="service__info">
          <span
            className={`service__dot ${active ? "is-on" : "is-off"}`}
            aria-hidden="true"
          />
          <span className="service__text">
            {status?.message ?? "Đang tải trạng thái..."}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`btn ${active ? "btn--danger" : ""}`}
          aria-pressed={active}
        >
          {active ? "Tắt Service" : "Bật Service"}
        </button>
      </div>

      {hasLog && (
        <div className={`disclosure ${open ? "is-open" : ""}`}>
          <button
            type="button"
            className="disclosure__trigger"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="service-log"
          >
            <span>Service log</span>
            <span className="disclosure__count">{log!.lines.length}</span>
            <IconChevron className="disclosure__chevron" />
          </button>
          <div id="service-log" className="disclosure__body" hidden={!open}>
            {log!.lines.map((line, i) => (
              <p key={`${i}-${line}`} className="logline">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
