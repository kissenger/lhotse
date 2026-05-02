import { normaliseResearchLink, normaliseResearchLinks } from './research-links';

describe('research-links', () => {
  it('removes copied trailing punctuation from a single link', () => {
    expect(normaliseResearchLink('https://example.com/trail).')).toBe('https://example.com/trail');
    expect(normaliseResearchLink('"https://example.com/path],"')).toBe('https://example.com/path');
  });

  it('keeps valid parentheses that belong to the URL', () => {
    expect(normaliseResearchLink('https://example.com/wiki/Frog_(genus)')).toBe('https://example.com/wiki/Frog_(genus)');
  });

  it('extracts valid urls from wrapped and stringified link lists', () => {
    expect(normaliseResearchLinks('["https://example.com/a),", "invalid"]')).toEqual(['https://example.com/a']);
    expect(normaliseResearchLinks(['See https://example.com/b].', 'https://example.com/c'])).toEqual([
      'https://example.com/b',
      'https://example.com/c',
    ]);
  });
});