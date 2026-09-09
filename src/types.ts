// src/types.ts — Data model giữ nguyên 100% khớp với Rust serde
export interface HardwareTelemetry {
  cpu_usage: number;
  cpu_temp: number;
  ram_temp: number;
  nvme_temp: number;
  motherboard_temp: number;
  gpu_usage: number | null;
  gpu_temp: number | null;
  gpu_mem_used: number | null;
  gpu_mem_total: number | null;
  ram_used_gb: number;
  ram_total_gb: number;
  ram_percent: number;
}

export interface SystemStatus {
  fan_cpu: number;
  fan_gpu: number;
  profile: string;
  battery_level: number;
  battery_threshold: number | null;
  battery_status: string;
  telemetry: HardwareTelemetry;
}

export interface FanAutoStatus {
  enabled: boolean;
  max_temp_c: number;
  fan_percent: number;
  message: string;
}

export interface FanServiceStatus {
  active: boolean;
  enabled: boolean;
  message: string;
}

export interface FanServiceLog {
  lines: string[];
}

export type Tone = "ok" | "warn" | "hot" | "accent" | "muted";
export type Section = "overview" | "performance" | "cooling";
