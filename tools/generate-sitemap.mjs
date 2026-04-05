import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SITE_URL = 'https://snorkelology.co.uk';
const API_BASE_URL = 'http://127.0.0.1:4001';
const SITEMAP_PATH = '/home/gort1975/snorkelology/dist/prod/browser/sitemap.xml';
const BUILD_MARKER_PATH = '/home/gort1975/snorkelology/dist/prod/browser/index.csr.html';
const STATIC_URL_PATHS = [
  {
    path: '/map',
    image: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`
  }
];

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeLastMod(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function asAbsoluteAssetUrl(pathOrFileName) {
  if (!pathOrFileName || typeof pathOrFileName !== 'string') {
    return null;
  }

  if (/^https?:\/\//i.test(pathOrFileName)) {
    return pathOrFileName;
  }

  const normalized = pathOrFileName.replace(/^\/+/, '');
  if (normalized.startsWith('assets/')) {
    return `${SITE_URL}/${normalized}`;
  }

  return `${SITE_URL}/assets/${normalized}`;
}

async function resolveRootLastMod() {
  try {
    const markerStats = await stat(resolve(BUILD_MARKER_PATH));
    const mtimeIso = markerStats?.mtime?.toISOString?.();
    if (!mtimeIso) {
      throw new Error(`Build marker mtime missing for ${BUILD_MARKER_PATH}`);
    }
    return normalizeLastMod(mtimeIso);
  } catch (error) {
    throw new Error(`Unable to determine build date from ${BUILD_MARKER_PATH}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function toSitemapXml(entries) {
  const eol = '\n';
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
  ];

  for (const entry of entries) {
    lines.push('  <url>');
    lines.push(`    <loc>${xmlEscape(entry.loc)}</loc>`);
    lines.push(`    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>`);
    if (Array.isArray(entry.images)) {
      for (const imageUrl of entry.images) {
        lines.push('    <image:image>');
        lines.push(`      <image:loc>${xmlEscape(imageUrl)}</image:loc>`);
        lines.push('    </image:image>');
      }
    }
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  return `${lines.join(eol)}${eol}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  return response;
}

async function fetchSitemapEntries() {
  const entriesUrl = `${API_BASE_URL}/api/blog/get-sitemap-entries/`;
  const response = await fetchJson(entriesUrl);

  if (response.ok) {
    const payload = await response.json();
    if (!Array.isArray(payload)) {
      throw new Error('Sitemap entries fetch returned a non-array payload.');
    }
    return payload;
  }

  const fallbackUrl = `${API_BASE_URL}/api/blog/get-all-slugs/`;
  const fallbackResponse = await fetchJson(fallbackUrl);

  if (!fallbackResponse.ok) {
    throw new Error(`Sitemap entries fetch failed: ${response.status} ${response.statusText}; fallback failed: ${fallbackResponse.status} ${fallbackResponse.statusText}`);
  }

  const fallbackPayload = await fallbackResponse.json();
  if (!Array.isArray(fallbackPayload)) {
    throw new Error('Sitemap fallback slug fetch returned a non-array payload.');
  }

  // Fallback endpoint does not include imgFname; keep image list empty in that case.
  return fallbackPayload.map((item) => ({
    slug: item?.slug,
    updatedAt: item?.updatedAt,
    imgFname: null
  }));
}

async function writeSitemapAtomically(xml) {
  const absolutePath = resolve(SITEMAP_PATH);
  const tmpPath = `${absolutePath}.tmp`;

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(tmpPath, xml, 'utf8');
  await rename(tmpPath, absolutePath);

  return absolutePath;
}

async function main() {
  console.log(`[sitemap] Fetching sitemap entries from ${API_BASE_URL}`);
  const sitemapEntries = await fetchSitemapEntries();
  const rootLastMod = await resolveRootLastMod();

  const entries = [
    {
      loc: SITE_URL,
      lastmod: rootLastMod
    },
    ...STATIC_URL_PATHS.map(({ path, image }) => ({
      loc: `${SITE_URL}${path}`,
      lastmod: rootLastMod,
      images: image ? [image] : []
    })),
    ...sitemapEntries
      .filter((item) => item && typeof item.slug === 'string' && item.slug.trim() !== '')
      .map((item) => ({
        loc: `${SITE_URL}/blog/${item.slug}`,
        lastmod: normalizeLastMod(item.updatedAt),
        images: (() => {
          const imageUrl = asAbsoluteAssetUrl(item.imgFname);
          return imageUrl ? [imageUrl] : [];
        })()
      }))
  ];

  const xml = toSitemapXml(entries);
  const outputPath = await writeSitemapAtomically(xml);

  console.log(`[sitemap] Wrote ${entries.length} URLs to ${outputPath}`);
}

main().catch((error) => {
  console.error('[sitemap] FAILED');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});