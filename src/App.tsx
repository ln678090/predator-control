// src/App.tsx
// Orchestrator: chỉ điều phối state + gọi Tauri. Toàn bộ presentation
// đã tách sang components/. KHÔNG thay đổi bất kỳ command name nào.
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import type { FanAutoStatus, Section } from "./types";
import { useSystemTelemetry } from "./hooks/useSystemTelemetry";
import { loadTone, tempTone } from "./lib/format";

import {
  IconAlert,
  IconBattery,
  IconClose,
  IconCpu,
  IconFan,
  IconGpu,
  IconMemory,
} from "./components/icons";
import HeroCockpit from "./components/HeroCockpit";
import HardwareCard from "./components/HardwareCard";
import ThermalPanel from "./components/ThermalPanel";
import PowerModeSelector from "./components/PowerModeSelector";
import CoolingControl from "./components/CoolingControl";
import FanSlider from "./components/FanSlider";
import SmartFanModule from "./components/SmartFanModule";
import ServicePanel from "./components/ServicePanel";

/* Hệ số quy đổi % → RPM, khớp với dải fan trong get_fan_speed() phía Rust */
const CPU_RPM_PER_PCT = 63.5;
const GPU_RPM_PER_PCT = 62.0;
const COOLDOWN_SECONDS = 60;

const NAV: [Section, string][] = [
  ["overview", "Overview"],
  ["performance", "Performance"],
  ["cooling", "Cooling"],
];

function ErrorToast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="toast" role="alert" aria-live="assertive">
      <IconAlert className="toast__icon" />
      <div className="toast__body">
        <span className="toast__title">System Error</span>
        <span className="toast__msg">{message}</span>
      </div>
      <button
        type="button"
        className="toast__close"
        onClick={onClose}
        aria-label="Đóng thông báo"
      >
        <IconClose />
      </button>
    </div>
  );
}

function StatusIndicator({
  online,
  error,
}: {
  online: boolean;
  error: boolean;
}) {
  const tone = error ? "err" : online ? "on" : "idle";
  const label = error ? "SYSTEM ERROR" : online ? "SYSTEM ONLINE" : "SCANNING";
  return (
    <div className={`status status--${tone}`} role="status">
      <span className="status__dot" aria-hidden="true" />
      <span className="status__label">{label}</span>
    </div>
  );
}

