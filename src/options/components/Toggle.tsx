import { useId } from "react";

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  brandColor?: string;
};

export const Toggle = ({
  checked,
  onChange,
  label,
  hint,
  brandColor,
}: Props): JSX.Element => {
  const id = useId();
  const style = brandColor
    ? ({ ["--brand" as string]: brandColor } as React.CSSProperties)
    : undefined;
  return (
    <label className="toggle" htmlFor={id} style={style}>
      <span className="toggle__copy">
        <span className="toggle__label">{label}</span>
        {hint ? <span className="toggle__hint">{hint}</span> : null}
      </span>
      <input
        id={id}
        type="checkbox"
        className="toggle__input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle__switch" aria-hidden="true" />
    </label>
  );
};
