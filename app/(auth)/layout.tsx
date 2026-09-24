import { LandingHeader } from '@/components/landing/header';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ax-background font-sans text-ax-text antialiased">
      <LandingHeader variant="funnel" />
      <div className="flex min-h-[calc(100svh-var(--axp-header-height))] items-center justify-center py-10">
        {children}
      </div>
    </div>
  );
}
