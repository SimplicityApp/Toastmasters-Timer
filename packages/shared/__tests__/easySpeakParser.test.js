import { isEasySpeakFormat, parseEasySpeakText } from '../easySpeakParser.js';

describe('isEasySpeakFormat', () => {
  it('returns true for text containing "Actual Meeting Roles"', () => {
    expect(isEasySpeakFormat('Actual Meeting Roles\n1st Speaker\tAlice')).toBe(true);
  });

  it('returns true for text containing the tab-separated header "Role\\tCL\\tPresenter"', () => {
    expect(isEasySpeakFormat('Role\tCL\tPresenter\n1st Speaker\tAlice')).toBe(true);
  });

  it('returns true when text starts with an ordinal speaker pattern (1st Speaker ...)', () => {
    expect(isEasySpeakFormat('1st Speaker Alice')).toBe(true);
  });

  it('returns true for "General Evaluator John"', () => {
    expect(isEasySpeakFormat('General Evaluator John')).toBe(true);
  });

  it('returns true for "Table Topics Master John"', () => {
    expect(isEasySpeakFormat('Table Topics Master John')).toBe(true);
  });

  it('returns false for plain text "Hello world"', () => {
    expect(isEasySpeakFormat('Hello world')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isEasySpeakFormat('')).toBe(false);
  });
});

describe('parseEasySpeakText', () => {
  describe('tab-separated format', () => {
    it('parses "1st Speaker\\tAlice\\n2nd Speaker\\tBob" into two Standard Speech entries', () => {
      const text = '1st Speaker\tAlice\n2nd Speaker\tBob';
      const result = parseEasySpeakText(text);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ name: 'Alice', role: 'Standard Speech' });
      expect(result[1]).toMatchObject({ name: 'Bob', role: 'Standard Speech' });
    });

    it('parses "General Evaluator\\tCarol" into a General Evaluation entry', () => {
      const text = 'General Evaluator\tCarol';
      const result = parseEasySpeakText(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ name: 'Carol', role: 'General Evaluation' });
    });

    it('parses "1st Evaluator\\tBob" into a Speech Evaluation entry', () => {
      const text = '1st Evaluator\tBob';
      const result = parseEasySpeakText(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ name: 'Bob', role: 'Speech Evaluation' });
    });
  });

  describe('multi-line format (role on one line, name on next)', () => {
    it('parses alternating role/name lines', () => {
      const text = '1st Speaker\nAlice\n1st Evaluator\nBob';
      const result = parseEasySpeakText(text);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ name: 'Alice', role: 'Standard Speech' });
      expect(result[1]).toMatchObject({ name: 'Bob', role: 'Speech Evaluation' });
    });
  });

  describe('excluded roles are filtered out', () => {
    it('excludes Chairperson, Timer, Toastmaster, and Sergeant at Arms but keeps 1st Speaker', () => {
      const text = [
        'Chairperson\tJohn',
        '1st Speaker\tAlice',
        'Timer\tBob',
        'Sergeant at Arms\tCarol',
      ].join('\n');
      const result = parseEasySpeakText(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ name: 'Alice', role: 'Standard Speech' });
    });

    it('excludes Table Topics Master', () => {
      const text = 'Table Topics Master\tDave\n1st Speaker\tAlice';
      const result = parseEasySpeakText(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ name: 'Alice', role: 'Standard Speech' });
    });
  });

  describe('empty and whitespace input', () => {
    it('returns an empty array for an empty string', () => {
      expect(parseEasySpeakText('')).toEqual([]);
    });

    it('returns an empty array for whitespace-only input', () => {
      expect(parseEasySpeakText('   \n  \n  ')).toEqual([]);
    });
  });

  describe('Ice Breaker detection via speech details', () => {
    it('maps a speaker to Ice Breaker when speech details contain "Icebreaker"', () => {
      // Use pathways keyword to trigger showSpeechDetailsMode, then put
      // the speaker name followed by an Icebreaker speech title.
      const text = [
        '1st Speaker\tAlice',
        'Icebreaker - The Ice Breaker (pathways)',
      ].join('\n');
      const result = parseEasySpeakText(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ name: 'Alice', role: 'Ice Breaker' });
    });

    it('maps a speaker to Ice Breaker when speech details contain "ice breaker"', () => {
      const text = [
        '1st Speaker\tAlice',
        'The ice breaker speech (pathways)',
      ].join('\n');
      const result = parseEasySpeakText(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ name: 'Alice', role: 'Ice Breaker' });
    });
  });

  describe('result item shape', () => {
    it('each item has name, role, originalShortRole, and speechDetails properties', () => {
      const text = '1st Speaker\tAlice';
      const result = parseEasySpeakText(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('role');
      expect(result[0]).toHaveProperty('originalShortRole');
      expect(result[0]).toHaveProperty('speechDetails');
    });
  });
});
