interface WordmarkProps {
  className?: string;
  showDot?: boolean;
}

export function Wordmark({ className, showDot = true }: WordmarkProps) {
  return (
    <span className={className}>
      <span className="font-display italic text-accent">h</span>
      <span className="font-medium tracking-tight">umanjs</span>
      {showDot && (
        <span
          aria-hidden="true"
          className="ml-[3px] inline-block h-1 w-1 translate-y-[-7px] rounded-full bg-accent align-middle"
        />
      )}
    </span>
  );
}
