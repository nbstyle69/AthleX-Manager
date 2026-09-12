import { HelpDockProvider } from '@/components/help/HelpDock';
import MarketplaceShell from '@/components/marketplace/MarketplaceShell';
import MarketplaceWorkspace from '@/components/marketplace/MarketplaceWorkspace';

export default function Page() {
  return (
    <HelpDockProvider page="marketplace-offers">
      <MarketplaceShell tab="offers">
        <MarketplaceWorkspace tab="mine" />
      </MarketplaceShell>
    </HelpDockProvider>
  );
}
