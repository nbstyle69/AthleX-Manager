'use client';

/**
 * Réglages, « Renouvellement au comptoir » (maquette 67:1290, 3 états).
 * Box qui ne vend pas en ligne : interrupteur affiché activé et grisé — la
 * base laisse alors le comptoir ouvert quel que soit le réglage.
 */
export default function CounterRenewalField({
  allow, sellsOnline, onToggle,
}: { allow: boolean; sellsOnline: boolean; onToggle: () => void }) {
  const on = sellsOnline ? allow : true;
  const disabled = !sellsOnline;
  return (
    <div data-testid="renouvellement-comptoir">
      <p className="block text-xs font-bold text-ax-text-secondary uppercase tracking-wider mb-1.5" id="renouvellement-comptoir">
        Renouvellement au comptoir
      </p>
      <div className="flex items-center gap-2.5">
        <button
          type="button" role="switch" aria-checked={on} aria-labelledby="renouvellement-comptoir-libelle"
          disabled={disabled}
          onClick={onToggle}
          className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface disabled:opacity-50 disabled:cursor-not-allowed ${on ? 'bg-ax-accent border-ax-accent' : 'bg-ax-surface-secondary border-ax-input-border'}`}
        >
          <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${on ? 'left-[18px] bg-ax-accent-foreground' : 'left-0.5 bg-ax-text-secondary'}`} />
        </button>
        <span id="renouvellement-comptoir-libelle" className={`text-sm font-semibold text-ax-text ${disabled ? 'opacity-50' : ''}`}>
          Autoriser le renouvellement au comptoir
        </span>
      </div>
      <p className="text-xs text-ax-text-muted mt-1.5">
        {disabled
          ? 'Ta box ne vend pas encore en ligne : le comptoir reste ouvert.'
          : 'Désactivé : après un premier paiement au comptoir, tes membres passent au paiement en ligne avant la fin de leur période. Activé : tu peux encaisser une nouvelle période à la main (espèces, chèque, chèques sport…).'}
      </p>
    </div>
  );
}
