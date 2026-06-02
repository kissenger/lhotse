import { environment } from '@environments/environment';
import { ParcelType } from './types';

export const discountCodes = environment.DISCOUNT_CODES;
export const shopItems = environment.SHOP_ITEMS;
export const shippingOptions: Array<ParcelType> = environment.SHIPPING_OPTIONS
export const stage: string = environment.STAGE;
export const mapboxToken: string = environment.MAPBOX_TOKEN;
const MAPBOX_CDN_VERSION = 'v3.15.0';
export const MAPBOX_JS_URL = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_CDN_VERSION}/mapbox-gl.js`;
export const MAPBOX_CSS_URL = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_CDN_VERSION}/mapbox-gl.css`;