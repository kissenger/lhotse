import mongoose, { model } from 'mongoose';

const shopSettingsSchema = new mongoose.Schema({
  __type: { type: String, required: true, unique: true },
  outOfOfficeMessage: { type: String, default: '' },
  outOfOfficeEndDate: { type: String, default: null }
}, {
  timestamps: true
});

const ShopSettingsModel = model('shop_settings', shopSettingsSchema);

export default ShopSettingsModel;