import mongoose, {model} from 'mongoose';

const shopSchema = new mongoose.Schema({
  orderNumber: {type: String, required: true},
  intent: {type: Object, required: true},
  approved: {type: Object},
  error: {type: Object},
  endPoint: {type: String}
}, 
{
  timestamps: true
})

const ShopModel = model('order', shopSchema);

export default ShopModel; 
