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

  it('derives "date de fin passée" when end date passed but not completed', () => {
    expect(tournamentStatusInfo('open', PAST).key).toBe('ended');
    expect(tournamentStatusInfo('active', PAST).key).toBe('ended');
    expect(tournamentStatusInfo('active', PAST).description).toContain('Terminer le tournoi');
  });

  it('derives "en révision" when every WOD is closed', () => {
    const s = tournamentStatusInfo('active', FUTURE, { total: 3, closed: 3 });
    expect(s.key).toBe('review');
    expect(s.label).toBe('En révision');
  });

  it('keeps review over the end-date reminder — closing WODs is already done', () => {
    expect(tournamentStatusInfo('active', PAST, { total: 2, closed: 2 }).key).toBe('review');
  });

  it('stays active while at least one WOD accepts scores', () => {
    expect(tournamentStatusInfo('active', FUTURE, { total: 3, closed: 2 }).key).toBe('active');
  });

  it('never derives review without WODs, nor from open, nor from completed', () => {
    expect(tournamentStatusInfo('active', FUTURE, { total: 0, closed: 0 }).key).toBe('active');
    expect(tournamentStatusInfo('open', FUTURE, { total: 2, closed: 2 }).key).toBe('open');
    expect(tournamentStatusInfo('completed', FUTURE, { total: 2, closed: 2 }).key).toBe('completed');
  });

  it('stays open when no end date is provided', () => {
    expect(tournamentStatusInfo('open', null).key).toBe('open');
    expect(tournamentStatusInfo('open').key).toBe('open');
  });
});
