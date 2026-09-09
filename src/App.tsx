import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState, useRef } from "react";
import "./App.css";

/* ============================================================
 * TYPES — GIỮ NGUYÊN 100%, không đổi tên field
 * ========================================================== */
interface HardwareTelemetry {
  cpu_usage: number;
  cpu_temp: number;
  gpu_usage: number | null;
  gpu_temp: number | null;
  gpu_mem_used: number | null;
  gpu_mem_total: number | null;
  ram_used_gb: number;
  ram_total_gb: number;
  ram_percent: number;
}

interface SystemStatus {
  fan_cpu: number;
  fan_gpu: number;
  profile: string;
  battery_level: number;
  battery_threshold: number | null;
  battery_status: string;
  telemetry: HardwareTelemetry;
}

/* ============================================================
 * ICONS — inline SVG, không dùng emoji, không thêm dependency
 * ========================================================== */
type IconProps = { className?: string };

const IconCpu = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
    <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
  </svg>
);

const IconGpu = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="7" width="20" height="11" rx="2" />
    <circle cx="8" cy="12.5" r="2.6" />
    <circle cx="16" cy="12.5" r="1.4" />
    <path d="M6 18v3" />
  </svg>
);

const IconMemory = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="8" width="20" height="9" rx="1.5" />
    <path d="M6 17v3M10 17v3M14 17v3M18 17v3M6 11v3M10 11v3M14 11v3M18 11v3" />
  </svg>
);

const IconBattery = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="7" width="17" height="10" rx="2" />
    <path d="M22 10v4" />
    <path d="M11.5 9.5 8.8 13h3.2l-1.4 2.4" />
  </svg>
);

const IconFan = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="2" />
    <path d="M12 10c0-3.5.6-6 2.2-6 1.4 0 2 1.4 1.5 3.2-.5 1.7-2 2.8-3.7 2.8" />
    <path d="M14 12c3.5 0 6 .6 6 2.2 0 1.4-1.4 2-3.2 1.5-1.7-.5-2.8-2-2.8-3.7" />
    <path d="M12 14c0 3.5-.6 6-2.2 6-1.4 0-2-1.4-1.5-3.2.5-1.7 2-2.8 3.7-2.8" />
    <path d="M10 12c-3.5 0-6-.6-6-2.2 0-1.4 1.4-2 3.2-1.5 1.7.5 2.8 2 2.8 3.7" />
  </svg>
);

const IconZap = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
);

const IconGauge = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 18a8 8 0 1 1 16 0" />
    <path d="M12 14.5 15.5 10" />
  </svg>
);

const IconAlert = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.3 3.9 1.9 18.2A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

const IconClose = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/* ============================================================
 * HELPERS
 * ========================================================== */
const tempTone = (temp: number | null | undefined): "ok" | "warn" | "hot" => {
  if (temp === null || temp === undefined) return "ok";
  if (temp >= 85) return "hot";
  if (temp >= 70) return "warn";
  return "ok";
};

const loadTone = (pct: number): "ok" | "warn" | "hot" => {
  if (pct >= 90) return "hot";
  if (pct >= 70) return "warn";
  return "ok";
};

const clampPct = (value: number) => Math.max(0, Math.min(100, value));

/* ============================================================
 * PRESENTATIONAL COMPONENTS
 * ========================================================== */

function StatusIndicator({
  online,
  error,
}: {
  online: boolean;
  error: boolean;
}) {
  const label = error ? "SYSTEM ERROR" : online ? "SYSTEM ONLINE" : "SCANNING";
  const tone = error ? "err" : online ? "on" : "idle";
  return (
    <div className={`status-pill status-pill--${tone}`}>
      <span className="status-pill__dot" />
      <span className="status-pill__label">{label}</span>
    </div>
  );
}

function MetricBar({
  value,
  tone = "ok",
  striped = false,
}: {
  value: number;
  tone?: "ok" | "warn" | "hot" | "accent";
  striped?: boolean;
}) {
  return (
    <div className="meter">
      <div
        className={`meter__fill meter__fill--${tone} ${striped ? "is-striped" : ""}`}
        style={{ width: `${clampPct(value)}%` }}
      />
    </div>
  );
}

