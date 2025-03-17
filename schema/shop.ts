import mongoose, {model} from 'mongoose';

const shopSchema = new mongoose.Schema({
  orderNumber: {type: String, required: true},
  intent: {type: Object},
  approved: {type: Object},
  error: {type: Object},
  endPoint: {type: String},
  orderCreated: {type: Date},
  orderCompleted: {type: Date},
  readyToPost: {type: Date},
  posted: {type: Date},
  returned: {type: Date},
  refunded: {type: Date},
  errorCreated: {type: Date}
}, 
{
  timestamps: true
})

const ShopModel = model('order', shopSchema);

export default ShopModel; 
