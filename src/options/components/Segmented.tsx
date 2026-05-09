type Option<T extends string> = { value: T; label: string; hint?: string };

type Props<T extends string> = {
  label: string;
  hint?: string;
  options: ReadonlyArray<Option<T>>;
  value: T;
  onChange: (next: T) => void;
};

export const Segmented = <T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: Props<T>): JSX.Element => (
  <div className="segmented" role="group" aria-label={label}>
    <span className="segmented__copy">
      <span className="segmented__label">{label}</span>
      {hint ? <span className="segmented__hint">{hint}</span> : null}
    </span>
    <span className="segmented__choices">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="segmented__choice"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </span>
  </div>
);
