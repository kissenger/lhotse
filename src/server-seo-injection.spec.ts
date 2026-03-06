import { SeoPayload, escapeHtmlAttr, injectJsonLdIntoHead, injectSeoPayloadIntoHtml, upsertCanonicalTag, upsertMetaTag } from './server-seo-injection';

describe('server-seo-injection', () => {
  const siteUrl = 'https://snorkelology.co.uk';

  const payload: SeoPayload = {
    title: 'Title "with" <chars>',
    description: 'Desc & details',
    keywords: 'one, two',
    canonicalPath: '/home',
    ogType: 'website',
    twitterImage: 'https://img.test/a.png',
    ogImage: 'https://img.test/a.png',
    schemas: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Snorkelology' }]
  };

  it('escapes html attributes safely', () => {
    expect(escapeHtmlAttr('&"<>')).toBe('&amp;&quot;&lt;&gt;');
  });

  it('upserts meta tags even when existing tag has bare content attribute', () => {
    const html = '<head><meta property="og:description" content></head>';
    const result = upsertMetaTag(html, 'property', 'og:description', 'A description');
    expect(result).toContain('<meta property="og:description" content="A description">');
  });

  it('upserts canonical tag', () => {
    const html = '<head><link rel="canonical" href=""></head>';
    const result = upsertCanonicalTag(html, 'https://snorkelology.co.uk/home');
    expect(result).toContain('<link rel="canonical" href="https://snorkelology.co.uk/home">');
  });

  it('injects JSON-LD scripts before closing head', () => {
    const html = '<html><head><title>x</title></head><body></body></html>';
    const result = injectJsonLdIntoHead(html, payload.schemas);
    expect(result).toContain('<script type="application/ld+json">');
    expect(result.indexOf('</head>')).toBeGreaterThan(result.indexOf('application/ld+json'));
  });

  it('injects all expected SEO tags from payload', () => {
    const html = `
      <html>
      <head>
        <title>Old</title>
        <meta name="description" content>
        <meta name="keywords" content="">
        <link rel="canonical" href="">
        <meta property="og:type" content>
        <meta property="og:title" content>
        <meta property="og:description" content>
        <meta property="og:image" content>
        <meta property="og:url" content>
        <meta name="twitter:card" content>
        <meta name="twitter:title" content>
        <meta name="twitter:description" content>
        <meta name="twitter:image" content>
      </head>
      <body></body>
      </html>
    `;

    const result = injectSeoPayloadIntoHtml(html, payload, siteUrl);

    expect(result).toContain('<title>Title &quot;with&quot; &lt;chars&gt;</title>');
    expect(result).toContain('<meta name="description" content="Desc &amp; details">');
    expect(result).toContain('<meta property="og:image" content="https://img.test/a.png">');
    expect(result).toContain('<meta property="og:url" content="https://snorkelology.co.uk/home">');
    expect(result).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(result).toContain('<script type="application/ld+json">');
  });

  it('normalizes canonical path without leading slash', () => {
    const html = '<html><head><title>Old</title></head><body></body></html>';
    const result = injectSeoPayloadIntoHtml(html, { ...payload, canonicalPath: 'blog/post' }, siteUrl);
    expect(result).toContain('<meta property="og:url" content="https://snorkelology.co.uk/blog/post">');
    expect(result).toContain('<link rel="canonical" href="https://snorkelology.co.uk/blog/post">');
  });
});
