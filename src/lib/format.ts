// src/lib/format.ts — Helper thuần, không side effect, dễ unit-test
import type { Tone } from "../types";

export const clampPct = (v: number) => Math.max(0, Math.min(100, v));

export const tempTone = (t: number | null | undefined): Tone => {
  if (t == null || t <= 0) return "muted";
  if (t >= 85) return "hot";
  if (t >= 70) return "warn";
  return "ok";
};

export const loadTone = (p: number): Tone =>
  p >= 90 ? "hot" : p >= 70 ? "warn" : "ok";

/** Nhãn trạng thái nhiệt hiển thị trên thang COOL → HOT */
export const thermalLabel = (t: number): string => {
  if (t <= 0) return "NO DATA";
  if (t >= 85) return "CRITICAL";
  if (t >= 70) return "WARM";
  if (t >= 55) return "NORMAL";
  return "OPTIMAL";
};

/** Map nhiệt độ 30–95°C sang 0–100% cho thang trực quan */
export const thermalScalePct = (t: number) => clampPct(((t - 30) / 65) * 100);

export const fmt = (v: number | null | undefined, d = 0, unit = "") =>
  v == null || Number.isNaN(v) ? "--" : `${v.toFixed(d)}${unit}`;
