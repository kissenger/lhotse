#!/usr/bin/env node
/**
 * Regenerate OG images for all published blog posts that don't have one.
 * 
 * This script should be run periodically (e.g., via cron or scheduled task) to ensure
 * all published blog articles have their OG images generated.
 * 
 * Usage:
 *   node tools/regenerate-og-images.mjs
 * 
 * Environment variables:
 *   - MONGODB_URI: Connection string to MongoDB (required)
 *   - OG_ARTICLES_DIR: Path to articles directory (optional, will auto-detect)
 *   - OG_LOGO_PATH: Path to logo file (optional, will auto-detect)
 *   - OG_LOGO_WIDTH_RATIO: Logo width as ratio of OG width (default: 0.16)
 *   - OG_LOGO_MARGIN_X: Logo margin from right edge (default: 60)
 *   - OG_LOGO_MARGIN_Y: Logo margin from bottom edge (default: 30)
 */

import mongoose from 'mongoose';
import { access, mkdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';
import 'dotenv/config';

// MongoDB schema definition (must match server)
const blogSchema = new mongoose.Schema({
  slug: { type: String, required: true },
  type: { type: String, default: 'faq' },
  title: { type: String, required: true },
  keywords: { type: [String], required: true },
  subtitle: { type: String, required: true },
  intro: { type: String, required: true },
  imgFname: { type: String, required: true },
  imgAlt: { type: String, required: true },
  sections: {
    type: [
      {
        title: String,
        content: String,
        imgFname: String,
        imgAlt: String,
        videoUrl: String,
        imgCredit: String,
        sectionType: String,
        ctaLinks: [{ label: String, url: String }],
      },
    ],
  },
  conclusion: { type: String, required: true },
  author: String,
  likes: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  publishedAt: Date,
}, { timestamps: true });

blogSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

const BlogModel = mongoose.model('post', blogSchema);

// Configuration
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const LOGO_WIDTH_RATIO = Number(process.env.OG_LOGO_WIDTH_RATIO || 0.16);
const LOGO_MARGIN_X = Number(process.env.OG_LOGO_MARGIN_X || 60);
const LOGO_MARGIN_Y = Number(process.env.OG_LOGO_MARGIN_Y || 30);
const LOGO_LEFT_OVERRIDE = process.env.OG_LOGO_LEFT;
const LOGO_TOP_OVERRIDE = process.env.OG_LOGO_TOP;
const LOGO_TARGET_WIDTH = Math.round(OG_WIDTH * LOGO_WIDTH_RATIO);

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
    process.env.OG_ARTICLES_DIR || '',
    resolve(process.cwd(), 'dist/prod/browser/assets/photos/articles'),
    resolve(process.cwd(), 'dist/dev/browser/assets/photos/articles'),
    resolve(process.cwd(), 'dist/beta/browser/assets/photos/articles'),
    resolve(process.cwd(), 'src/assets/photos/articles'),
  ].filter(Boolean);

  for (const articlesDir of candidates) {
    if (await pathExists(articlesDir)) {
      return articlesDir;
    }
  }

  return null;
}

async function resolveLogoPath() {
  const candidates = [
    process.env.OG_LOGO_PATH || '',
    resolve(process.cwd(), 'dist/prod/browser/assets/banner/snround-hq.webp'),
    resolve(process.cwd(), 'dist/dev/browser/assets/banner/snround-hq.webp'),
    resolve(process.cwd(), 'dist/beta/browser/assets/banner/snround-hq.webp'),
    resolve(process.cwd(), 'src/assets/banner/snround-hq.webp'),
  ].filter(Boolean);

  for (const logoPath of candidates) {
    if (await pathExists(logoPath)) {
      return logoPath;
    }
  }

  return null;
}

async function ogImageExists(slug, articlesDir) {
  const candidates = [
    resolve(process.cwd(), 'dist/prod/browser/assets/photos/articles/og', `${slug}-og.webp`),
    resolve(articlesDir, 'og', `${slug}-og.webp`),
  ];

  for (const filePath of candidates) {
    if (await pathExists(filePath)) {
      return true;
    }
  }

  return false;
}

async function generateBlogOgImage(slug, imgFname, articlesDir, logoPath) {
  if (!slug || !imgFname) {
    return false;
  }

  if (!articlesDir || !logoPath) {
    console.warn(`[${slug}] Skipped: articles dir or logo not found`);
    return false;
  }

  const sourceFileName = basename(imgFname);
  const sourcePath = join(articlesDir, sourceFileName);
  if (!(await pathExists(sourcePath))) {
    console.warn(`[${slug}] Skipped: source image not found at ${sourcePath}`);
    return false;
  }

  const ogDir = join(articlesDir, 'og');
  const ogOutputPath = join(ogDir, `${slug}-og.webp`);
  await mkdir(ogDir, { recursive: true });

  const resizedLogoBuffer = await sharp(logoPath)
    .resize({ width: LOGO_TARGET_WIDTH, withoutEnlargement: true })
    .png({ quality: 100 })
    .toBuffer();

  const logoMeta = await sharp(resizedLogoBuffer).metadata();
  const logoWidth = logoMeta.width || LOGO_TARGET_WIDTH;
  const logoHeight = logoMeta.height || LOGO_TARGET_WIDTH;
  let logoLeft = Math.max(0, OG_WIDTH - logoWidth - LOGO_MARGIN_X);
  let logoTop = Math.max(0, OG_HEIGHT - logoHeight - LOGO_MARGIN_Y);

  // Optional absolute overrides for exact pixel placement.
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
        top: logoTop,
      },
    ])
    .webp({ quality: 88 })
    .toFile(ogOutputPath);

  return true;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI environment variable not set');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB\n');

    const articlesDir = await resolveArticlesDir();
    const logoPath = await resolveLogoPath();

    if (!articlesDir) {
      console.error('Error: Could not resolve articles directory');
      process.exit(1);
    }

    if (!logoPath) {
      console.error('Error: Could not resolve logo path');
      process.exit(1);
    }

    console.log(`Using articles directory: ${articlesDir}`);
    console.log(`Using logo path: ${logoPath}\n`);

    // Fetch all published posts
    console.log('Fetching published posts from database...');
    const posts = await BlogModel.find(
      { publishedAt: { $ne: null } },
      { slug: 1, title: 1, imgFname: 1 }
    ).sort({ createdAt: -1 }).lean();

    console.log(`Found ${posts.length} published posts\n`);

    if (posts.length === 0) {
      console.log('No published posts to process');
      await mongoose.disconnect();
      return;
    }

    let generated = 0;
    let skipped = 0;
    let alreadyExists = 0;

    for (const post of posts) {
      const hasOgImage = await ogImageExists(post.slug, articlesDir);

      if (hasOgImage) {
        console.log(`[${post.slug}] OG image already exists`);
        alreadyExists++;
      } else {
        try {
          const success = await generateBlogOgImage(post.slug, post.imgFname, articlesDir, logoPath);
          if (success) {
            console.log(`[${post.slug}] ✓ Generated OG image`);
            generated++;
          } else {
            skipped++;
          }
        } catch (error) {
          console.error(`[${post.slug}] Error generating OG image:`, error.message);
          skipped++;
        }
      }
    }

    console.log(`\n========== Summary ==========`);
    console.log(`Total posts:        ${posts.length}`);
    console.log(`Generated:          ${generated}`);
    console.log(`Already existed:    ${alreadyExists}`);
    console.log(`Skipped/Failed:     ${skipped}`);
    console.log(`=============================\n`);

    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
