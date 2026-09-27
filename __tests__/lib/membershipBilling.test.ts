import {
  planFirstBilling, prorataCents, parisInstant, parseDueDate, isBillingDay,
  commitmentEndIso, type BillingPlanNow, type BillingPlanDeferred,
} from '@/lib/membershipBilling';

const PRICE = 6000;
const s = (iso: string) => Date.parse(iso) / 1000;
const now = (iso: string) => new Date(iso);
const asNow = (p: unknown) => p as BillingPlanNow;
const asDeferred = (p: unknown) => p as BillingPlanDeferred;

describe('parisInstant — 06:00 heure de Paris', () => {
  it('heure d’été (UTC+2) et heure d’hiver (UTC+1)', () => {
    expect(parisInstant({ y: 2026, m: 10, d: 5 })).toBe(s('2026-10-05T04:00:00Z'));
    expect(parisInstant({ y: 2026, m: 11, d: 5 })).toBe(s('2026-11-05T05:00:00Z'));
  });
});

describe('isBillingDay', () => {
  it('accepte 1 à 10, refuse le reste', () => {
    expect([1, 5, 10].every(isBillingDay)).toBe(true);
    expect([0, 11, 2.5, '5', null, undefined].some(isBillingDay)).toBe(false);
  });
});

describe('sans échéance', () => {
  it('jour déjà passé ce mois : prorata jusqu’au jour du mois suivant (mois de 30 jours)', () => {
    const p = asNow(planFirstBilling({ now: now('2026-09-27T10:00:00Z'), billingDay: 5, priceCents: PRICE }));
    expect(p.kind).toBe('now');
    expect(p.anchor).toBe(s('2026-10-05T04:00:00Z'));
    // 7 j 18 h sur 30 jours
    expect(p.todayCents).toBe(1550);
    expect(p.nextChargeDate).toBe('2026-10-05');
    expect(p.recurringCents).toBe(PRICE);
    // Jamais payable après l'ancre : au plus 24 h.
    expect(p.expiresAt).toBe(s('2026-09-28T10:00:00Z'));
  });

  it('jour à venir ce mois', () => {
    const p = asNow(planFirstBilling({ now: now('2026-10-03T10:00:00Z'), billingDay: 10, priceCents: PRICE }));
    expect(p.anchor).toBe(s('2026-10-10T04:00:00Z'));
    expect(p.todayCents).toBe(1350); // 6 j 18 h sur 30 jours
  });

  it('jour choisi = aujourd’hui : plein tarif tout de suite, sans ancre, session close à minuit', () => {
    const p = asNow(planFirstBilling({ now: now('2026-10-05T10:00:00Z'), billingDay: 5, priceCents: PRICE }));
    expect(p.todayCents).toBe(PRICE);
    expect(p.anchor).toBeNull();
    expect(p.nextChargeDate).toBe('2026-11-05');
    expect(p.expiresAt).toBe(s('2026-10-05T22:00:00Z'));
  });

  it('« aujourd’hui » se compte à Paris : 00:30 le 5 à Paris = encore le 4 en UTC', () => {
    const p = asNow(planFirstBilling({ now: now('2026-10-04T22:30:00Z'), billingDay: 5, priceCents: PRICE }));
    expect(p.todayCents).toBe(PRICE);
    expect(p.anchor).toBeNull();
  });

  it.each([
    ['février (28 jours)', '2027-02-20T11:00:00Z', 1875],
    ['février bissextile (29 jours)', '2028-02-20T11:00:00Z', 2017], // 9 j 18 h sur 29 jours,
    ['décembre (31 jours)', '2026-12-20T11:00:00Z', 2274],
  ])('prorata sur un mois de %s', (_l, at, expected) => {
    const p = asNow(planFirstBilling({ now: now(at), billingDay: 1, priceCents: PRICE }));
    expect(p.todayCents).toBe(expected);
  });
});

