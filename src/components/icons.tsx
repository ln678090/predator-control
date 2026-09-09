// src/components/icons.tsx — Giữ nguyên SVG gốc, chỉ chuẩn hóa props
export type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconCpu = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
    <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
  </svg>
);

export const IconGpu = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="2" y="7" width="20" height="11" rx="2" />
    <circle cx="8" cy="12.5" r="2.6" />
    <circle cx="16" cy="12.5" r="1.4" />
    <path d="M6 18v3" />
  </svg>
);

export const IconMemory = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="2" y="8" width="20" height="9" rx="1.5" />
    <path d="M6 17v3M10 17v3M14 17v3M18 17v3M6 11v3M10 11v3M14 11v3M18 11v3" />
  </svg>
);

export const IconBattery = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="2" y="7" width="17" height="10" rx="2" />
    <path d="M22 10v4" />
    <path d="M11.5 9.5 8.8 13h3.2l-1.4 2.4" />
  </svg>
);

export const IconFan = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="2" />
    <path d="M12 10c0-3.5.6-6 2.2-6 1.4 0 2 1.4 1.5 3.2-.5 1.7-2 2.8-3.7 2.8" />
    <path d="M14 12c3.5 0 6 .6 6 2.2 0 1.4-1.4 2-3.2 1.5-1.7-.5-2.8-2-2.8-3.7" />
    <path d="M12 14c0 3.5-.6 6-2.2 6-1.4 0-2-1.4-1.5-3.2.5-1.7 2-2.8 3.7-2.8" />
    <path d="M10 12c-3.5 0-6-.6-6-2.2 0-1.4 1.4-2 3.2-1.5 1.7.5 2.8 2 2.8 3.7" />
  </svg>
);

export const IconZap = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
);

export const IconGauge = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 18a8 8 0 1 1 16 0" />
    <path d="M12 14.5 15.5 10" />
  </svg>
);

export const IconAlert = ({ className }: IconProps) => (
  <svg {...base} strokeWidth={1.7} className={className}>
    <path d="M10.3 3.9 1.9 18.2A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

export const IconClose = ({ className }: IconProps) => (
  <svg {...base} strokeWidth={2} className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const IconChevron = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
