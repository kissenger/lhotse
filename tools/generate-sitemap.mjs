import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import 'dotenv/config';

const SITE_URL = (process.env.SITEMAP_SITE_URL || 'https://snorkelology.co.uk').replace(/\/$/, '');
const API_BASE_URL = (process.env.SITEMAP_API_BASE_URL || 'http://127.0.0.1:4001').replace(/\/$/, '');
const SITEMAP_PATH = process.env.SITEMAP_PATH || 'dist/prod/browser/sitemap.xml';
const BUILD_MARKER_PATH = process.env.SITEMAP_BUILD_MARKER_PATH || 'dist/prod/browser/index.html';
const STATIC_URL_PATHS = ['/home'];

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
  const envBuildDate = process.env.LAST_BUILD_DATE || process.env.BUILD_DATE;
  if (envBuildDate) {
    return normalizeLastMod(envBuildDate);
  }

  try {
    const markerStats = await stat(resolve(BUILD_MARKER_PATH));
    return normalizeLastMod(markerStats.mtime.toISOString());
  } catch {
    return new Date().toISOString();
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

async function fetchSitemapEntries() {
  const url = `${API_BASE_URL}/api/blog/get-sitemap-entries/`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Sitemap entries fetch failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Sitemap entries fetch returned a non-array payload.');
  }

  return payload;
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
    ...STATIC_URL_PATHS.map((path) => ({
      loc: `${SITE_URL}${path}`,
      lastmod: rootLastMod
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
