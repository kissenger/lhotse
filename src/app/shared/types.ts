
export interface StockItem {
  id: string;
  name: string;
  description: string;
  unit_amount: {
      currency_code: string,
      value: number
  }
  isInStock: boolean;    
  image_url?: string;
  url?: string;
  // weightInKg: number;
}

export interface BasketItem extends Omit<StockItem, 'isInStock'> {
  quantity: number;
}

export interface PayPalCreateOrder {
  intent: string,
  purchase_units: Array<{
      amount: {
          currency_code: string;
          value: number;
          breakdown: {
              item_total: {
                currency_code: string,
                value: number
              },
              shipping: {
                  currency_code: string,
                  value: number
              }
          }
      },
      items: Array<BasketItem>,
      shipping: {
          options: Array<{
              id: string,
              label: string,
              selected: boolean,
              type: string,
              amount: {
                  currency_code: string,
                  value: number   
              }
          }>
      }
  }>
}


export interface OrderSummary {
  orderNumber?: string;
  payPalOrderId?: string;
  user: {
    name: string,
    organisation?: string,
    email_address: string,
    address: {
      address_line_1: string,
      admin_area_2: string,
      admin_area_1: string,
      postal_code: string,
      country_code: string,
    },
  },
  items: Array<BasketItem>,
  costBreakdown: {
    items: number,
    shipping: number,
    discount: number,
    total: number,
  },
  endPoint?: string,
  shippingOption: string,
  timeStamps?: {
    orderPatched?: string,
    orderCreated?: string,
    orderCompleted?: string,
    readyToPost?: string,
    posted?: string,
    returned?: string,
    refunded?: string,
    errorCreated?: string,
  },
  notes?: string
}


export class BlogPost {
  _id: string = '';
  slug: string = '';
  title: string = 'New Post';
  type: 'faq' | 'article' = 'faq';
  isPublished: boolean = false;
  keywords: Array<string> = [];
  subtitle: string = '';
  imgFname: string = '';
  imgAlt: string = '';
  intro: string = '';
  sections: Array<{title: string, content: string, imgFname: string, imgAlt: string}> = [{title: '', content: '', imgFname: '', imgAlt: ''}]
  conclusion: string = '';
  createdAt: string = '';
  updatedAt: string = '';
}

export type DeviceOrientation = 'landscape' | 'portrait' | undefined;

export type WidthDescriptor = 'large' | 'small' | undefined;

export type OrderStatus = 
  'orderCreated' | 
  'orderCompleted' | 
  'readyToPost' | 
  'posted' | 
  'returned' | 
  'refunded';
