import { Flame } from 'lucide-react';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <Flame className="h-5 w-5 text-primary-foreground" strokeWidth={2.4} />
      </span>
      <span className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
        AthleX
      </span>
    </div>
  );
}
