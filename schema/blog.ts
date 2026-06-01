import mongoose, {model} from 'mongoose';

const blogSchema = new mongoose.Schema({
  slug: {type: String, required: true},
  type: {type: String, default: 'faq'},
  blogSection: {type: String},
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
    videoOrientation: {type: String},
    imgCredit: {type: String},
    sectionType: {type: String},
    ctaLinks: {type: [{
      label: {type: String},
      url: {type: String}
    }], default: undefined}
  }]},
  review: {
    reviewKind: { type: String, enum: ['product', 'book'], default: 'product' },
    productName: { type: String },
    brand: { type: String },
    author: { type: String },
    publisher: { type: String },
    isbn: { type: String },
    imageFname: { type: String },
    imageAlt: { type: String },
    imageCredit: { type: String },
    summary: { type: String },
    ratingValue: { type: Number, min: 0, max: 5 },
    ratingScale: { type: Number, default: 5, min: 1, max: 10 },
    pros: { type: [String], default: undefined },
    cons: { type: [String], default: undefined },
    affiliateDisclosure: { type: String },
    affiliateLinks: { type: [{
      label: { type: String },
      url: { type: String }
    }], default: undefined },
    priceCurrency: { type: String },
    priceValue: { type: Number },
    availability: { type: String },
    sku: { type: String }
  },
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

// Support hot read paths used by blog page SSR/API lookups.
blogSchema.index({ slug: 1 });
blogSchema.index({ slug: 1, publishedAt: 1 });
blogSchema.index({ publishedAt: -1, createdAt: -1 });

const BlogModel = model('post', blogSchema);

export default BlogModel; 
