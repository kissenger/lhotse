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

  it('injects metaTags (robots noindex) from payload', () => {
    const html = '<html><head><title>Old</title></head><body></body></html>';
    const result = injectSeoPayloadIntoHtml(html, {
      ...payload,
      metaTags: [{ key: 'name', keyValue: 'robots', content: 'noindex,follow' }]
    }, siteUrl);
    expect(result).toContain('<meta name="robots" content="noindex,follow">');
  });

  it('injects metaTags (robots index with max-image-preview) from payload', () => {
    const html = '<html><head><title>Old</title></head><body></body></html>';
    const result = injectSeoPayloadIntoHtml(html, {
      ...payload,
      metaTags: [{ key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' }]
    }, siteUrl);
    expect(result).toContain('<meta name="robots" content="index,follow,max-image-preview:large">');
  });

  it('injects og:site_name property metaTag', () => {
    const html = '<html><head><title>Old</title></head><body></body></html>';
    const result = injectSeoPayloadIntoHtml(html, {
      ...payload,
      metaTags: [{ key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' }]
    }, siteUrl);
    expect(result).toContain('<meta property="og:site_name" content="Snorkelology">');
  });

  it('injects twitter:site metaTag', () => {
    const html = '<html><head><title>Old</title></head><body></body></html>';
    const result = injectSeoPayloadIntoHtml(html, {
      ...payload,
      metaTags: [{ key: 'name', keyValue: 'twitter:site', content: '@snorkelology' }]
    }, siteUrl);
    expect(result).toContain('<meta name="twitter:site" content="@snorkelology">');
  });

  it('injects multiple schemas as separate script blocks', () => {
    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Snorkelling Map of Britain', item: `${siteUrl}/map` }
      ]
    };
    const mapSchema = {
      '@context': 'https://schema.org',
      '@type': 'Map',
      name: 'Interactive Snorkelling Map of Britain — 100+ Sites',
      url: `${siteUrl}/map`
    };
    const imageSchema = {
      '@context': 'https://schema.org',
      '@type': 'ImageObject',
      url: `${siteUrl}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
      representativeOfPage: true
    };
    const html = '<html><head><title>Old</title></head><body></body></html>';
    const result = injectSeoPayloadIntoHtml(html, { ...payload, schemas: [breadcrumbSchema, mapSchema, imageSchema] }, siteUrl);
    const scriptMatches = result.match(/<script type="application\/ld\+json">/g);
    expect(scriptMatches).not.toBeNull();
    expect(scriptMatches!.length).toBe(3);
  });

  it('injects BreadcrumbList schema with correct structure', () => {
    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Snorkelling Map of Britain', item: `${siteUrl}/map` }
      ]
    };
    const html = '<html><head><title>Old</title></head><body></body></html>';
    const result = injectSeoPayloadIntoHtml(html, { ...payload, schemas: [breadcrumbSchema] }, siteUrl);
    expect(result).toContain('"@type":"BreadcrumbList"');
    expect(result).toContain('"@type":"ListItem"');
    expect(result).toContain('"position":1');
    expect(result).toContain('"position":2');
    expect(result).toContain(`"item":"${siteUrl}/map"`);
  });

  it('injects Map schema with spatialCoverage and about array', () => {
    const mapCreativeWorkSchema = {
      '@context': 'https://schema.org',
      '@type': 'Map',
      name: 'Interactive Snorkelling Map of Britain — 100+ Sites',
      url: `${siteUrl}/map`,
      about: [
        { '@type': 'Thing', name: 'Snorkelling sites in Britain' },
        { '@type': 'Thing', name: 'Coastal snorkelling UK' }
      ],
      spatialCoverage: {
        '@type': 'Place',
        name: 'Britain',
        containedInPlace: { '@type': 'Country', name: 'United Kingdom' }
      }
    };
    const html = '<html><head><title>Old</title></head><body></body></html>';
    const result = injectSeoPayloadIntoHtml(html, { ...payload, schemas: [mapCreativeWorkSchema] }, siteUrl);
    expect(result).toContain('"@type":"Map"');
    expect(result).toContain('"spatialCoverage"');
    expect(result).toContain('"@type":"Country"');
    expect(result).toContain('"Snorkelling sites in Britain"');
    expect(result).toContain('"Coastal snorkelling UK"');
  });

  it('injects ImageObject schema with representativeOfPage', () => {
    const imageSchema = {
      '@context': 'https://schema.org',
      '@type': 'ImageObject',
      url: `${siteUrl}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
      name: 'Snorkelology interactive snorkelling map of Britain',
      representativeOfPage: true,
      contentUrl: `${siteUrl}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`
    };
    const html = '<html><head><title>Old</title></head><body></body></html>';
    const result = injectSeoPayloadIntoHtml(html, { ...payload, schemas: [imageSchema] }, siteUrl);
    expect(result).toContain('"@type":"ImageObject"');
    expect(result).toContain('"representativeOfPage":true');
    expect(result).toContain('"contentUrl"');
  });

  it('injects VideoObject schema with embedUrl and thumbnailUrl', () => {
    const videoSchema = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: 'Snorkelling Britain book flick-through video',
      description: 'A flick-through of Snorkelling Britain.',
      thumbnailUrl: 'https://img.youtube.com/vi/nglkG5wdsmY/maxresdefault.jpg',
      uploadDate: '2025-06-01',
      embedUrl: 'https://www.youtube.com/embed/nglkG5wdsmY',
      contentUrl: 'https://www.youtube.com/watch?v=nglkG5wdsmY'
    };
    const html = '<html><head><title>Old</title></head><body></body></html>';
    const result = injectSeoPayloadIntoHtml(html, { ...payload, schemas: [videoSchema] }, siteUrl);
    expect(result).toContain('"@type":"VideoObject"');
    expect(result).toContain('"embedUrl":"https://www.youtube.com/embed/nglkG5wdsmY"');
    expect(result).toContain('"thumbnailUrl"');
    expect(result).toContain('"uploadDate":"2025-06-01"');
  });

  it('injects CollectionPage schema for blog index', () => {
    const blogListSchema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'British Snorkelling Articles',
      url: `${siteUrl}/blog`,
      publisher: {
        '@type': 'Organization',
        name: 'Snorkelology',
        logo: { '@type': 'ImageObject', url: `${siteUrl}/assets/banner/snround.webp` }
      }
    };
    const html = '<html><head><title>Old</title></head><body></body></html>';
    const result = injectSeoPayloadIntoHtml(html, { ...payload, schemas: [blogListSchema] }, siteUrl);
    expect(result).toContain('"@type":"CollectionPage"');
    expect(result).toContain('"@type":"Organization"');
    expect(result).toContain(`"url":"${siteUrl}/blog"`);
  });

  it('map page payload uses map-specific ogImage, not default social image', () => {
    const mapImage = `${siteUrl}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`;
    const html = '<html><head><title>Old</title><meta property="og:image" content></head><body></body></html>';
    const result = injectSeoPayloadIntoHtml(html, { ...payload, ogImage: mapImage, twitterImage: mapImage }, siteUrl);
    expect(result).toContain(`<meta property="og:image" content="${mapImage}">`);
    expect(result).toContain(`<meta name="twitter:image" content="${mapImage}">`);
  });
});
