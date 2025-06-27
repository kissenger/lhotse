import { Order } from "@paypal/paypal-server-sdk";

export interface StockItem {
  id: string;
  name: string;
  description: string;
  unit_amount: {
      currency_code: string,
      value: number
  },
  dimensions: {
    thickness: number,
    width: number,
    length: number
  },
  isInStock: boolean;    
  images: Array<{
    src: string,
    alt: string
  }>;
  weightInGrams: number;
}

export type CarouselImages = Array<{
  src: string, 
  alt: string, 
  priority?: boolean, 
  textbox?: {
    header: string, 
    text: string
  }
}>


export interface BasketItem extends Omit<StockItem, 'isInStock'> {
  quantity: number;
}

export interface PayPalShippingOption {
  id: string,
  label: string,
  selected: boolean,
  type: 'SHIPPING',
  amount: {
      currency_code: 'GBP',
      value: number
  }
}

export interface ParcelType {
  packageType: string,
  maxWeight: number,
  maxDimensions: {
    thickness: number,
    width: number,
    length: number
  },
  packaging: {
    weight: number
  },
  services: Array<{
    label: string,
    cost: number
  }>
}

export interface PayPalCreateOrder {
  orderSummary: OrderSummary,
  paypal: {
    intent: {
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
  }

}

export interface OrderItems {
  id: string,
  name: string,
  description: string,
  unit_amount: {
    currency_code: string,
    value: number
  },
  quantity: 1
}
  

export type OrderType = 
  "freeMediaOrder" | 
  "freeMediaOrderDan" |    
  "freeFriendsOrder" | 
  "replacementOrder" | 
  "manualOrder" |
  "retailOrder";

export interface OrderSummary {
  orderNumber?: string;
  payPalOrderId?: string;
  isAction?: boolean;
  discount?: number;
  orderType?: OrderType;
  user: {
    name: string,
    organisation: string,
    email_address: string,
    address: {
      address_line_1: string,
      address_line_2: string,
      admin_area_2: string,
      admin_area_1: string,
      postal_code: string,
      country_code: string,
    },
  },
  discountInfo?: {
    discountCode?: string,
    discountPercent?: number,
    discountValue?: number,
  }
  items: Array<BasketItem> | Array<OrderItems>,
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
    postedEmailSent?: string,
    orderCancelled?: string
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
  sections = [{
    title: '', 
    content: '', 
    imgFname: '', 
    imgAlt: '', 
    videoUrl: ''
  }];
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
  'refunded' |
  'postedEmailSent'|
  'orderCancelled';


  export interface AuthUser {
    username: string;
    isServiceProvider?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'user';
  }
