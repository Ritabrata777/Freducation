export function Icon({ name, className, filled, style }: { name: string; className?: string; filled?: boolean; style?: React.CSSProperties }) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={{ ...(filled ? { fontVariationSettings: "'FILL' 1" } : null), ...style }}
    >
      {name}
    </span>
  );
}
