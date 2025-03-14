import {Inject, Injectable} from '@angular/core';
import { truncate } from 'fs';

@Injectable({
  providedIn: 'root'
})

export class ShopService { 

    private _basket: Basket;
    private _items: Array<StockItem>;
    private _order?: Order;
    
    constructor() {
        this._basket = new Basket();
        this._items = [{
            id: "0001",
            name: "Snorkelling Britain",
            description: "Snorkelling Britain guidebook",
            unit_amount: { currency_code: 'GBP', value: 18.99 },
            isInStock: true
        }, {
            id: "0002",
            name: "Snorkelling Britain Signed",
            description: "Snorkelling Britain guidebook, signed by the authors",
            unit_amount: { currency_code: 'GBP', value: 23.99 },
            isInStock: true
        }]
    }

    get items() {
        return this._items;
    }
    item(id: string) {
        let item = this._items.find(item=>item.id==id);
        if (item) {
            return item;
        } 
        throw new ShopError(`ShopItem ${id} not found`)
    }
    get newOrder() {
        this._order = new Order(this);
        return this._order;
    }
    get basket() {
        return this._basket;
    } 
    get order() {
        return this._order;
    } 
}

export class ShopError extends Error {
    constructor(@Inject(String) message: string) {
        super(message)
    }
}

export class Order {
    private _orderError?: PayPalOrderError;
    private _order: PayPalCreateOrder;
    private _orderApproved?: PayPalCaptureOrder;
    private _orderNumber?: string;

    constructor(
        private _shop: ShopService
    ) {
        this._order = this._createOrder();
    }
    get intent() {
        return this._order;
    }
    get error() {
        return this._orderError;
    }
    get approved() {
        return this._orderApproved;
    }    
    get orderNumber() {
        return this._orderNumber;
    }
    set orderNumber(on: string | undefined) {
        this._orderNumber = on;
    }
    private _createOrder() {
        return {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'GBP',
                    value: this._shop.basket.grandTotal,
                    breakdown: {
                        item_total: {
                            currency_code: 'GBP',
                            value: this._shop.basket.totalGoodsOnly
                        },
                        shipping: {
                            currency_code: 'GBP',
                            value: this._shop.basket.shipping
                        },
                        discount : {
                            currency_code: 'GBP',
                            value: -this._shop.basket.appliedDiscount
                          }
                    }
                },
                // items: this._shop.basket.items,
                shipping: {
                    options: [{
                        id: 'royalMailTracked24',
                        label: 'Royal Mail Tracked 24',
                        selected: false,
                        type: 'SHIPPING',
                        amount: {
                            currency_code: 'GBP',
                            value: this._shipping.royalMailTracked24[Math.min(4,this._shop.basket.totalQty)]
                        }
                    },{
                        id: 'royalMailTracked48',
                        label: 'Royal Mail Tracked 48',
                        selected: true,
                        type: 'SHIPPING',
                        amount: {
                            currency_code: 'GBP',
                            value: this._shipping.royalMailTracked48[Math.min(4,this._shop.basket.totalQty)]
                        }
                    },
                ]}
            }]
        };
    }

    private _shipping: ShippingCosts = {
        royalMailTracked24: [ 0, 3.50, 4.25, 4.25, 7.69 ],
        royalMailTracked48: [ 0, 2.70, 3.39, 3.39, 6.65 ]
    }    

    createApproved(apiResponse: PayPalCaptureOrder) {
        this._orderApproved = apiResponse;
    }
    createError(apiResponse: PayPalOrderError) {
        this._orderError = apiResponse;
    }
        
}

interface StockItem {
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
}

interface BasketItem extends Omit<StockItem, 'isInStock'> {
    quantity: number;
}

export interface PayPalOrderError {
    name: string,
    details: Array<{
        issue: string,
        description: string
    }>,
    message: string,
    debug_id: string
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
        // items: Array<BasketItem>,
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

export interface PayPalCaptureOrder {
    id: string,
    status: string,
    payer: {
        name: {
            given_name: string,
            surname: string
        },
        email_address: string,
        payer_id: string
    }
    purchase_units: Array<{
        shipping: { 
            address: {
                address_line_1: string;
                admin_area_1: string;
                admin_area_2: string;
                country_code: string;
                postal_code: string;
            },
            name: {
                full_name: string
            }
        }
    }>
}

export type ShippingOption = "royalMailTracked24" | "royalMailTracked48";
export type ShippingCosts = {
    [key in ShippingOption]: Array<number>
}

class Basket {
    private _basketItems: Array<BasketItem> = [];
    private _shippingCosts: ShippingCosts = {
        royalMailTracked24: [ 0, 3.50, 4.25, 4.25, 7.69 ],
        royalMailTracked48: [ 0, 2.70, 3.39, 3.39, 6.65 ]
    }    
    private _shippingOption: ShippingOption = "royalMailTracked48";
    private _discount: number = 0;

    add(stockItem: StockItem, quantity: number) {
        let itemForBasket: BasketItem & {isInStock?: boolean} = {...stockItem, quantity: quantity};
        delete itemForBasket.isInStock;
        this._basketItems.push(itemForBasket);
    }

    clear() {
        this._basketItems = [];
    }

    getQuantity(id:string) {
        return this._basketItems.find(item=>item.id==id)?.quantity || 0;
    }

    updateQuantity(itemId: string, newQty: number) {
        let item = this._basketItems.find(item=>item.id==itemId);
        if (item) {
            item.quantity = newQty;
        }
    }

    set discount(dc: number) {
        console.log(dc);
        this._discount = dc;
        console.log(this._discount)

    }

    get appliedDiscount() {
        return Math.trunc(Math.round(-this.totalGoodsOnly * 100) * this._discount/100) / 100;
    }

    get shippingOption() {
        return this._shippingOption;
    }

    set shippingOption(so: ShippingOption) {
        this._shippingOption = so;
    }
    
    get totalGoodsOnly(): number {
        let sum = 0;
        for (let basketItem of this._basketItems) {
            sum += basketItem.unit_amount.value * basketItem.quantity;
        }
        return sum;
    }

    get shipping(): number {
        return this._shippingCosts[this._shippingOption][Math.min(4,this.totalQty)]
    }

    get grandTotal() : number {
        return Math.round((this.totalGoodsOnly + this.shipping + this.appliedDiscount) * 100) / 100;
    }

    get totalQty(): number {
        let sum = 0
        for (let basketItem of this._basketItems) {
            sum += basketItem.quantity;
        }
        return sum
    }

    get items(): Array<BasketItem> {
        return this._basketItems
    }

}
  