function StatChip({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "hot" | "muted";
}) {
  return (
    <div className={`chip chip--${tone}`}>
      <span className="chip__label">{label}</span>
      <span className="chip__value">{value}</span>
    </div>
  );
}

function HardwareCard({
  icon,
  title,
  subtitle,
  primary,
  primaryUnit,
  primaryLabel,
  meter,
  meterTone,
  chips,
  offline,
  offlineText,
  span,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  primary: string;
  primaryUnit?: string;
  primaryLabel: string;
  meter: number;
  meterTone: "ok" | "warn" | "hot" | "accent";
  chips: {
    label: string;
    value: string;
    tone?: "ok" | "warn" | "hot" | "muted";
  }[];
  offline?: boolean;
  offlineText?: string;
  span?: boolean;
}) {
  return (
    <section
      className={`hwcard ${span ? "hwcard--wide" : ""} ${offline ? "is-offline" : ""}`}
    >
      <header className="hwcard__head">
        <span className="hwcard__icon">{icon}</span>
        <div className="hwcard__ident">
          <h3 className="hwcard__title">{title}</h3>
          <p className="hwcard__sub">{subtitle}</p>
        </div>
      </header>

      {offline ? (
        <div className="hwcard__offline">{offlineText}</div>
      ) : (
        <>
          <div className="hwcard__primary">
            <span className="hwcard__value">{primary}</span>
            {primaryUnit && <span className="hwcard__unit">{primaryUnit}</span>}
            <span className="hwcard__vlabel">{primaryLabel}</span>
          </div>

          <MetricBar value={meter} tone={meterTone} />

          <footer className="hwcard__chips">
            {chips.map((c) => (
              <StatChip
                key={c.label}
                label={c.label}
                value={c.value}
                tone={c.tone}
              />
            ))}
          </footer>
        </>
      )}
    </section>
  );
}

const PROFILES: { id: string; label: string; hint: string; turbo?: boolean }[] =
  [
    { id: "low-power", label: "ECO", hint: "Tiết kiệm" },
    { id: "quiet", label: "QUIET", hint: "Yên tĩnh" },
    { id: "balanced", label: "BALANCED", hint: "Cân bằng" },
    { id: "balanced-performance", label: "PERFORMANCE", hint: "Hiệu năng" },
    { id: "performance", label: "TURBO", hint: "Tối đa", turbo: true },
  ];

function ProfileSelector({
  current,
  onSelect,
}: {
  current: string | undefined;
  onSelect: (mode: string) => void;
}) {
  const active = PROFILES.find((p) => p.id === current);
  return (
    <div className="panel">
      <div className="panel__head">
        <IconZap className="panel__icon" />
        <h2 className="panel__title">Power Mode</h2>
      </div>

      <div className="segmented" role="group" aria-label="Performance profile">
        {PROFILES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            aria-pressed={current === p.id}
            className={[
              "segmented__item",
              p.turbo ? "segmented__item--turbo" : "",
              current === p.id ? "is-active" : "",
            ].join(" ")}
          >
            <span className="segmented__label">{p.label}</span>
            <span className="segmented__hint">{p.hint}</span>
          </button>
        ))}
      </div>

      <div className="current-mode">
        <span className="current-mode__key">Current Mode</span>
        <span
          className={`current-mode__val ${active?.turbo ? "is-turbo" : ""}`}
        >
          {active
            ? active.label
            : current
              ? current.toUpperCase()
              : "ĐANG QUÉT..."}
        </span>
      </div>
    </div>
  );
}

function CooldownRing({
  seconds,
  total = 60,
}: {
  seconds: number;
  total?: number;
}) {
  const r = 13;
  const circumference = 2 * Math.PI * r;
  const progress = clampPct((seconds / total) * 100);
  return (
    <svg className="ring" viewBox="0 0 32 32" aria-hidden="true">
      <circle className="ring__track" cx="16" cy="16" r={r} />
      <circle
        className="ring__bar"
        cx="16"
        cy="16"
        r={r}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress / 100)}
      />
    </svg>
  );
}

