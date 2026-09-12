'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getMyBox } from '@/lib/getMyBox';
import { readBoxConnectStatus } from '@/lib/boxPayments';
import HelpButton from '@/components/help/HelpButton';
import MembershipPlansSection from '@/components/plans/MembershipPlansSection';
import PromoCodesSection from '@/components/plans/PromoCodesSection';

export default function PlansWorkspace() {
  const supabase = createClient();
  const [boxId, setBoxId] = useState<string | null>(null);
  const [paymentsReady, setPaymentsReady] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      const active = await getMyBox(supabase);
      if (!active || annule) return;
      setBoxId(active.id);
      const connect = await readBoxConnectStatus(supabase, active.id);
      if (!annule) setPaymentsReady(connect.onboardingComplete);
    })();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-white">Formules</h1>
          <HelpButton />
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Offres d&apos;accès à la salle et codes promo
        </p>
      </div>

      <MembershipPlansSection boxId={boxId} />
      <PromoCodesSection boxId={boxId} paymentsReady={paymentsReady} />
    </div>
  );
}
