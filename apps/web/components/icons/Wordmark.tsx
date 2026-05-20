interface WordmarkProps {
  className?: string;
  showDot?: boolean;
}

export function Wordmark({ className, showDot = true }: WordmarkProps) {
  return (
    <span className={className}>
      <span className="font-semibold tracking-tight">human</span>
      <span className="font-light tracking-tight text-muted">js</span>
      {showDot && (
        <span
          aria-hidden="true"
          className="ml-[2px] inline-block h-1 w-1 translate-y-[-6px] rounded-full bg-accent align-middle"
        />
      )}
    </span>
  );
}
