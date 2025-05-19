import * as config from "@assets/config.json"
import { environment } from '@environments/environment';

export const discountCodes = environment.DISCOUNT_CODES;
export const shippingOptions = config.shippingOptions;
export const maxOrderQty = config.maxOrderQty;