export default function App() {
  const {
    status,
    serviceStatus,
    serviceLog,
    autoStatus,
    autoEnabled,
    error,
    setAutoStatus,
    setAutoEnabled,
    setError,
    loadStatus,
    loadServiceStatus,
  } = useSystemTelemetry();

  const [cpuFan, setCpuFan] = useState(0);
  const [gpuFan, setGpuFan] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const cooldownTimerRef = useRef<number | null>(null);

  /* Đồng bộ slider khi Smart Fan tự đổi tốc độ */
  useEffect(() => {
    if (autoEnabled && autoStatus && autoStatus.fan_percent > 0) {
      setCpuFan(autoStatus.fan_percent);
      setGpuFan(autoStatus.fan_percent);
    }
  }, [autoEnabled, autoStatus]);

  useEffect(
    () => () => {
      if (cooldownTimerRef.current !== null)
        clearInterval(cooldownTimerRef.current);
    },
    [],
  );

  /* ---------- Tauri actions — GIỮ NGUYÊN command name & payload ---------- */
  const handleSetFan = useCallback(
    async (cpu: number, gpu: number) => {
      try {
        await invoke("set_fan_speed", { cpu, gpu });
        setCpuFan(cpu);
        setGpuFan(gpu);
        await loadStatus();
      } catch (e) {
        setError(String(e));
      }
    },
    [loadStatus, setError],
  );

  const handleSetProfile = useCallback(
    async (mode: string) => {
      try {
        await invoke("set_profile", { mode });
        await loadStatus();
      } catch (e) {
        setError(String(e));
      }
    },
    [loadStatus, setError],
  );

  const toggleFanAuto = useCallback(async () => {
    const next = !autoEnabled;
    setAutoEnabled(next);
    try {
      if (next) {
        const s = await invoke<FanAutoStatus>("get_fan_auto_status");
        setAutoStatus(s);
        if (s.fan_percent > 0) {
          setCpuFan(s.fan_percent);
          setGpuFan(s.fan_percent);
        }
      } else {
        setAutoStatus(null);
        await handleSetFan(40, 40);
      }
    } catch (e) {
      setError(String(e));
    }
  }, [autoEnabled, handleSetFan, setAutoEnabled, setAutoStatus, setError]);

  const toggleFanService = useCallback(async () => {
    try {
      await invoke<string>("set_fan_service", {
        enable: !serviceStatus?.active,
      });
      await loadServiceStatus();
    } catch (e) {
      setError(String(e));
    }
  }, [serviceStatus?.active, loadServiceStatus, setError]);

  const startCooldown = useCallback(async () => {
    if (cooldownSeconds > 0) return;
    try {
      await handleSetFan(100, 100);
      setCooldownSeconds(COOLDOWN_SECONDS);
      cooldownTimerRef.current = window.setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            if (cooldownTimerRef.current !== null) {
              clearInterval(cooldownTimerRef.current);
              cooldownTimerRef.current = null;
            }
            void handleSetFan(0, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e) {
      setError(String(e));
    }
  }, [cooldownSeconds, handleSetFan, setError]);

  const cancelCooldown = useCallback(async () => {
    if (cooldownTimerRef.current !== null) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    setCooldownSeconds(0);
    await handleSetFan(0, 0);
  }, [handleSetFan]);

  /* ---------- Derived ---------- */
  const t = status?.telemetry;
  const gpuOnline = !!t && t.gpu_usage !== null;

  const vramPct = useMemo(() => {
    if (
      !t ||
      t.gpu_mem_used == null ||
      t.gpu_mem_total == null ||
      t.gpu_mem_total <= 0
    )
      return 0;
    return (t.gpu_mem_used / t.gpu_mem_total) * 100;
  }, [t]);

  const isCharging = (status?.battery_status ?? "")
    .toLowerCase()
    .includes("charg");
  const cpuRpm = Math.round((status?.fan_cpu ?? 0) * CPU_RPM_PER_PCT);
  const gpuRpm = Math.round((status?.fan_gpu ?? 0) * GPU_RPM_PER_PCT);

  const showOverview = activeSection === "overview";
  const showPerformance =
    activeSection === "overview" || activeSection === "performance";
  const showCooling =
    activeSection === "overview" || activeSection === "cooling";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <div className="brand__text">
            <span className="brand__line1">PREDATOR</span>
            <span className="brand__line2">SENSE PRO</span>
          </div>
        </div>

        <nav className="nav" aria-label="Sections">
          {NAV.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`nav__item ${activeSection === id ? "is-active" : ""}`}
              aria-current={activeSection === id ? "page" : undefined}
              onClick={() => setActiveSection(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <StatusIndicator online={!!status} error={!!error} />
      </header>

      <main className="main">
        {showOverview && (
          <>
            <HeroCockpit status={status} />

            <div className="sect-head">
              <h2 className="sect-head__title">Hardware Monitoring</h2>
              <span className="sect-head__rule" aria-hidden="true" />
            </div>

            <div className="grid-hw">
              <HardwareCard
                className="panel--cpu"
                variant="primary"
                icon={<IconCpu />}
                title="CPU"
                subtitle="Processor"
                primary={t ? t.cpu_usage.toFixed(1) : "--"}
                unit={t ? "%" : undefined}
                caption="PROCESSOR LOAD"
                meter={t?.cpu_usage ?? 0}
                meterTone={t ? loadTone(t.cpu_usage) : "muted"}
                stats={[
                  {
                    label: "TEMP",
                    value:
                      t && t.cpu_temp > 0 ? `${t.cpu_temp.toFixed(0)}°C` : "--",
                    tone: tempTone(t?.cpu_temp),
                  },
                  {
                    label: "FAN",
                    value: status ? `${status.fan_cpu}% · ${cpuRpm} RPM` : "--",
                    tone: "muted",
                  },
                ]}
              />

              <HardwareCard
                className="panel--gpu"
                variant="primary"
                icon={<IconGpu />}
                title="GPU"
                subtitle="Discrete Graphics"
                offline={!gpuOnline}
                offlineTitle="SLEEPING"
                offlineHint="iGPU ACTIVE · dGPU đang ở chế độ tiết kiệm điện"
                primary={gpuOnline ? String(t!.gpu_usage) : "--"}
                unit={gpuOnline ? "%" : undefined}
                caption="GRAPHICS LOAD"
                meter={gpuOnline ? (t!.gpu_usage as number) : 0}
                meterTone={
                  gpuOnline ? loadTone(t!.gpu_usage as number) : "muted"
                }
                stats={[
                  {
                    label: "TEMP",
                    value:
                      gpuOnline && t!.gpu_temp != null
                        ? `${t!.gpu_temp}°C`
                        : "--",
                    tone: tempTone(t?.gpu_temp),
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
                    value: status ? `${status.fan_gpu}% · ${gpuRpm} RPM` : "--",
                    tone: "muted",
                  },
                ]}
              />

              <ThermalPanel t={t} />

              <HardwareCard
                className="panel--memory"
                icon={<IconMemory />}
                title="Memory"
                subtitle="System RAM"
                primary={t ? t.ram_percent.toFixed(0) : "--"}
                unit={t ? "%" : undefined}
                caption="IN USE"
                meter={t?.ram_percent ?? 0}
                meterTone={t ? loadTone(t.ram_percent) : "muted"}
                stats={[
                  {
                    label: "USED",
                    value: t ? `${t.ram_used_gb} / ${t.ram_total_gb} GB` : "--",
                    tone: "muted",
                  },
                  {
                    label: "TEMP",
                    value:
                      t && t.ram_temp > 0 ? `${t.ram_temp.toFixed(0)}°C` : "--",
                    tone: tempTone(t?.ram_temp),
                  },
                ]}
              />

              <HardwareCard
                className="panel--battery"
                icon={<IconBattery />}
                title="Battery"
                subtitle={isCharging ? "Charging" : "Discharging"}
                primary={status ? String(status.battery_level) : "--"}
                unit={status ? "%" : undefined}
                caption="CAPACITY"
                meter={status?.battery_level ?? 0}
                meterTone={
                  status && status.battery_level <= 20 ? "hot" : "accent"
                }
                stats={[
                  {
                    label: "STATUS",
                    value: status?.battery_status ?? "--",
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

        {showPerformance && (
          <>
            <div className="sect-head">
              <h2 className="sect-head__title">Performance</h2>
              <span className="sect-head__rule" aria-hidden="true" />
            </div>
            <PowerModeSelector
              current={status?.profile}
              onSelect={handleSetProfile}
            />
          </>
        )}

        {showCooling && (
          <>
            <div className="sect-head">
              <h2 className="sect-head__title">Cooling</h2>
              <span className="sect-head__rule" aria-hidden="true" />
            </div>

            <div className="grid-cool">
              <CoolingControl
                cpuFan={cpuFan}
                gpuFan={gpuFan}
                cpuRpm={cpuRpm}
                gpuRpm={gpuRpm}
                cooldownSeconds={cooldownSeconds}
                onAuto={() => handleSetFan(0, 0)}
                onMax={() => handleSetFan(100, 100)}
                onStartCooldown={startCooldown}
                onCancelCooldown={cancelCooldown}
              />

              <section className="panel panel--manual">
                <header className="panel__head">
                  <div className="hwcard__ident">
                    <span className="hwcard__icon">
                      <IconFan />
                    </span>
                    <h2 className="panel__title">Manual Fan Control</h2>
                  </div>
                </header>
                <div className="slider-grid">
                  <FanSlider
                    label="CPU Fan"
                    value={cpuFan}
                    onPreview={setCpuFan}
                    onCommit={(v) => handleSetFan(v, gpuFan)}
                    onAuto={() => handleSetFan(0, gpuFan)}
                    onMax={() => handleSetFan(100, gpuFan)}
                  />
                  <FanSlider
                    label="GPU Fan"
                    value={gpuFan}
                    onPreview={setGpuFan}
                    onCommit={(v) => handleSetFan(cpuFan, v)}
                    onAuto={() => handleSetFan(cpuFan, 0)}
                    onMax={() => handleSetFan(cpuFan, 100)}
                  />
                </div>
              </section>

              <SmartFanModule
                enabled={autoEnabled}
                autoStatus={autoStatus}
                onToggle={toggleFanAuto}
              />

              <ServicePanel
                status={serviceStatus}
                log={serviceLog}
                onToggle={toggleFanService}
              />
            </div>
          </>
        )}
      </main>

      {error && <ErrorToast message={error} onClose={() => setError(null)} />}
    </div>
  );
}
