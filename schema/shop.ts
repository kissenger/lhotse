import { boolean } from '@paypal/paypal-server-sdk/dist/types/schema';
import mongoose, {model} from 'mongoose';

const shopSchema = new mongoose.Schema({
  isActive: {type: Boolean, default: true},
  orderNumber: {type: String, required: true},
  paypal: {
    id: {type: String},
    intent: {type: Object},
    approved: {type: Object},
    patch: {type: Object},
    endPoint: {type: String},
    error: {type: Object},
  },
  orderSummary: {
    orderNumber:{type: String},
    payPalOrderId: {type: String},
    user: {
      name: {type: String},
      email_address: {type: String},
      organisation: {type: String},
      address: {
        address_line_1: {type: String},
        admin_area_2: {type: String},
        admin_area_1: {type: String},
        postal_code: {type: String},
        country_code: {type: String},
      },
    },
    items: [{
      id: {type: String},
      name: {type: String},
      description: {type: String},
      unit_amount: {
        currency_code: {type: String},
        value: {type: Number},
      },
      quantity: {type: Number},
    }],
    costBreakdown: {
      items: {type: Number},
      shipping: {type: Number},
      discount: {type: Number},
      total: {type: Number},
    },
    endPoint: {type: String},
    shippingOption: {type: String},
    timeStamps: {
      orderPatched: {type: Date},
      orderCreated: {type: Date},
      orderCompleted: {type: Date},
      readyToPost: {type: Date},
      posted: {type: Date},
      returned: {type: Date},
      refunded: {type: Date},
      errorCreated: {type: Date},
      postedEmailSent: {type: Date || null}
    },
    notes: {type: String}
  }
}, 
{
  timestamps: true
})

shopSchema.index({
  'orderSummary.orderNumber': 'text', 
  'orderSummary.user.name': 'text', 
  'orderSummary.endPoint': 'text', 
  'orderSummary.notes': 'text'})
const ShopModel = model('order', shopSchema);
export default ShopModel; 
