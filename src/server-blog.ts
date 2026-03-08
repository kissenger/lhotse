
import express from 'express';
import BlogModel from '../schema/blog';
import { BlogError } from 'src/server';
import { verifyToken } from './server-auth'
import 'dotenv/config';

const blog = express();

/* 
  Get all data for all posts
  Returns: Array<BlogPost>
*/
blog.get('/api/blog/get-all-posts/', async (req, res) => {
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

blog.get('/api/blog/get-all-slugs/', async (req, res) => {
  console.log('test')
  try {
    const result =  await getSlugs(false);
    if (!result || result.length === 0) {
      throw new BlogError('Error fetching slugs');
    };
    console.log(result);  
    res.status(201).json(result); 
  } catch (error: any) { 
    res.status(500).send(error);
  }
});

/* 
  Get all data for all posts
  Returns: Array<BlogPost>
*/
blog.get('/api/blog/get-published-posts/', async (req, res) => {
  try {
    const result = await BlogModel.find({isPublished: true}).sort({"createdAt": "descending"});
    res.status(201).json(result);
  } catch (error: any) { 
    console.error(error);
    res.status(500).send(error);
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
    res.status(500).send(error);
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

    res.status(200).json({lastSlug, nextSlug });
    
  } catch (error: any) {
    if (error?.name === 'BlogError') {
      res.status(404).json({ message: 'Not Found' });
      return;
    }
    res.status(500).send(error);
  }
});

blog.post('/api/blog/upsert-post/', verifyToken, async (req, res) => {
  try {
    if (req.body._id !=='') {
      await BlogModel.findByIdAndUpdate(req.body._id, req.body);
    } else {
      delete req.body._id;
      delete req.body.createdAt;
      req.body.isDeleted = false;
      req.body.deletedAt = null;
      await BlogModel.create(req.body);
    }
    const result = await BlogModel.find({});
    res.status(201).json(result);
  } catch (error: any) {
    console.error(error);
    res.status(500).send(error);
  }
});

async function getSlugs(includeUnpublished: boolean = false) {
  const result =  await BlogModel.find(
    includeUnpublished ? {} : { isPublished: true }, 
    {slug: 1, updatedAt: 1}).sort({"createdAt": "descending"}
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
blog.get('/api/blog/delete-post/:_id', verifyToken, async (req, res) => {
  try {
    await BlogModel.findOneAndUpdate(
      { _id: req.params._id },
      { isDeleted: true, deletedAt: new Date(), isPublished: false }
    );
    const result = await BlogModel.find({});
    res.status(201).json(result);
  } catch (error: any) {
    console.log(error.message);
    res.status(500).send(error);
  }
});

async function getPublishedPostsForSeo() {
  const posts = await BlogModel.find(
    { isPublished: true },
    { title: 1, subtitle: 1, intro: 1, imgFname: 1, createdAt: 1, updatedAt: 1 }
  ).sort({ "createdAt": "descending" });
  return posts;
}

async function getPublishedPostBySlugForSeo(slug: string) {
  const post = await BlogModel.findOne(
    { isPublished: true, slug },
    { title: 1, subtitle: 1, intro: 1, imgFname: 1, createdAt: 1, updatedAt: 1, keywords: 1, sections: 1, type: 1, slug: 1, author: 1 }
  );
  return post;
}

export { blog, getSlugs, getPublishedPostsForSeo, getPublishedPostBySlugForSeo };
