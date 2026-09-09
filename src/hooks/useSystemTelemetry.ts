// src/hooks/useSystemTelemetry.ts
// Tách toàn bộ giao tiếp Tauri khỏi tầng UI (Separation of Concerns).
// Interval được khởi tạo MỘT LẦN; cờ auto-fan giữ trong ref để tránh
// hủy/tạo lại timer mỗi lần toggle (bug của bản cũ).
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FanAutoStatus,
  FanServiceLog,
  FanServiceStatus,
  SystemStatus,
} from "../types";

const POLL_STATUS_MS = 2000;
const POLL_SERVICE_MS = 10000;
const POLL_LOG_MS = 15000;

export function useSystemTelemetry() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [serviceStatus, setServiceStatus] = useState<FanServiceStatus | null>(
    null,
  );
  const [serviceLog, setServiceLog] = useState<FanServiceLog | null>(null);
  const [autoStatus, setAutoStatus] = useState<FanAutoStatus | null>(null);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoRef = useRef(false);
  autoRef.current = autoEnabled;

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await invoke<SystemStatus>("get_status"));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const loadServiceStatus = useCallback(async () => {
    try {
      setServiceStatus(
        await invoke<FanServiceStatus>("get_fan_service_status"),
      );
    } catch {
      /* non-critical: service có thể chưa cài */
    }
  }, []);

  const loadServiceLog = useCallback(async () => {
    try {
      setServiceLog(await invoke<FanServiceLog>("get_fan_service_log"));
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadServiceStatus();
    loadServiceLog();

    const tStatus = window.setInterval(async () => {
      await loadStatus();
      if (autoRef.current) {
        try {
          setAutoStatus(await invoke<FanAutoStatus>("get_fan_auto_status"));
        } catch (e) {
          setError(String(e));
        }
      }
    }, POLL_STATUS_MS);

    const tService = window.setInterval(loadServiceStatus, POLL_SERVICE_MS);
    const tLog = window.setInterval(loadServiceLog, POLL_LOG_MS);

    return () => {
      clearInterval(tStatus);
      clearInterval(tService);
      clearInterval(tLog);
    };
  }, [loadStatus, loadServiceStatus, loadServiceLog]);

  return {
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
  };
}
