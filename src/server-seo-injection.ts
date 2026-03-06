export interface SeoPayload {
  title: string;
  description: string;
  keywords?: string;
  canonicalPath: string;
  ogType: string;
  ogImage: string;
  schemas: object[];
}

export function injectSeoPayloadIntoHtml(html: string, payload: SeoPayload, siteUrl: string) {
  const ogUrl = `${siteUrl}${payload.canonicalPath.startsWith('/') ? payload.canonicalPath : `/${payload.canonicalPath}`}`;
  const sanitizedTitle = escapeHtmlAttr(payload.title);
  const sanitizedDescription = escapeHtmlAttr(payload.description);
  const sanitizedKeywords = escapeHtmlAttr(payload.keywords || '');
  const sanitizedCanonical = escapeHtmlAttr(ogUrl);
  const sanitizedImage = escapeHtmlAttr(payload.ogImage);
  const sanitizedOgType = escapeHtmlAttr(payload.ogType);

  let result = html;
  result = result.replace(/<title>.*?<\/title>/i, `<title>${sanitizedTitle}</title>`);
  result = upsertMetaTag(result, 'name', 'description', sanitizedDescription);
  result = upsertMetaTag(result, 'name', 'keywords', sanitizedKeywords);
  result = upsertCanonicalTag(result, sanitizedCanonical);
  result = upsertMetaTag(result, 'property', 'og:type', sanitizedOgType);
  result = upsertMetaTag(result, 'property', 'og:title', sanitizedTitle);
  result = upsertMetaTag(result, 'property', 'og:description', sanitizedDescription);
  result = upsertMetaTag(result, 'property', 'og:image', sanitizedImage);
  result = upsertMetaTag(result, 'property', 'og:url', sanitizedCanonical);
  result = upsertMetaTag(result, 'name', 'twitter:card', 'summary_large_image');
  result = upsertMetaTag(result, 'name', 'twitter:title', sanitizedTitle);
  result = upsertMetaTag(result, 'name', 'twitter:description', sanitizedDescription);
  result = upsertMetaTag(result, 'name', 'twitter:image', sanitizedImage);

  return injectJsonLdIntoHead(result, payload.schemas);
}

export function escapeHtmlAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function insertIntoHeadOrPrefix(html: string, tag: string) {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${tag}</head>`);
  }
  return `${tag}${html}`;
}

export function upsertMetaTag(html: string, key: 'name' | 'property', keyValue: string, content: string) {
  const escapedValue = escapeRegExp(keyValue);
  const tagRegex = new RegExp(`<meta\\b(?=[^>]*\\b${key}=["']${escapedValue}["'])[^>]*>`, 'i');
  const replacement = `<meta ${key}="${keyValue}" content="${content}">`;

  if (tagRegex.test(html)) {
    return html.replace(tagRegex, replacement);
  }

  return insertIntoHeadOrPrefix(html, replacement);
}

export function upsertCanonicalTag(html: string, href: string) {
  const tagRegex = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i;
  const replacement = `<link rel="canonical" href="${href}">`;

  if (tagRegex.test(html)) {
    return html.replace(tagRegex, replacement);
  }

  return insertIntoHeadOrPrefix(html, replacement);
}

export function injectJsonLdIntoHead(html: string, schemas: object[]) {
  if (!schemas.length) {
    return html;
  }

  const scripts = schemas
    .map(schema => `<script type="application/ld+json">${JSON.stringify(schema)}</script>`)
    .join('');

  if (html.includes('</head>')) {
    return html.replace('</head>', `${scripts}</head>`);
  }

  return `${scripts}${html}`;
}
