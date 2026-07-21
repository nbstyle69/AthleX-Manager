import { tournamentStatusInfo } from '@/lib/utils';

const PAST = '2000-01-01T00:00:00.000Z';
const FUTURE = '2999-01-01T00:00:00.000Z';

describe('tournamentStatusInfo', () => {
  it('maps open to registrations open', () => {
    const s = tournamentStatusInfo('open', FUTURE);
    expect(s.key).toBe('open');
    expect(s.label).toBe('Inscriptions ouvertes');
  });

  it('maps active to en cours', () => {
    const s = tournamentStatusInfo('active', FUTURE);
    expect(s.key).toBe('active');
    expect(s.label).toBe('En cours');
  });

  it('maps completed to clôturé regardless of dates', () => {
    expect(tournamentStatusInfo('completed', FUTURE).key).toBe('completed');
    expect(tournamentStatusInfo('completed', PAST).label).toBe('Clôturé');
  });

  it('derives "à clôturer" when end date passed but not completed', () => {
    expect(tournamentStatusInfo('open', PAST).key).toBe('ended');
    expect(tournamentStatusInfo('active', PAST).key).toBe('ended');
  });

  it('stays open when no end date is provided', () => {
    expect(tournamentStatusInfo('open', null).key).toBe('open');
    expect(tournamentStatusInfo('open').key).toBe('open');
  });
});
