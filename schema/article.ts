import mongoose, {model} from 'mongoose';

const articleSchema = new mongoose.Schema({
  slug: {type: String, required: true},
  type: {type: String, default: 'faq'},
  articleSection: {type: String},
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
articleSchema.pre(/^find/, function (this: any, next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

// Support hot read paths used by article page SSR/API lookups.
articleSchema.index({ slug: 1 });
articleSchema.index({ slug: 1, publishedAt: 1 });
articleSchema.index({ publishedAt: -1, createdAt: -1 });

const ArticleModel = model('post', articleSchema);

export default ArticleModel; 
