import mongoose, {model} from 'mongoose';

const blogSchema = new mongoose.Schema({
  slug: {type: String, required: true},
  type: {type: String, default: 'faq'},
  title: {type: String, required: true},
  keywords: {type: [String], required: true},
  subtitle: {type: String, required: true},
  intro: {type: String, required: true},
  imgFname: {type: String, required: true},
  imgAlt: {type: String, required: true},
  sections: {type: [{
    title: {type: String},
    content: {type: String},
    imgFname: {type: String},
    imgAlt: {type: String},
    videoUrl: {type: String},
    imgCredit: {type: String},
    sectionType: {type: String},
    ctaLinks: {type: [{
      label: {type: String},
      url: {type: String}
    }], default: undefined}
  }]},
  conclusion: {type: String, required: true},
  author: {type: String},
  likes: {type: Number, default: 0},
  isDeleted: {type: Boolean, default: false, index: true},
  deletedAt: {type: Date, default: null},
  publishedAt: {type: Date, default: null}
}, {timestamps: true})

// Exclude soft-deleted posts from standard queries by default.
blogSchema.pre(/^find/, function (this: any, next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

const BlogModel = model('post', blogSchema);

export default BlogModel; 
