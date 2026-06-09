import { describe, it, expect } from 'vitest';
import {
  parseQuery,
  isEmptyQuery,
  isMatch,
  countOccurrences,
  computeMatchRanges,
  buildSnippet,
} from '../queryUtils';

describe('parseQuery', () => {
  it('splits whitespace-separated keywords (lowercased)', () => {
    const p = parseQuery('Hello World');
    expect(p.keywords).toEqual(['hello', 'world']);
    expect(p.phrases).toEqual([]);
  });

  it('extracts quoted phrases and keeps remaining keywords', () => {
    const p = parseQuery('"machine learning" python');
    expect(p.phrases).toEqual(['machine learning']);
    expect(p.keywords).toEqual(['python']);
  });

  it('treats a whitespace-free CJK query as a single keyword', () => {
    const p = parseQuery('搜索话题');
    expect(p.keywords).toEqual(['搜索话题']);
  });

  it('isEmptyQuery is true only when no terms', () => {
    expect(isEmptyQuery(parseQuery('   '))).toBe(true);
    expect(isEmptyQuery(parseQuery('a'))).toBe(false);
  });
});

describe('isMatch', () => {
  it('AND requires every term present', () => {
    const p = parseQuery('foo bar');
    expect(isMatch('foo and bar', p, 'and')).toBe(true);
    expect(isMatch('only foo here', p, 'and')).toBe(false);
  });

  it('OR requires any term present', () => {
    const p = parseQuery('foo bar');
    expect(isMatch('only foo here', p, 'or')).toBe(true);
    expect(isMatch('nothing relevant', p, 'or')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isMatch('HELLO', parseQuery('hello'), 'and')).toBe(true);
  });

  it('phrase must match contiguously', () => {
    const p = parseQuery('"foo bar"');
    expect(isMatch('foo bar baz', p, 'and')).toBe(true);
    expect(isMatch('foo X bar', p, 'and')).toBe(false);
  });

  it('matches CJK substrings', () => {
    expect(isMatch('这是一个搜索话题示例', parseQuery('搜索话题'), 'and')).toBe(true);
  });
});

describe('countOccurrences', () => {
  it('counts all non-overlapping occurrences across terms', () => {
    expect(countOccurrences('aa aa aa', parseQuery('aa'))).toBe(3);
    expect(countOccurrences('foo bar foo', parseQuery('foo bar'))).toBe(3);
  });
});

describe('computeMatchRanges', () => {
  it('returns sorted ranges for matches', () => {
    const ranges = computeMatchRanges('foo bar foo', parseQuery('foo'));
    expect(ranges).toEqual([
      { start: 0, end: 3 },
      { start: 8, end: 11 },
    ]);
  });

  it('merges overlapping ranges from different terms', () => {
    // "ab" and "bc" overlap inside "abc"
    const ranges = computeMatchRanges('abc', parseQuery('ab bc'));
    expect(ranges).toEqual([{ start: 0, end: 3 }]);
  });

  it('returns empty array when nothing matches', () => {
    expect(computeMatchRanges('hello', parseQuery('zzz'))).toEqual([]);
  });

  it('does not treat content as HTML (ranges target raw text indices)', () => {
    const text = '<img src=x onerror=alert(1)> hello';
    const ranges = computeMatchRanges(text, parseQuery('hello'));
    expect(ranges).toEqual([{ start: text.indexOf('hello'), end: text.length }]);
  });
});

describe('buildSnippet', () => {
  it('returns full text and ranges when within maxLength', () => {
    const { snippet, ranges } = buildSnippet('short foo text', parseQuery('foo'), 150);
    expect(snippet).toBe('short foo text');
    expect(ranges.length).toBe(1);
  });

  it('centers snippet around the first match with ellipsis', () => {
    const long = 'x'.repeat(200) + 'NEEDLE' + 'y'.repeat(200);
    const { snippet, ranges } = buildSnippet(long, parseQuery('needle'), 50);
    expect(snippet).toContain('NEEDLE');
    expect(snippet.length).toBeLessThan(long.length);
    expect(ranges.length).toBe(1);
    // the reported range should actually point at NEEDLE inside the snippet
    const r = ranges[0];
    expect(snippet.slice(r.start, r.end).toLowerCase()).toBe('needle');
  });

  it('falls back to head slice when no match in a long text', () => {
    const long = 'z'.repeat(300);
    const { snippet, ranges } = buildSnippet(long, parseQuery('needle'), 50);
    expect(snippet.endsWith('…')).toBe(true);
    expect(ranges).toEqual([]);
  });
});