describe('avec une échéance future', () => {
  const NOW = now('2026-09-27T10:00:00Z');

  it('rien aujourd’hui, essai jusqu’à l’échéance, prorata jusqu’au jour choisi, ancre au jour choisi', () => {
    const p = asDeferred(planFirstBilling({ now: NOW, billingDay: 5, priceCents: PRICE, dueDate: '2026-10-15' }));
    expect(p.kind).toBe('deferred');
    expect(p.todayCents).toBe(0);
    expect(p.trialEnd).toBe(s('2026-10-15T04:00:00Z'));
    expect(p.anchor).toBe(s('2026-11-05T05:00:00Z'));
    expect(p.firstChargeDate).toBe('2026-10-15');
    // 21 j + 1 h (changement d'heure) sur 31 jours
    expect(p.firstChargeCents).toBe(prorataCents(PRICE, p.trialEnd, p.anchor!));
    expect(p.firstChargeCents).toBe(4073);
    expect(p.mergedProrataCents).toBe(0);
  });

  it('échéance = jour choisi : plein tarif à l’échéance, pas d’ancre', () => {
    const p = asDeferred(planFirstBilling({ now: NOW, billingDay: 5, priceCents: PRICE, dueDate: '2026-11-05' }));
    expect(p.trialEnd).toBe(s('2026-11-05T05:00:00Z'));
    expect(p.anchor).toBeNull();
    expect(p.firstChargeCents).toBe(PRICE);
  });

  it('échéance en fin de mois à moins de 7 jours du jour choisi : un seul prélèvement fusionné', () => {
    const p = asDeferred(planFirstBilling({ now: NOW, billingDay: 5, priceCents: PRICE, dueDate: '2027-01-31' }));
    expect(p.trialEnd).toBe(s('2027-02-05T05:00:00Z'));
    expect(p.anchor).toBeNull();
    expect(p.firstChargeDate).toBe('2027-02-05');
    // 5 jours sur 31 (5 janv. → 5 févr.)
    expect(p.mergedProrataCents).toBe(968);
    expect(p.firstChargeCents).toBe(968 + PRICE);
  });

  it('à 7 jours pile du jour choisi : pas de fusion', () => {
    const p = asDeferred(planFirstBilling({ now: NOW, billingDay: 10, priceCents: PRICE, dueDate: '2026-11-03' }));
    expect(p.anchor).toBe(s('2026-11-10T05:00:00Z'));
    expect(p.mergedProrataCents).toBe(0);
  });

  it('échéance du jour ou passée : bascule sur le paiement immédiat', () => {
    for (const due of ['2026-09-27', '2026-09-01']) {
      const p = asNow(planFirstBilling({ now: NOW, billingDay: 5, priceCents: PRICE, dueDate: due }));
      expect(p.kind).toBe('now');
      expect(p.dueDateIgnored).toBe(true);
      expect(p.todayCents).toBe(1550);
    }
  });

  it('échéance à plus de 12 mois (modifiée en base) : refus', () => {
    expect(planFirstBilling({ now: NOW, billingDay: 5, priceCents: PRICE, dueDate: '2027-09-28' }))
      .toEqual({ refusal: 'DUE_DATE_TOO_FAR' });
    expect(planFirstBilling({ now: NOW, billingDay: 5, priceCents: PRICE, dueDate: '2027-09-27' }))
      .toHaveProperty('kind', 'deferred');
  });

  it('échéance mal formée : refus', () => {
    for (const due of ['2026-02-30', '27/10/2026', 'demain']) {
      expect(planFirstBilling({ now: NOW, billingDay: 5, priceCents: PRICE, dueDate: due }))
        .toEqual({ refusal: 'DUE_DATE_INVALID' });
    }
  });

  it('la session expire au plus tard une heure avant la fin d’essai', () => {
    const p = asDeferred(planFirstBilling({ now: now('2026-10-14T10:00:00Z'), billingDay: 5, priceCents: PRICE, dueDate: '2026-10-15' }));
    expect(p.expiresAt).toBe(s('2026-10-15T03:00:00Z'));
  });

  it('l’engagement court depuis l’échéance', () => {
    const p = planFirstBilling({ now: NOW, billingDay: 5, priceCents: PRICE, dueDate: '2026-10-15' });
    expect(commitmentEndIso(p as BillingPlanDeferred, 12, NOW)).toBe('2027-10-14T22:00:00.000Z');
  });
});

describe('parseDueDate', () => {
  it('lit AAAA-MM-JJ réel seulement', () => {
    expect(parseDueDate('2028-02-29')).toEqual({ y: 2028, m: 2, d: 29 });
    expect(parseDueDate('2027-02-29')).toBeNull();
  });
});
