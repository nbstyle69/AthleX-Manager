import Image from 'next/image';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="relative flex h-8 w-8 items-center justify-center">
        <Image
          src="/athex-mark-light.png"
          alt="AthleX"
          width={32}
          height={32}
          priority
          className="h-8 w-8 object-contain logo-mark-dark"
        />
        <Image
          src="/athex-mark.png"
          alt="AthleX"
          width={32}
          height={32}
          priority
          className="absolute inset-0 h-8 w-8 object-contain logo-mark-light"
        />
      </span>
      <span className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
        AthleX
      </span>
    </div>
  );
}
