

export interface StockItem {
  id: string;
  name: string;
  description: string;
  purchase_note?: string;
  unit_amount: {
      currency_code: string,
      rrp?: number,
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
    orderCancelled?: string,
    invoiced?: string,
    invoicePaid?: string
  },
  notes?: string
}

export class BlogPost {
  _id: string = '';
  slug: string = '';
  title: string = 'New Post';
  type: 'faq' | 'article' = 'faq';
  keywords: Array<string> = [];
  subtitle: string = '';
  imgFname: string = '';
  imgAlt: string = '';
  imgCredit: string = '';
  intro: string = '';
  sections = [{
    title: '', 
    content: '', 
    imgFname: '', 
    imgAlt: '', 
    videoUrl: '',
    imgCredit: ''
  }];
  conclusion: string = '';
  createdAt: string = '';
  updatedAt: string = '';
  publishedAt: string = '';
  author?: string;
  likes: number = 0;
  isDeleted?: boolean;
  deletedAt?: string | null;
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
  'orderCancelled'|
  'invoiced'|
  'invoicePaid';


  export interface AuthUser {
    username: string;
    isServiceProvider?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'user';
  }


export interface Feature {
  id: string; 
  type: 'Feature';
  geometry:  {
    type: 'Point',
    coordinates: [number, number]
  };
  properties: FeatureProperties;
}

  export interface FeatureProperties {
    symbolSortOrder: number;
    region: string;
    placeName: string;
    name: string;
    description: string;
    categories: Array<string>;
    moreInfo: Array<{title?: string, icon?: string, url?: string, text?: string}>
  }

export class MapFeature {
  _id: string = '';
  showOnMap: 'No' | 'Development' | 'Production' = 'No';
  location: { type: string; coordinates: [number, number] } = { type: 'Point', coordinates: [0, 0] };
  properties: {
    featureType: string;
    symbolSortOrder: number | null;
    name: string;
    region: string;
    imageUrl: string;
    location: {
      adminLevel3: string;
      county: string;
      locality: string;
      localityOverride: string;
      postalTown: string;
    };
    description: string;
    categories: string[];
    contact: { name: string; email: string };
    moreInfo: Array<{ title: string; icon: string; url: string; text: string; preferred: boolean }>;
    siteInfo: {
      isCarAccess: boolean;
      parking: { name: string; location: { type: string; coordinates: [number, number] } | null; isPayAndDisplay: boolean };
    };
    researchNotes: {
      isVisited: boolean;
      visitPriority: boolean;
      notes: string;
      links: string[];
      credits: string;
      rating: 'good' | 'ok' | 'poor' | 'not for snorkelling' | '';
    };
  } = {
    featureType: '',
    symbolSortOrder: null,
    name: 'New Site',
    region: '',
    imageUrl: '',
    location: { adminLevel3: '', county: '', locality: '', localityOverride: '', postalTown: '' },
    description: '',
    categories: [],
    contact: { name: '', email: '' },
    moreInfo: [],
    siteInfo: {
      isCarAccess: false,
      parking: { name: '', location: null, isPayAndDisplay: false },
    },
    researchNotes: { isVisited: false, visitPriority: false, notes: '', links: [], credits: '', rating: '' },
  };
  createdAt: string = '';
  updatedAt: string = '';
}

// JSON-LD schema helpers used by SEOService.
export type SchemaOrganization = Record<string, unknown>;
export type SchemaBlogPosting = Record<string, unknown>;
export type SchemaProduct = Record<string, unknown>;
export type SchemaFAQPage = Record<string, unknown>;
export type SchemaBreadcrumb = Record<string, unknown>;