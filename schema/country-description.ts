import mongoose, { model } from 'mongoose';

const countryDescriptionSchema = new mongoose.Schema({
  countryName: { type: String, required: true, trim: true, unique: true },
  countrySlug: { type: String, required: true, trim: true, unique: true },
  description: { type: String, required: true, default: '' },
}, { timestamps: true, collection: 'countrydescriptions' });

const CountryDescriptionModel = model('countryDescription', countryDescriptionSchema);

export default CountryDescriptionModel;
