
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createHash } from 'node:crypto';
import BlogModel from '../schema/blog';
import BlogLikeModel from '../schema/blog-like';
import { BlogError } from 'src/server';
import { verifyToken } from './server-auth'
import 'dotenv/config';

const blog = express();

// Blog API endpoints are machine-readable responses and should never appear in search results.
blog.use('/api/blog', (_req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});

function isLocalRequest(req: express.Request): boolean {
  const host = (req.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function previewAuthGuard(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (isLocalRequest(req)) {
    next();
    return;
  }
  verifyToken(req as any, res as any, next as any);
}

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
      .sort({"createdAt": "descending"})
      .lean();
    res.status(201).json(result);
  } catch (error: any) { 
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

  blog.get('/api/blog/get-sitemap-entries/', async (_req, res) => {
    try {
      const result = await BlogModel.find(
        { publishedAt: { $ne: null } },
        { slug: 1, updatedAt: 1, imgFname: 1 }
      ).sort({ "createdAt": "descending" }).lean();

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

/* 
  Get all data for all posts
  Returns: Array<BlogPost>
*/
blog.get('/api/blog/get-published-posts/', async (_req, res) => {
  try {
    const result = await BlogModel.find({ publishedAt: { $ne: null } }).sort({"publishedAt": "descending"}).lean();
    res.status(201).json(result);
  } catch (error: any) { 
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* 
  Get post from provided slug
  Returns: BlogPost
*/
blog.get('/api/blog/get-post-by-slug/:slug', async (req, res) => {

  try {
    const slug = req.params['slug'];
    const article = await BlogModel.findOne({ slug, publishedAt: { $ne: null } }).lean();
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

/*
  Get post from provided slug (preview version)
  - Includes unpublished posts
  - Requires auth unless request is local (localhost)
*/
blog.get('/api/blog/get-post-preview-by-slug/:slug', previewAuthGuard, async (req, res) => {
  try {
    const slug = req.params['slug'];
    const article = await BlogModel.findOne({ slug }).lean();
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
    const index = listOfSlugs.map(r => r.slug).indexOf(req.params['slug']);

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
      const preserveUpdatedAt = req.body.preserveUpdatedAt === true;
      delete req.body.preserveUpdatedAt;

      const existing = await BlogModel.findById(req.body._id, { publishedAt: 1, updatedAt: 1, blogSection: 1 }).lean();
      if (!existing) {
        throw new BlogError('Not Found');
      }

      // Never let the client overwrite publishedAt — manage it server-side only
      const clientPublishedAt = req.body.publishedAt;
      delete req.body.publishedAt;
      delete req.body.isPublished;
      const update: any = { ...req.body };
      let publishStateChanged = false;

      if (clientPublishedAt === undefined) {
        // no publish change — leave publishedAt untouched
      } else if (clientPublishedAt === '') {
        // Explicit unpublish — clear publishedAt
        update.publishedAt = null;
        publishStateChanged = !!existing.publishedAt;
      } else if (clientPublishedAt === 'publish') {
        // Set publishedAt only when first publishing (not already set)
        if (existing && !existing.publishedAt) {
          update.publishedAt = new Date();
          publishStateChanged = true;
        }
      }

      const existingSection = (existing.blogSection || '').toString().trim();
      const incomingSection = (req.body.blogSection || '').toString().trim();
      const sectionChanged = existingSection !== incomingSection;
      const shouldPreserveUpdatedAt = (preserveUpdatedAt || sectionChanged) && !publishStateChanged;

      if (shouldPreserveUpdatedAt && existing.updatedAt) {
        update.updatedAt = existing.updatedAt;
      }

      await BlogModel.findByIdAndUpdate(
        req.body._id,
        update,
        shouldPreserveUpdatedAt ? { timestamps: false } : undefined
      );
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

    const result = await BlogModel.find({});
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).send(error);
  }
});

async function getSlugs(onlyPublishedPosts: boolean = true) {
  const result =  await BlogModel.find(
    onlyPublishedPosts ? { publishedAt: { $ne: null } } : {}, 
    {slug: 1, title: 1, updatedAt: 1}).sort({"createdAt": "descending"}
  ).lean();
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
  ).sort({ "createdAt": "descending" }).lean();
  return posts;
}

async function getPublishedPostBySlugForSeo(slug: string) {
  const post = await BlogModel.findOne(
    { publishedAt: { $ne: null }, slug },
    { title: 1, subtitle: 1, intro: 1, imgFname: 1, createdAt: 1, updatedAt: 1, publishedAt: 1, keywords: 1, sections: 1, type: 1, slug: 1, author: 1, review: 1 }
  ).lean();
  return post;
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
    ).lean();
    const likesMap: Record<string, number> = {};
    for (const p of posts) {
      likesMap[p.slug] = p.likes ?? 0;
    }
    res.json(likesMap);
  } catch (err) {
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
        const post = await BlogModel.findOne({ slug, publishedAt: { $ne: null } }, { likes: 1 }).lean();
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
    res.status(500).json({ error: 'Failed to like post' });
  }
});

export { blog, getSlugs, getPublishedPostsForSeo, getPublishedPostBySlugForSeo };
