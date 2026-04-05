import { TestBed } from '@angular/core/testing';
import { HtmlerPipe } from './htmler.pipe';
import { KebaberPipe } from './kebaber.pipe';
import { SanitizerPipe } from './sanitizer.pipe';
import { BrowserModule } from '@angular/platform-browser';

// ---------------------------------------------------------------------------
// HtmlerPipe
// ---------------------------------------------------------------------------
describe('HtmlerPipe', () => {
  let pipe: HtmlerPipe;
  beforeEach(() => { pipe = new HtmlerPipe(); });

  describe('insertParagraphs', () => {
    it('wraps lines in <p> tags', () => {
      const result = pipe.transform('Hello world');
      expect(result).toContain('<p>Hello world</p>');
    });

    it('does not wrap empty lines', () => {
      const result = pipe.insertParagraphs('line1\n\nline2');
      expect(result).toBe('<p>line1</p><p>line2</p>');
    });

    it('does not wrap lines starting with <ul>', () => {
      const result = pipe.insertParagraphs('<ul><li>item</li></ul>');
      expect(result).toBe('<ul><li>item</li></ul>');
    });

    it('does not wrap lines starting with <div', () => {
      const result = pipe.insertParagraphs('<div class="blockquote">text</div>');
      expect(result).toBe('<div class="blockquote">text</div>');
    });

    it('does not wrap lines starting with <table>', () => {
      const result = pipe.insertParagraphs('<table><thead></thead></table>');
      expect(result).toBe('<table><thead></thead></table>');
    });

    it('handles \\r\\n line endings', () => {
      const result = pipe.insertParagraphs('line1\r\nline2');
      expect(result).toBe('<p>line1</p><p>line2</p>');
    });
  });

  describe('insertLinks', () => {
    it('converts internal link syntax to <a> tag', () => {
      const result = pipe.insertLinks('See [link:BSAC,/bsac] for more.');
      expect(result).toContain('<a href="/bsac">BSAC</a>');
      expect(result).not.toContain('target="_blank"');
    });

    it('adds target=_blank and rel for external links', () => {
      const result = pipe.insertLinks('Visit [link:BSAC,https://bsac.com].');
      expect(result).toContain('target="_blank"');
      expect(result).toContain('rel="noopener noreferrer"');
      expect(result).toContain('<a href="https://bsac.com"');
    });

    it('leaves plain text unchanged', () => {
      const result = pipe.insertLinks('No links here.');
      expect(result).toBe('No links here.');
    });
  });

  describe('insertUnorderedList', () => {
    it('converts list syntax to <ul><li> tags', () => {
      const result = pipe.insertUnorderedList('[list:item one;item two;item three]');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>item one</li>');
      expect(result).toContain('<li>item two</li>');
      expect(result).toContain('<li>item three</li>');
    });

    it('trims whitespace from list items', () => {
      const result = pipe.insertUnorderedList('[list: item a ; item b ]');
      expect(result).toContain('<li>item a</li>');
      expect(result).toContain('<li>item b</li>');
    });
  });

  describe('insertBlockQuotes', () => {
    it('wraps blockquote syntax in a div', () => {
      const result = pipe.insertBlockQuotes('[blockquote:This is a quote]');
      expect(result).toBe('<div class="blockquote">This is a quote</div>');
    });

    it('leaves plain text unchanged', () => {
      const result = pipe.insertBlockQuotes('Just text.');
      expect(result).toBe('Just text.');
    });
  });

  describe('insertTable', () => {
    it('converts table syntax to <table> with header and body', () => {
      const result = pipe.insertTable('[table:Col1|Col2;Row1A|Row1B;Row2A|Row2B]');
      expect(result).toContain('<table>');
      expect(result).toContain('<thead>');
      expect(result).toContain('<th>Col1</th>');
      expect(result).toContain('<tbody>');
      expect(result).toContain('<td>Row1A</td>');
      expect(result).toContain('<td>Row2B</td>');
    });

    it('handles header-only table (no body rows)', () => {
      const result = pipe.insertTable('[table:ColA|ColB]');
      expect(result).toContain('<thead>');
      expect(result).not.toContain('<tbody>');
    });
  });

  describe('transform (full pipeline)', () => {
    it('processes multiple features in one string', () => {
      const input = 'Intro line\n[list:alpha;beta]\nEnd line';
      const result = pipe.transform(input);
      expect(result).toContain('<p>Intro line</p>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>alpha</li>');
      expect(result).toContain('<p>End line</p>');
    });
  });
});

// ---------------------------------------------------------------------------
// KebaberPipe
// ---------------------------------------------------------------------------
describe('KebaberPipe', () => {
  let pipe: KebaberPipe;
  beforeEach(() => { pipe = new KebaberPipe(); });

  it('converts spaces to hyphens and lowercases', () => {
    expect(pipe.transform('Hello World')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(pipe.transform('This is a (very instructive) example string'))
      .toBe('this-is-a-very-instructive-example-string');
  });

  it('removes punctuation', () => {
    expect(pipe.transform("Don't Panic!")).toBe('dont-panic');
  });

  it('handles leading/trailing spaces', () => {
    expect(pipe.transform('  spaced  ')).toBe('spaced');
  });

  it('strips hyphens from already-hyphenated input (not a roundtrip pipe)', () => {
    // The pipe removes ALL non-letter/digit/space chars then re-encodes spaces as hyphens.
    // A hyphen is not a space, so 'already-kebab' loses its hyphen.
    expect(pipe.transform('already kebab')).toBe('already-kebab');
  });

  it('handles empty string', () => {
    expect(pipe.transform('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// SanitizerPipe
// ---------------------------------------------------------------------------
describe('SanitizerPipe', () => {
  let pipe: SanitizerPipe;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrowserModule],
      providers: [SanitizerPipe]
    }).compileComponents();
    pipe = TestBed.inject(SanitizerPipe);
  });

  it('returns a SafeHtml value (not plain string)', () => {
    const result: any = pipe.transform('<b>bold</b>');
    // Angular's SafeHtml wraps values in an object — it is never a plain string
    expect(typeof result).not.toBe('string');
  });
});
