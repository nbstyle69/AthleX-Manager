import { HelpDockProvider } from '@/components/help/HelpDock';
import MarketplaceShell from '@/components/marketplace/MarketplaceShell';
import AthleteProgramsWorkspace from '@/components/programs/AthleteProgramsWorkspace';

export default function Page() {
  return (
    <HelpDockProvider page="programs">
      <MarketplaceShell tab="athletes">
        <AthleteProgramsWorkspace />
      </MarketplaceShell>
    </HelpDockProvider>
  );
}
