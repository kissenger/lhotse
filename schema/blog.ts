import mongoose, {model} from 'mongoose';

const blogSchema = new mongoose.Schema({
  slug: {type: String, required: true},
  isPublished: {type: Boolean, default: false},
  type: {type: String, default: 'faq'},
  title: {type: String, required: true},
  keywords: {type: [String], required: true},
  subtitle: {type: String, required: true},
  intro: {type: String, required: true},
  imgFname: {type: String, required: true},
  imgAlt: {type: String, required: true},
  timeStamp: {type: Date, default: Date.now},
  sections: {type: [{
    title: {type: String},
    content: {type: String},
    imgFname: {type: String},
    imgAlt: {type: String}
  }]},
  conclusion: {type: String, required: true}
})

const BlogModel = model('post', blogSchema);

export default BlogModel; 
