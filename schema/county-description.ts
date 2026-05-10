import mongoose, { model } from 'mongoose';

const countyDescriptionSchema = new mongoose.Schema({
  countyName: { type: String, required: true, trim: true, unique: true },
  countySlug: { type: String, required: true, trim: true, unique: true },
  description: { type: String, required: true, default: '' },
}, { timestamps: true, collection: 'countydescriptions' });

const CountyDescriptionModel = model('countyDescription', countyDescriptionSchema);

export default CountyDescriptionModel;
