import mongoose, { model } from 'mongoose';

const blogLikeSchema = new mongoose.Schema({
  hash: { type: String, required: true, unique: true },
  slug: { type: String, required: true, index: true },
}, { timestamps: true });

const BlogLikeModel = model('bloglike', blogLikeSchema);

export default BlogLikeModel;
