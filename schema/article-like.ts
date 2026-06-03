import mongoose, { model } from 'mongoose';

const articleLikeSchema = new mongoose.Schema({
  hash: { type: String, required: true, unique: true },
  slug: { type: String, required: true, index: true },
}, { timestamps: true });

const ArticleLikeModel = model('articlelike', articleLikeSchema);

export default ArticleLikeModel;
