// src/components/PowerModeSelector.tsx — sliding indicator, không dùng text giả
// const PROFILES = [
//   { id: "low-power", label: "ECO", hint: "Tiết kiệm điện" },
//   { id: "quiet", label: "QUIET", hint: "Vận hành yên tĩnh" },
//   { id: "balanced", label: "BALANCED", hint: "Cân bằng" },
//   {
//     id: "balanced-performance",
//     label: "PERFORMANCE",
//     hint: "Ưu tiên hiệu năng",
//   },
//   { id: "performance", label: "TURBO", hint: "Hiệu năng tối đa", turbo: true },
// ] as const;
//
const PROFILES = [
  {
    id: "low-power",
    label: "ECO",
    hint: "Tiết kiệm điện",
    turbo: false,
  },
  {
    id: "quiet",
    label: "QUIET",
    hint: "Vận hành yên tĩnh",
    turbo: false,
  },
  {
    id: "balanced",
    label: "BALANCED",
    hint: "Cân bằng",
    turbo: false,
  },
  {
    id: "balanced-performance",
    label: "PERFORMANCE",
    hint: "Ưu tiên hiệu năng",
    turbo: false,
  },
  {
    id: "performance",
    label: "TURBO",
    hint: "Hiệu năng tối đa",
    turbo: true,
  },
] as const;
export default function PowerModeSelector({
  current,
  onSelect,
}: {
  current: string | undefined;
  onSelect: (mode: string) => void;
}) {
  const idx = PROFILES.findIndex((p) => p.id === current);
  const active = idx >= 0 ? PROFILES[idx] : undefined;

  return (
    <section className="panel panel--power">
      <header className="panel__head">
        <h2 className="panel__title">Power Mode</h2>
        <span
          className={`badge ${active?.turbo ? "badge--hot" : "badge--accent"}`}
        >
          {active ? active.label : (current?.toUpperCase() ?? "SCANNING")}
        </span>
      </header>

      <div className="modes" role="radiogroup" aria-label="Performance profile">
        {idx >= 0 && (
          <span
            className="modes__indicator"
            aria-hidden="true"
            style={{ transform: `translateX(${idx * 100}%)` }}
          />
        )}
        {PROFILES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={current === p.id}
            className={`modes__item ${current === p.id ? "is-active" : ""} ${p.turbo ? "is-turbo" : ""}`}
            onClick={() => onSelect(p.id)}
          >
            <span className="modes__label">{p.label}</span>
          </button>
        ))}
      </div>

      <p className="modes__desc">
        {active ? active.hint : "Đang đọc profile từ hệ thống..."}
      </p>
    </section>
  );
}
