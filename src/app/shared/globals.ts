import { environment } from '@environments/environment';
import { ParcelType } from './types';

export const discountCodes = environment.DISCOUNT_CODES;
export const shopItems = environment.SHOP_ITEMS;
export const shippingOptions: Array<ParcelType> = environment.SHIPPING_OPTIONS
export const stage: string = environment.STAGE;
export const mapboxToken: string = environment.MAPBOX_TOKEN;