import {BasketItem} from '@shared/services/shop.service'

export interface OrderSummary {
  orderNumber?: string;
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
