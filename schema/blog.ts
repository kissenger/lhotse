import mongoose, {model} from 'mongoose';

const blogSchema = new mongoose.Schema({
  slug: {type: String, required: true},
  isPublished: {type: Boolean, default: false},
  title: {type: String, required: true},
  keywords: {type: [String], required: true},
  subtitle: {type: String, required: true},
  intro: {type: String, required: true},
  imgFname: {type: String, required: true},
  imgAlt: {type: String, required: true},
  timeStamp: {type: Date, default: Date.now},
  faqs: {type: [{
    question: {type: String },
    answer: {type: String} 
  }]},
  callToAction: {type: String, required: true}
})

const BlogModel = model('post', blogSchema);

export default BlogModel; 
