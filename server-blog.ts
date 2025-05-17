
import express from 'express';
import BlogModel from './schema/blog';
import { BlogError } from 'server';
import { verifyToken } from './server-auth'
import 'dotenv/config';

const blog = express();

/* 
  Get all data for all posts
  Returns: Array<BlogPost>
*/
blog.get('/api/blog/get-all-posts/', async (req, res) => {
  try {
    const result = await BlogModel.find({}).sort({"createdAt": "descending"});;
    res.status(201).json(result);
  } catch (error: any) { 
    console.error(error);
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
    const listOfSlugs: Array<{slug: string}> = await BlogModel.find({isPublished: true}, {slug: 1}).sort({"createdAt": "descending"});
    const index = listOfSlugs.map(r => r.slug).indexOf(req.params.slug); 
    const lastSlug = listOfSlugs[index-1 < 0 ? listOfSlugs.length-1 : index-1].slug;
    const nextSlug = listOfSlugs[index+1 > listOfSlugs.length-1 ? 0: index+1].slug;
    const article = await BlogModel.findOne({slug: req.params.slug});
    if (article){
      res.status(201).json({article, lastSlug, nextSlug});
    } else {
      // res.status(404).send(new Error('Not Found'));
      throw new BlogError('Not Found')
    }
  } catch (error: any) {
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
      await BlogModel.create(req.body);
    }
    const result = await BlogModel.find({});
    res.status(201).json(result);
  } catch (error: any) {
    console.error(error);
    res.status(500).send(error);
  }
});

/* 
  Get post specified by _id, and if successful return result of find all
  Returns: Array<BlogPost>
*/
blog.get('/api/blog/delete-post/:_id', verifyToken, async (req, res) => {
  try {
    await BlogModel.deleteOne({_id: req.params._id});
    const result = await BlogModel.find({});
    res.status(201).json(result);
  } catch (error: any) {
    console.log(error.message);
    res.status(500).send(error);
  }
});

async function getSlugs() {
  const slugs = await BlogModel.find({isPublished: true}, {slug: 1, updatedAt: 1}).sort({"createdAt": "descending"});
  return slugs;
}

export { blog, getSlugs};
