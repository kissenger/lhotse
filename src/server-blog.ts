
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { access, mkdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import BlogModel from '../schema/blog';
import BlogLikeModel from '../schema/blog-like';
import { BlogError } from 'src/server';
import { verifyToken } from './server-auth'
import sharp from 'sharp';
import 'dotenv/config';

const blog = express();

const likeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

/* 
  Get all data for all posts
  Returns: Array<BlogPost>
*/
blog.get('/api/blog/get-all-posts/', verifyToken, async (_req, res) => {
  try {
    const result = await BlogModel
      .find({})
      .sort({"createdAt": "descending"});
    res.status(201).json(result);
  } catch (error: any) { 
    console.error(error);
    res.status(500).send(error);
  }
});

blog.get('/api/blog/get-all-slugs/', async (_req, res) => {
  try {
    const result =  await getSlugs(false);
    if (!result || result.length === 0) {
      throw new BlogError('Error fetching slugs');
    };
    res.status(201).json(result); 
  } catch (error: any) { 
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

  blog.get('/api/blog/get-sitemap-entries/', async (_req, res) => {
    try {
      const result = await BlogModel.find(
        { publishedAt: { $ne: null } },
        { slug: 1, updatedAt: 1, imgFname: 1 }
      ).sort({ "createdAt": "descending" });

      res.status(200).json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

/* 
  Get all data for all posts
  Returns: Array<BlogPost>
*/
blog.get('/api/blog/get-published-posts/', async (_req, res) => {
  try {
    const result = await BlogModel.find({ publishedAt: { $ne: null } }).sort({"publishedAt": "descending"});
    res.status(201).json(result);
  } catch (error: any) { 
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* 
  Get post from provided slug
  Returns: BlogPost
*/
blog.get('/api/blog/get-post-by-slug/:slug', async (req, res) => {

  try {
    const slug = req.params.slug;
    const article = await BlogModel.findOne({ slug });
    if (!article) {
      throw new BlogError('Not Found');
    }

    res.status(200).json({ article });

  } catch (error: any) {
    if (error?.name === 'BlogError') {
      res.status(404).json({ message: 'Not Found' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

blog.get('/api/blog/get-last-and-next-slugs/:slug', async (req, res) => {

  try {

    const listOfSlugs: Array<{slug: string}> = await getSlugs(true);
    const index = listOfSlugs.map(r => r.slug).indexOf(req.params.slug);

    if (index < 0 || listOfSlugs.length === 0) {
      throw new BlogError('Error finding next or last slug');
    }

    const lastSlug = listOfSlugs[(index - 1 + listOfSlugs.length) % listOfSlugs.length].slug;
    const nextSlug = listOfSlugs[(index + 1) % listOfSlugs.length].slug;
    const lastTitle = (listOfSlugs[(index - 1 + listOfSlugs.length) % listOfSlugs.length] as any).title ?? '';
    const nextTitle = (listOfSlugs[(index + 1) % listOfSlugs.length] as any).title ?? '';

    res.status(200).json({lastSlug, nextSlug, lastTitle, nextTitle });
    
  } catch (error: any) {
    if (error?.name === 'BlogError') {
      res.status(404).json({ message: 'Not Found' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

blog.post('/api/blog/upsert-post/', verifyToken, async (req, res) => {
  try {
    if (req.body._id !=='') {
      // Never let the client overwrite publishedAt — manage it server-side only
      const clientPublishedAt = req.body.publishedAt;
      delete req.body.publishedAt;
      delete req.body.isPublished;
      const update: any = { ...req.body };
      if (clientPublishedAt === undefined) {
        // no publish change — leave publishedAt untouched
      } else if (clientPublishedAt === '') {
        // Explicit unpublish — clear publishedAt
        update.publishedAt = null;
      } else if (clientPublishedAt === 'publish') {
        // Set publishedAt only when first publishing (not already set)
        const existing = await BlogModel.findById(req.body._id, { publishedAt: 1 });
        if (existing && !existing.publishedAt) {
          update.publishedAt = new Date();
        }
      }
      await BlogModel.findByIdAndUpdate(req.body._id, update);
    } else {
      delete req.body._id;
      delete req.body.createdAt;
      req.body.isDeleted = false;
      req.body.deletedAt = null;
      delete req.body.isPublished;
      if (req.body.publishedAt === 'publish') {
        req.body.publishedAt = new Date();
      } else {
        delete req.body.publishedAt;
      }
      await BlogModel.create(req.body);
    }

    // Generate a branded OG image for social previews when a main image exists.
    await generateBlogOgImage(req.body.slug, req.body.imgFname);

    const result = await BlogModel.find({});
    res.status(201).json(result);
  } catch (error: any) {
    console.error(error);
    res.status(500).send(error);
  }
});

async function getSlugs(onlyPublishedPosts: boolean = true) {
  const result =  await BlogModel.find(
    onlyPublishedPosts ? { publishedAt: { $ne: null } } : {}, 
    {slug: 1, title: 1, updatedAt: 1}).sort({"createdAt": "descending"}
  );
  if (!result || result.length === 0) {
    throw new BlogError('Not Found');
  };
  return result;
};

/* 
  Get post specified by _id, and if successful return result of find all
  Returns: Array<BlogPost>
*/
blog.post('/api/blog/backfill-published-at/', verifyToken, async (_req, res) => {
  try {
    // Set publishedAt = createdAt for all published posts that don't yet have publishedAt
    const result = await BlogModel.updateMany(
      { publishedAt: null },
      [{ $set: { publishedAt: '$createdAt' } }]
    );
    res.status(200).json({ updated: result.modifiedCount });
  } catch (error: any) {
    console.error(error);
    res.status(500).send(error);
  }
});

blog.get('/api/blog/delete-post/:_id', verifyToken, async (req, res) => {
  try {
    await BlogModel.findOneAndUpdate(
      { _id: req.params._id },
      { isDeleted: true, deletedAt: new Date(), publishedAt: null }
    );
    const result = await BlogModel.find({});
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).send(error);
  }
});

async function getPublishedPostsForSeo() {
  const posts = await BlogModel.find(
    { publishedAt: { $ne: null } },
    { title: 1, subtitle: 1, intro: 1, imgFname: 1, createdAt: 1, updatedAt: 1, publishedAt: 1 }
  ).sort({ "createdAt": "descending" });
  return posts;
}

async function getPublishedPostBySlugForSeo(slug: string) {
  const post = await BlogModel.findOne(
    { publishedAt: { $ne: null }, slug },
    { title: 1, subtitle: 1, intro: 1, imgFname: 1, createdAt: 1, updatedAt: 1, publishedAt: 1, keywords: 1, sections: 1, type: 1, slug: 1, author: 1 }
  );
  return post;
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveArticlesDir() {
  const candidates = [
    process.env['OG_ARTICLES_DIR'] || '',
    resolve(process.cwd(), 'dist/prod/browser/assets/photos/articles'),
    resolve(process.cwd(), 'dist/dev/browser/assets/photos/articles'),
    resolve(process.cwd(), 'dist/beta/browser/assets/photos/articles'),
    resolve(process.cwd(), 'src/assets/photos/articles')
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
    process.env['OG_LOGO_PATH'] || '',
    resolve(process.cwd(), 'dist/prod/browser/assets/banner/snround-hq.webp'),
    resolve(process.cwd(), 'dist/dev/browser/assets/banner/snround-hq.webp'),
    resolve(process.cwd(), 'dist/beta/browser/assets/banner/snround-hq.webp'),
    resolve(process.cwd(), 'src/assets/banner/snround-hq.webp')
  ].filter(Boolean);

  for (const logoPath of candidates) {
    if (await pathExists(logoPath)) {
      return logoPath;
    }
  }

  return null;
}

async function generateBlogOgImage(slug?: string, imgFname?: string) {
  
  const OG_WIDTH = 1200;
  const OG_HEIGHT = 630;
  const LOGO_WIDTH_RATIO = Number(process.env['OG_LOGO_WIDTH_RATIO'] || 0.16);
  const LOGO_MARGIN_X = Number(process.env['OG_LOGO_MARGIN_X'] || 60);
  const LOGO_MARGIN_Y = Number(process.env['OG_LOGO_MARGIN_Y'] || 30);
  const LOGO_LEFT_OVERRIDE = process.env['OG_LOGO_LEFT'];
  const LOGO_TOP_OVERRIDE = process.env['OG_LOGO_TOP'];
  const LOGO_TARGET_WIDTH = Math.round(OG_WIDTH * LOGO_WIDTH_RATIO);

  if (!slug || !imgFname) {
    return;
  }

  const articlesDir = await resolveArticlesDir();
  const logoPath = await resolveLogoPath();
  if (!articlesDir || !logoPath) {
    return;
  }

  const sourceFileName = basename(imgFname);
  const sourcePath = join(articlesDir, sourceFileName);
  if (!(await pathExists(sourcePath))) {
    return;
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
        top: logoTop
      }
    ])
    .webp({ quality: 88 })
    .toFile(ogOutputPath);
}

/*****************************************************************
 * ROUTE: Get like counts for multiple slugs
 ****************************************************************/
blog.post('/api/blog/get-likes', async (req, res) => {
  try {
    const slugs: string[] = req.body.slugs;
    if (!Array.isArray(slugs) || slugs.length > 50) {
      res.status(400).json({ error: 'slugs must be an array of up to 50 items' });
      return;
    }
    const posts = await BlogModel.find(
      { slug: { $in: slugs }, publishedAt: { $ne: null } },
      { slug: 1, likes: 1 }
    );
    const likesMap: Record<string, number> = {};
    for (const p of posts) {
      likesMap[p.slug] = p.likes ?? 0;
    }
    res.json(likesMap);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

/*****************************************************************
 * ROUTE: Like a blog post
 ****************************************************************/
blog.post('/api/blog/like/:slug', likeRateLimit, async (req, res) => {
  try {
    const slug = req.params['slug'];
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    const hash = createHash('sha256').update(`${ip}|${ua}|${slug}`).digest('hex');

    // Attempt to insert — unique index will reject duplicates
    try {
      await BlogLikeModel.create({ hash, slug });
    } catch (dupErr: any) {
      if (dupErr?.code === 11000) {
        const post = await BlogModel.findOne({ slug, publishedAt: { $ne: null } }, { likes: 1 });
        res.json({ likes: post?.likes ?? 0, alreadyLiked: true });
        return;
      }
      throw dupErr;
    }

    const post = await BlogModel.findOneAndUpdate(
      { slug, publishedAt: { $ne: null } },
      { $inc: { likes: 1 } },
      { new: true, projection: { likes: 1 } }
    );

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json({ likes: post.likes, alreadyLiked: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

export { blog, getSlugs, getPublishedPostsForSeo, getPublishedPostBySlugForSeo };
