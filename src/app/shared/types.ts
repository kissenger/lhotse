

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

// ---------------------------------------------------------------------------
// Organisations directory pipeline types
// ---------------------------------------------------------------------------

export interface OrgContacts {
  emails?: string[];
  phones?: string[];
  website?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  other_socials?: string[];
}

// socialLinks sub-document in generate.rank (replaces flat contacts)
export interface OrgSocialLinks {
  emails?: string[];
  phones?: string[];
  website?: string;
  instagram?: string | null;
  facebook?: string | null;
  twitter?: string | null;
  youtube?: string | null;
  tiktok?: string | null;
  other_socials?: string[];
}

// generate.rank — ranking/scoring output
export interface OrgGenerateRank {
  status?: 'ranked' | 'error';
  processed_at?: string;
  rank_score?: number;
  criterion_scores?: Record<string, number>;
  criterion_rationale?: Record<string, string>;
  socialLinks?: OrgSocialLinks;
  url_reachable?: boolean;
  reviewer_notes?: string;
  grounding_sources?: string[];
  error?: string;
}

// generate.content — descriptive content output
export interface OrgGenerateContent {
  status?: 'generated' | 'error';
  processed_at?: string;
  description?: string;
  name?: string;
  tags?: string[];
  category?: string;
  url_reachable?: boolean;
  reviewer_notes?: string;
  grounding_sources?: string[];
  error?: string;
}

// generate sub-document — pipeline output, split into rank and content
export interface OrgGenerate {
  rank?: OrgGenerateRank;
  content?: OrgGenerateContent;
}

// discover sub-document — raw Apify data
export interface OrgDiscover {
  title: string;
  website?: string;
  url?: string;
  address?: string;
  neighborhood?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  countryCode?: string;
  phone?: string;
  phoneUnformatted?: string;
  categoryName?: string;
  categories?: string[];
  totalScore?: number;
  reviewsCount?: number;
  location?: { lat: number; lng: number };
  placeId?: string;
  imageUrl?: string;
  scrapedAt?: string;
  searchString?: string;
  rank?: number;
  isAdvertisement?: boolean;
  temporarilyClosed?: boolean;
  permanentlyClosed?: boolean;
  status?: 'ineligible';
  ineligible_reason?: string;
  processed_at?: string;
}

// verify sub-document — fully verified, publication-ready
export interface OrgVerify {
  newContentPendingVerification?: boolean;
  verified?: boolean;
  verifiedAt?: string;
  verifiedData?: {
    description?: string;
    tags?: string[];
    category?: string;
    name?: string;
    localityOverride?: string;
    contacts?: {
      website?: string;
      phone?: string;
      email?: string;
      facebook?: string;
      instagram?: string;
      youtube?: string;
    };
  };
  forcedPublish?: boolean;
  suppressOnMap?: boolean;
}

// Root document — one per organisation, accumulates pipeline stages
export interface OrgDocument {
  _id: string;
  discover: OrgDiscover;
  generate?: OrgGenerate;
  verify?: OrgVerify;
  reverse_geo?: any;
  favourite?: { isFavourite?: boolean; [key: string]: any };
}

export type OrgCollectionKey = 'discover' | 'generate' | 'verify';

export interface OrgListItem {
  _id: string;
  title: string;
  city?: string;
  countryCode?: string;
  status?: string;
  rank_score?: number;
  category?: string;
  newContentPendingVerification?: boolean;
  isVerified?: boolean;
  isPublished?: boolean;     // kept for compat — equals isOnMap
  isOnMap?: boolean;         // score >= threshold OR manual publish
  isManualPublish?: boolean; // verify.forcedPublish flag
  isSuppressed?: boolean;    // verify.suppressOnMap flag
  flaggedForUpdate?: boolean;
  newContentAvailable?: boolean;
  isFavourite?: boolean;
}

export interface OrgListResponse {
  docs: OrgListItem[];
  total: number;
}

export interface OrgSettings {
  scoringThreshold: number;
}

// ---------------------------------------------------------------------------

export interface BlogSection {
  title: string;
  content: string;
  imgFname: string;
  imgAlt: string;
  videoUrl: string;
  imgCredit: string;
  sectionType?: 'cta';
  ctaLinks?: Array<{ label: string; url: string }>;
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
  sections: Array<BlogSection> = [{
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
      country: string;
      region: string;
      district: string;
      place: string;
      locality: string;
      neighborhood: string;
      localityOverride: string;
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
    location: { country: '', region: '', district: '', place: '', locality: '', neighborhood: '', localityOverride: '' },
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