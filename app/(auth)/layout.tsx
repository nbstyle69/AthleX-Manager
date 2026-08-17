import { LandingHeader } from '@/components/landing/header';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <LandingHeader variant="funnel" />
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-10">
        {children}
      </div>
    </div>
  );
}