function CoolingControl({
  cpuFan,
  gpuFan,
  cooldownSeconds,
  onAuto,
  onMax,
  onStartCooldown,
  onCancelCooldown,
}: {
  cpuFan: number;
  gpuFan: number;
  cooldownSeconds: number;
  onAuto: () => void;
  onMax: () => void;
  onStartCooldown: () => void;
  onCancelCooldown: () => void;
}) {
  const isAuto = cpuFan === 0 && gpuFan === 0;
  const isMax = cpuFan === 100 && gpuFan === 100;
  return (
    <div className="panel">
      <div className="panel__head">
        <IconFan className="panel__icon" />
        <h2 className="panel__title">Cooling Control</h2>
      </div>

      <div className="fan-readout">
        <div className="fan-readout__item">
          <span className="fan-readout__key">CPU Fan</span>
          <span className="fan-readout__val">
            {cpuFan}
            <i>%</i>
          </span>
        </div>
        <span className="fan-readout__div" />
        <div className="fan-readout__item">
          <span className="fan-readout__key">GPU Fan</span>
          <span className="fan-readout__val">
            {gpuFan}
            <i>%</i>
          </span>
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
            className="btn btn--cool"
          >
            <span className="btn__stack">
              <span className="btn__top">Cool Down</span>
              <span className="btn__sub">60s</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function FanSlider({
  label,
  value,
  onChange,
  onAuto,
  onMax,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onAuto: () => void;
  onMax: () => void;
}) {
  return (
    <div className="slider">
      <div className="slider__head">
        <div className="slider__ident">
          <span className="slider__label">{label}</span>
          <span className="slider__value">
            {value === 0 ? (
              "AUTO"
            ) : (
              <>
                {value}
                <i>%</i>
              </>
            )}
          </span>
        </div>
        <div className="slider__quick">
          <button
            type="button"
            onClick={onAuto}
            className={`mini ${value === 0 ? "is-active" : ""}`}
          >
            Auto
          </button>
          <button
            type="button"
            onClick={onMax}
            className={`mini ${value === 100 ? "is-active" : ""}`}
          >
            Max
          </button>
        </div>
      </div>

      <input
        className="slider__input"
        type="range"
        min="0"
        max="100"
        step="5"
        value={value}
        aria-label={label}
        style={{ ["--fill" as any]: `${value}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      <div className="slider__scale">
        <span>AUTO</span>
        <span>50%</span>
        <span>MAX</span>
      </div>
    </div>
  );
}

function ErrorToast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="toast" role="alert">
      <IconAlert className="toast__icon" />
      <div className="toast__body">
        <span className="toast__title">System Error</span>
        <span className="toast__msg">{message}</span>
      </div>
      <button
        type="button"
        className="toast__close"
        onClick={onClose}
        aria-label="Đóng"
      >
        <IconClose />
      </button>
    </div>
  );
}

/* ============================================================
 * APP — TOÀN BỘ LOGIC GIỮ NGUYÊN
 * ========================================================== */
function App() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [cpuFan, setCpuFan] = useState<number>(0);
  const [gpuFan, setGpuFan] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const cooldownTimerRef = useRef<number | null>(null);

  // UI-only state: điều hướng, không ảnh hưởng logic
  const [activeSection, setActiveSection] = useState<
    "overview" | "performance" | "cooling"
  >("overview");

  const loadStatus = async () => {
    try {
      const s = await invoke<SystemStatus>("get_status");
      setStatus(s);
      // KHÔNG xóa lỗi ở đây nữa, để user nhìn thấy
    } catch (e) {
      const msg = String(e);
      console.error("[FE ERROR get_status]", msg);
      setError(msg); // Giữ lỗi trên màn hình
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = window.setInterval(loadStatus, 1500);
    return () => {
      clearInterval(interval);
      // FIX: dọn cooldown timer khi unmount, tránh leak
      if (cooldownTimerRef.current !== null) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, []);

  const handleSetFan = async (cpu: number, gpu: number) => {
    console.log("[FE LOG] Gửi lệnh quạt: CPU=%d, GPU=%d", cpu, gpu);
    try {
      await invoke("set_fan_speed", { cpu, gpu });
      console.log("[FE LOG] Thành công!");
      setCpuFan(cpu);
      setGpuFan(gpu);
      await loadStatus();
    } catch (e) {
      const msg = String(e);
      console.error("[FE ERROR set_fan_speed]", msg);
      setError(msg); // Giữ lỗi trên màn hình
    }
  };

  const handleSetProfile = async (mode: string) => {
    console.log("[FE LOG] Gửi lệnh profile: %s", mode);
    try {
      await invoke("set_profile", { mode });
      console.log("[FE LOG] Thành công!");
      await loadStatus();
    } catch (e) {
      const msg = String(e);
      console.error("[FE ERROR set_profile]", msg);
      setError(msg);
    }
  };

  const startCooldown = async () => {
    if (cooldownSeconds > 0) return;
    try {
      await handleSetFan(100, 100);
      setCooldownSeconds(60);
      cooldownTimerRef.current = window.setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            if (cooldownTimerRef.current !== null) {
              clearInterval(cooldownTimerRef.current);
              cooldownTimerRef.current = null;
            }
            handleSetFan(0, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e) {
      const msg = String(e);
      console.error("[FE ERROR cooldown]", msg);
      setError(msg);
    }
  };

  const cancelCooldown = async () => {
    if (cooldownTimerRef.current !== null) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    setCooldownSeconds(0);
    await handleSetFan(0, 0);
  };

  const t = status?.telemetry;

  /* ---------- derived values cho UI (không đụng logic) ---------- */
  const gpuOnline = !!t && t.gpu_usage !== null;
  const vramPct =
    t &&
    t.gpu_mem_used != null &&
    t.gpu_mem_total != null &&
    t.gpu_mem_total > 0
      ? (t.gpu_mem_used / t.gpu_mem_total) * 100
      : 0;
  const isCharging = (status?.battery_status || "")
    .toLowerCase()
    .includes("charg");

  const showMonitor = activeSection === "overview";
  const showPerformance =
    activeSection === "overview" || activeSection === "performance";
  const showCooling =
    activeSection === "overview" || activeSection === "cooling";

  return (
    <div className="app">
      {/* ================= HEADER ================= */}
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <div className="brand__text">
            <span className="brand__line1">Predator</span>
            <span className="brand__line2">Sense Pro</span>
          </div>
          <span className="brand__tag">CPU / GPU / FAN CONTROL</span>
        </div>

        <nav className="nav" aria-label="Sections">
          {(
            [
              ["overview", "Overview"],
              ["performance", "Performance"],
              ["cooling", "Cooling"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`nav__item ${activeSection === id ? "is-active" : ""}`}
              onClick={() => setActiveSection(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <StatusIndicator online={!!status} error={!!error} />
      </header>

      {/* ================= ERROR ================= */}
      {error && <ErrorToast message={error} onClose={() => setError(null)} />}

      {/* ================= MAIN ================= */}
      <main className="main">
        {showMonitor && (
          <>
            <div className="sect-head">
              <IconGauge className="sect-head__icon" />
              <h2 className="sect-head__title">Hardware Monitoring</h2>
              <span className="sect-head__rule" />
            </div>

            <div className="grid-hw">
              <HardwareCard
                icon={<IconCpu />}
                title="CPU"
                subtitle="Processor"
                primary={t ? t.cpu_usage.toFixed(1) : "--"}
                primaryUnit={t ? "%" : undefined}
                primaryLabel="USAGE"
                meter={t ? t.cpu_usage : 0}
                meterTone={t ? loadTone(t.cpu_usage) : "ok"}
                chips={[
                  {
                    label: "TEMP",
                    value:
                      t && t.cpu_temp > 0 ? `${t.cpu_temp.toFixed(0)}°C` : "--",
                    tone: t && t.cpu_temp > 0 ? tempTone(t.cpu_temp) : "muted",
                  },
                  {
                    label: "FAN",
                    value: status
                      ? `${status.fan_cpu}% · ${Math.round(status.fan_cpu * 63.5)} RPM`
                      : "--",
                    tone: "muted",
                  },
                ]}
              />

              <HardwareCard
                icon={<IconGpu />}
                title="GPU"
                subtitle="Graphics"
                primary={gpuOnline ? String(t!.gpu_usage) : "--"}
                primaryUnit={gpuOnline ? "%" : undefined}
                primaryLabel="USAGE"
                meter={gpuOnline ? (t!.gpu_usage as number) : 0}
                meterTone={gpuOnline ? loadTone(t!.gpu_usage as number) : "ok"}
                offline={!gpuOnline}
                offlineText="SLEEP / iGPU"
                chips={[
                  {
                    label: "TEMP",
                    value:
                      gpuOnline && t!.gpu_temp != null
                        ? `${t!.gpu_temp}°C`
                        : "--",
                    tone: gpuOnline ? tempTone(t!.gpu_temp) : "muted",
                  },
                  {
                    label: "VRAM",
                    value:
                      gpuOnline &&
                      t!.gpu_mem_used != null &&
                      t!.gpu_mem_total != null
                        ? `${t!.gpu_mem_used.toFixed(1)} / ${t!.gpu_mem_total.toFixed(1)} GB`
                        : "--",
                    tone: gpuOnline ? loadTone(vramPct) : "muted",
                  },
                  {
                    label: "FAN",
                    value: status
                      ? `${status.fan_gpu}% · ${Math.round(status.fan_gpu * 62.0)} RPM`
                      : "--",
                    tone: "muted",
                  },
                ]}
              />

              <HardwareCard
                icon={<IconMemory />}
                title="Memory"
                subtitle="System RAM"
                primary={t ? String(t.ram_percent) : "--"}
                primaryUnit={t ? "%" : undefined}
                primaryLabel="IN USE"
                meter={t ? t.ram_percent : 0}
                meterTone={t ? loadTone(t.ram_percent) : "ok"}
                chips={[
                  {
                    label: "USED",
                    value: t ? `${t.ram_used_gb} / ${t.ram_total_gb} GB` : "--",
                    tone: "muted",
                  },
                ]}
              />

              <HardwareCard
                icon={<IconBattery />}
                title="Battery"
                subtitle={isCharging ? "Charging" : "Discharging"}
                primary={status ? String(status.battery_level) : "--"}
                primaryUnit={status ? "%" : undefined}
                primaryLabel="CAPACITY"
                meter={status ? status.battery_level : 0}
                meterTone={
                  status
                    ? status.battery_level <= 20
                      ? "hot"
                      : "accent"
                    : "ok"
                }
                chips={[
                  {
                    label: "STATUS",
                    value: status ? status.battery_status : "--",
                    tone: "muted",
                  },
                  ...(status?.battery_threshold != null
                    ? [
                        {
                          label: "LIMIT",
                          value: `${status.battery_threshold}%`,
                          tone: "muted" as const,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          </>
        )}

        <div className="grid-ctrl">
          {showPerformance && (
            <ProfileSelector
              current={status?.profile}
              onSelect={handleSetProfile}
            />
          )}

          {showCooling && (
            <CoolingControl
              cpuFan={cpuFan}
              gpuFan={gpuFan}
              cooldownSeconds={cooldownSeconds}
              onAuto={() => handleSetFan(0, 0)}
              onMax={() => handleSetFan(100, 100)}
              onStartCooldown={startCooldown}
              onCancelCooldown={cancelCooldown}
            />
          )}

          {showCooling && (
            <div className="panel panel--span">
              <div className="panel__head">
                <IconFan className="panel__icon" />
                <h2 className="panel__title">Manual Fan Control</h2>
              </div>

              <div className="slider-grid">
                <FanSlider
                  label="CPU Fan"
                  value={cpuFan}
                  onChange={(val) => {
                    setCpuFan(val);
                    handleSetFan(val, gpuFan);
                  }}
                  onAuto={() => handleSetFan(0, gpuFan)}
                  onMax={() => handleSetFan(100, gpuFan)}
                />
                <FanSlider
                  label="GPU Fan"
                  value={gpuFan}
                  onChange={(val) => {
                    setGpuFan(val);
                    handleSetFan(cpuFan, val);
                  }}
                  onAuto={() => handleSetFan(cpuFan, 0)}
                  onMax={() => handleSetFan(cpuFan, 100)}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
