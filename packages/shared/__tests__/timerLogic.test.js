import {
  calculateStatus,
  formatTime,
  getPhaseInfo,
  formatPhaseText,
} from '../timerLogic.js';

const STANDARD_RULES = { green: 300, yellow: 360, red: 420 };

describe('calculateStatus', () => {
  it('returns blue when rules is null', () => {
    expect(calculateStatus(100, null)).toBe('blue');
  });

  it('returns blue when rules is undefined', () => {
    expect(calculateStatus(100, undefined)).toBe('blue');
  });

  it('returns blue when rules is missing the green property', () => {
    expect(calculateStatus(100, { yellow: 360, red: 420 })).toBe('blue');
  });

  it('returns blue when rules.green is not a number', () => {
    expect(calculateStatus(100, { green: '300', yellow: 360, red: 420 })).toBe('blue');
  });

  it('returns blue at 0 seconds (before any threshold)', () => {
    expect(calculateStatus(0, STANDARD_RULES)).toBe('blue');
  });

  it('returns blue when elapsed is less than green threshold', () => {
    expect(calculateStatus(299, STANDARD_RULES)).toBe('blue');
  });

  it('returns green at the exact green boundary', () => {
    expect(calculateStatus(300, STANDARD_RULES)).toBe('green');
  });

  it('returns green between green and yellow thresholds', () => {
    expect(calculateStatus(330, STANDARD_RULES)).toBe('green');
  });

  it('returns green at one second before yellow threshold', () => {
    expect(calculateStatus(359, STANDARD_RULES)).toBe('green');
  });

  it('returns yellow at the exact yellow boundary', () => {
    expect(calculateStatus(360, STANDARD_RULES)).toBe('yellow');
  });

  it('returns yellow between yellow and red thresholds', () => {
    expect(calculateStatus(390, STANDARD_RULES)).toBe('yellow');
  });

  it('returns yellow at one second before red threshold', () => {
    expect(calculateStatus(419, STANDARD_RULES)).toBe('yellow');
  });

  it('returns red at the exact red boundary', () => {
    expect(calculateStatus(420, STANDARD_RULES)).toBe('red');
  });

  it('returns red well past the red threshold', () => {
    expect(calculateStatus(600, STANDARD_RULES)).toBe('red');
  });
});

describe('formatTime', () => {
  it('formats 0 seconds as "00:00"', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('formats 45 seconds as "00:45"', () => {
    expect(formatTime(45)).toBe('00:45');
  });

  it('formats exactly 60 seconds as "01:00"', () => {
    expect(formatTime(60)).toBe('01:00');
  });

  it('formats 125 seconds as "02:05"', () => {
    expect(formatTime(125)).toBe('02:05');
  });

  it('formats 3661 seconds as "61:01"', () => {
    expect(formatTime(3661)).toBe('61:01');
  });

  it('truncates fractional seconds (125.7 → "02:05")', () => {
    expect(formatTime(125.7)).toBe('02:05');
  });
});

describe('getPhaseInfo', () => {
  it('returns null when rules is null', () => {
    expect(getPhaseInfo(150, null, 'blue')).toBeNull();
  });

  it('returns null when rules is undefined', () => {
    expect(getPhaseInfo(150, undefined, 'blue')).toBeNull();
  });

  it('returns blue phase info with green endsAt when status is blue', () => {
    const result = getPhaseInfo(100, STANDARD_RULES, 'blue');
    expect(result).toEqual({
      phase: 'Blue phase',
      endsAt: 300,
      nextPhase: 'Green',
    });
  });

  it('returns green phase info with yellow endsAt when status is green', () => {
    const result = getPhaseInfo(330, STANDARD_RULES, 'green');
    expect(result).toEqual({
      phase: 'Green phase',
      endsAt: 360,
      nextPhase: 'Yellow',
    });
  });

  it('returns yellow phase info with red endsAt when status is yellow', () => {
    const result = getPhaseInfo(390, STANDARD_RULES, 'yellow');
    expect(result).toEqual({
      phase: 'Yellow phase',
      endsAt: 420,
      nextPhase: 'Red',
    });
  });

  it('returns red phase info with null endsAt and null nextPhase when status is red', () => {
    const result = getPhaseInfo(500, STANDARD_RULES, 'red');
    expect(result).toEqual({
      phase: 'Red phase',
      endsAt: null,
      nextPhase: null,
    });
  });
});

describe('formatPhaseText', () => {
  it('returns empty string for null phaseInfo', () => {
    expect(formatPhaseText(null)).toBe('');
  });

  it('returns empty string for undefined phaseInfo', () => {
    expect(formatPhaseText(undefined)).toBe('');
  });

  it('includes "ends at MM:SS" for a phase that has an endsAt value', () => {
    const phaseInfo = { phase: 'Blue phase', endsAt: 300, nextPhase: 'Green' };
    const result = formatPhaseText(phaseInfo);
    expect(result).toContain('ends at');
    expect(result).toContain('05:00');
    expect(result).toBe('Blue phase (ends at 05:00)');
  });

  it('includes "ends at MM:SS" for the green phase', () => {
    const phaseInfo = { phase: 'Green phase', endsAt: 360, nextPhase: 'Yellow' };
    const result = formatPhaseText(phaseInfo);
    expect(result).toBe('Green phase (ends at 06:00)');
  });

  it('includes "ends at MM:SS" for the yellow phase', () => {
    const phaseInfo = { phase: 'Yellow phase', endsAt: 420, nextPhase: 'Red' };
    const result = formatPhaseText(phaseInfo);
    expect(result).toBe('Yellow phase (ends at 07:00)');
  });

  it('returns just the phase name for red phase (endsAt is null)', () => {
    const phaseInfo = { phase: 'Red phase', endsAt: null, nextPhase: null };
    const result = formatPhaseText(phaseInfo);
    expect(result).toBe('Red phase');
  });
});
