
// Script to backfill OG images for blog posts based on existing post data and source images.
// Expects source images to be present in the local filesystem under src/assets/photos/articles (same as used for blog post images).
// Run from repo root with: node tools/backfill-blog-og-images.mjs
// Configurable via environment variables (see constants in code). LOGO_* vars can be used to adjust logo size and position for better results.

import { access, mkdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';

const API_BASE_URL = process.env.OG_BACKFILL_API_BASE_URL || '';
const API_BASE_URL_CANDIDATES = ['http://127.0.0.1:4001', 'http://127.0.0.1:4000'];
const ARTICLES_DIR_OVERRIDE = process.env.OG_ARTICLES_DIR || '';
const LOGO_PATH_OVERRIDE = process.env.OG_LOGO_PATH || '';
const OUTPUT_SUBFOLDER = 'og';
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const LOGO_WIDTH_RATIO = Number(process.env.OG_LOGO_WIDTH_RATIO || 0.16);
const LOGO_MARGIN_X = Number(process.env.OG_LOGO_MARGIN_X || 60);
const LOGO_MARGIN_Y = Number(process.env.OG_LOGO_MARGIN_Y || 30);
const LOGO_LEFT_OVERRIDE = process.env.OG_LOGO_LEFT;
const LOGO_TOP_OVERRIDE = process.env.OG_LOGO_TOP;
const logoTargetWidth = Math.round(OG_WIDTH * LOGO_WIDTH_RATIO);

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveArticlesDir() {
  const candidates = [
    ARTICLES_DIR_OVERRIDE,
    resolve(process.cwd(), 'dist/prod/browser/assets/photos/articles'),
    resolve(process.cwd(), 'dist/dev/browser/assets/photos/articles'),
    resolve(process.cwd(), 'dist/beta/browser/assets/photos/articles'),
    resolve(process.cwd(), 'src/assets/photos/articles')
  ].filter(Boolean);

  for (const dir of candidates) {
    if (await pathExists(dir)) {
      return dir;
    }
  }

  return null;
}

async function resolveLogoPath() {
  const candidates = [
    LOGO_PATH_OVERRIDE,
    resolve(process.cwd(), 'dist/prod/browser/assets/banner/snround-hq.webp'),
    resolve(process.cwd(), 'dist/dev/browser/assets/banner/snround-hq.webp'),
    resolve(process.cwd(), 'dist/beta/browser/assets/banner/snround-hq.webp'),
    resolve(process.cwd(), 'src/assets/banner/snround-hq.webp')
  ].filter(Boolean);

  for (const filePath of candidates) {
    if (await pathExists(filePath)) {
      return filePath;
    }
  }

  return null;
}

async function fetchPostsFromBase(baseUrl) {
  const response = await fetch(`${baseUrl}/api/blog/get-all-posts/`, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Unexpected post payload format from API.');
  }

  return payload;
}

async function fetchPosts() {
  const basesToTry = API_BASE_URL ? [API_BASE_URL] : API_BASE_URL_CANDIDATES;
  let lastError = null;

  for (const baseUrl of basesToTry) {
    try {
      const posts = await fetchPostsFromBase(baseUrl);
      return { posts, baseUrl };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to fetch posts from any configured API base URL.');
}

async function generateBlogOgImage(slug, imgFname, articlesDir, logoPath) {
  if (!slug || !imgFname) {
    return { status: 'skipped', reason: 'missing slug or imgFname' };
  }

  const sourcePath = join(articlesDir, basename(imgFname));
  if (!(await pathExists(sourcePath))) {
    return { status: 'skipped', reason: `source image missing: ${sourcePath}` };
  }

  const ogDir = join(articlesDir, OUTPUT_SUBFOLDER);
  const outputPath = join(ogDir, `${slug}-og.webp`);
  await mkdir(ogDir, { recursive: true });


  const resizedLogoBuffer = await sharp(logoPath)
    .resize({ width: logoTargetWidth, withoutEnlargement: true })
    .png({ quality: 100 })
    .toBuffer();

  const logoMeta = await sharp(resizedLogoBuffer).metadata();
  const logoWidth = logoMeta.width || logoTargetWidth;
  const logoHeight = logoMeta.height || logoTargetWidth;

  let logoLeft = Math.max(0, OG_WIDTH - logoWidth - LOGO_MARGIN_X);
  let logoTop = Math.max(0, OG_HEIGHT - logoHeight - LOGO_MARGIN_Y);

  if (LOGO_LEFT_OVERRIDE !== undefined && LOGO_TOP_OVERRIDE !== undefined) {
    const parsedLeft = Number(LOGO_LEFT_OVERRIDE);
    const parsedTop = Number(LOGO_TOP_OVERRIDE);
    if (!Number.isNaN(parsedLeft) && !Number.isNaN(parsedTop)) {
      logoLeft = Math.max(0, Math.min(parsedLeft, OG_WIDTH - logoWidth));
      logoTop = Math.max(0, Math.min(parsedTop, OG_HEIGHT - logoHeight));
    }
  }

  await sharp(sourcePath)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'center' })
    .composite([
      {
        input: resizedLogoBuffer,
        left: logoLeft,
        top: logoTop
      }
    ])
    .webp({ quality: 88 })
    .toFile(outputPath);

  return { status: 'generated', outputPath };
}

async function main() {
  const [{ posts, baseUrl }, articlesDir, logoPath] = await Promise.all([
    fetchPosts(),
    resolveArticlesDir(),
    resolveLogoPath()
  ]);
  console.log(`[og-backfill] Fetching posts from ${baseUrl}`);

  if (!articlesDir) {
    throw new Error('Could not resolve articles directory. Set OG_ARTICLES_DIR or ensure assets/photos/articles exists.');
  }
  if (!logoPath) {
    throw new Error('Could not find overlay logo file. Set OG_LOGO_PATH or provide assets/banner/snround-hq.webp.');
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of posts) {
    const slug = post?.slug;
    const imgFname = post?.imgFname;

    try {
      const result = await generateBlogOgImage(slug, imgFname, articlesDir, logoPath);
      console.log(`[og-backfill] ${result.status.toUpperCase()} for slug=${slug || '(missing)'}: ${result.reason || result.outputPath}`);
      if (result.status === 'generated') {
        generated += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(`[og-backfill] FAILED for slug=${slug || '(missing)'}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`[og-backfill] Complete. generated=${generated} skipped=${skipped} failed=${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[og-backfill] FAILED');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
