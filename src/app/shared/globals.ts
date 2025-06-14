import { environment } from '@environments/environment';
import { ShippingMethod } from './types';

export const discountCodes = environment.DISCOUNT_CODES;
export const shippingOptionsByWeight: Array<ShippingMethod> = environment.SHIPPING_OPTIONS_BY_WEIGHT;
export const maxPackageWeight: number = environment.MAX_PACKAGE_WEIGHT_IN_GRAMS;
export const stage: string = environment.STAGE;