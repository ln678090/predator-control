// src/components/FanSlider.tsx
// Slider custom hoàn toàn bằng CSS, giữ input[type=range] gốc để
// đảm bảo keyboard navigation + screen reader hoạt động chuẩn.
interface Props {
  label: string;
  value: number;
  onCommit: (v: number) => void; // gọi khi thả chuột → tránh spam sysfs
  onPreview: (v: number) => void; // cập nhật UI tức thời
  onAuto: () => void;
  onMax: () => void;
}

export default function FanSlider({
  label,
  value,
  onCommit,
  onPreview,
  onAuto,
  onMax,
}: Props) {
  return (
    <div className="fslider">
      <div className="fslider__head">
        <span className="fslider__label">{label}</span>
        <span className="fslider__value">
          {value === 0 ? (
            <em>AUTO</em>
          ) : (
            <>
              {value}
              <i>%</i>
            </>
          )}
        </span>
      </div>

      <div className="fslider__rail">
        <span className="fslider__fill" style={{ width: `${value}%` }} />
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          aria-label={label}
          aria-valuetext={value === 0 ? "Automatic" : `${value} percent`}
          onChange={(e) => onPreview(Number(e.target.value))}
          onMouseUp={(e) =>
            onCommit(Number((e.target as HTMLInputElement).value))
          }
          onKeyUp={(e) =>
            onCommit(Number((e.target as HTMLInputElement).value))
          }
          onTouchEnd={(e) =>
            onCommit(Number((e.target as HTMLInputElement).value))
          }
        />
      </div>

      <div className="fslider__foot">
        <div className="fslider__scale">
          <span>AUTO</span>
          <span>50</span>
          <span>MAX</span>
        </div>
        <div className="fslider__quick">
          <button
            type="button"
            className={`mini ${value === 0 ? "is-active" : ""}`}
            onClick={onAuto}
          >
            Auto
          </button>
          <button
            type="button"
            className={`mini ${value === 100 ? "is-active" : ""}`}
            onClick={onMax}
          >
            Max
          </button>
        </div>
      </div>
    </div>
  );
}
