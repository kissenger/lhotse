import {Inject, Injectable} from '@angular/core';
import { truncate } from 'fs';

@Injectable({
  providedIn: 'root'
})

export class ShopService { 

    private _basket: Basket;
    private _items: Array<StockItem>;
    private _orderNumber?: string;
    private _orderStatus: "error" | "complete" | "draft" = "draft";
    
    constructor() {
        this._basket = new Basket();
        this._items = [{
            id: "0001",
            name: "Snorkelling Britain",
            description: "Snorkelling Britain guidebook",
            unit_amount: { currency_code: 'GBP', value: 18.99 },
            isInStock: true,
            // weightInKg: 0.75
        }, {
            id: "0002",
            name: "Snorkelling Britain Signed",
            description: "Snorkelling Britain guidebook, signed by the authors",
            unit_amount: { currency_code: 'GBP', value: 23.99 },
            isInStock: true,
            // weightInKg: 0.75
        }]
    }

    resetBasket() {
        this._basket = new Basket();
    }

    get items() {
        return this._items;
    }

    set orderStatus(os: "draft" | "error" | "complete") {
        this._orderStatus = os;
    }
    
    get orderStatus() {
        return this._orderStatus;
    }

    item(id: string) {
        return this._items.find(item=>item.id==id) || this._items[0];
        // throw new ShopError(`ShopItem ${id} not found`)
    }

    get orderNumber() {
        return this._orderNumber;
    }
    set orderNumber(on: string | undefined) {
        this._orderNumber = on;
    }

    get basket() {
        return this._basket;
    } 

    get manualOrder() {
        return {
            user: {
                name: '',
                email_address: '',
                address: {
                    address_line_1: '',
                    admin_area_2: '',
                    admin_area_1: '',
                    postal_code: '',
                    country_code: 'GB',
                },
            },
            items: this.basket.items,
            shippingOption: this.basket.shippingOption,
            costBreakdown: this.basket.costBreakdown,
            endPoint: 'manual'
        }
    }
    get orderIntent() {
        return {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'GBP',
                    value: this.basket.totalCost,
                    breakdown: {
                        item_total: {
                            currency_code: 'GBP',
                            value: this.basket.itemsCost
                        },
                        shipping: {
                            currency_code: 'GBP',
                            value: this.basket.shippingCost
                        },
                        discount : {
                            currency_code: 'GBP',
                            value: -this.basket.discountValue
                          }
                    }
                },
                items: this.basket.items,
                shipping: {
                    options: this.basket.shippingOptions
                }
            }]
        }
    }
}

// export class ShopError extends Error {
//     constructor(@Inject(String) message: string) {
//         super(message)
//     }
// }


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
    // weightInKg: number;
}

export interface BasketItem extends Omit<StockItem, 'isInStock'> {
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

export class Shipping {

    private _shippingOptions: Array<{label: string, costs: Array<number>, default: boolean}> = [
        {   label: "Pickup By Arrangement Only",
            costs: [ 0, 0, 0, 0, 0 ],
            default: false },
        {   label: "Royal Mail First Class",
            costs: [ 0, 3.30, 4.09, 7.39, 7.39],
            default: false },
        {   label: "Royal Mail Second Class",
            costs: [ 0, 2.50, 3.25, 6.35, 6.35],
            default: true },         
    ];

    private _activeShippingOption = this._shippingOptions.find(option=>option.default===true) || this._shippingOptions[0];

    set activeShippingOption(label: string) {
        this._activeShippingOption = this._shippingOptions.find(option=>option.label===label) || this._shippingOptions[0];
    } 

    get activeShippingOption(): {label: string, costs: Array<number>, default: boolean} {
        return this._activeShippingOption;
    }

    getShippingOptions(qty: number) {
        let options: any = [];
        this._shippingOptions.forEach( (option: {label: string, costs: Array<number>, default: boolean}) => {
            options.push({
                id: option.label,
                label: option.label,
                selected: option.label === this._activeShippingOption.label,
                type: 'SHIPPING',
                amount: {
                    currency_code: 'GBP',
                    value: option.costs[qty]
                }
            }) 
        })
        return options;
    }

    getShippingCost(qty: number) {
        // return this._shippingOptions.label[qty];
        // let option = this._shippingOptions.find(option=>option.label===label);
        return this._activeShippingOption.costs[Math.min(4,qty)];
    }

}


class Basket {
    private _shipping = new Shipping();
    private _basketItems: Array<BasketItem> = [];
    private _discount: number = 0;
    // private _shippingOption = this._shippingOptions.find(option=>option.label===label);

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
        let item = this._basketItems.find(item=>item.id===itemId);
        if (item) {
            item.quantity = newQty;
        }
    }

    set discount(dc: number) {
        // console.log(dc);
        this._discount = dc;
        // console.log(this._discount)

    }

    get discountValue() {
        return Math.trunc(Math.round(-this.itemsCost * 100) * this._discount/100) / 100;
    }

    get costBreakdown() {
        return {
            items: this.itemsCost,
            shipping: this.shippingCost,
            discount: this.discountValue,
            total: this.totalCost
        }
    }

    get shippingOption() {
        return this._shipping.activeShippingOption.label
    }

    get shippingOptions() {
        return this._shipping.getShippingOptions(this.totalQty);
    }

    set shippingOption(so: string) {
        this._shipping.activeShippingOption = so;
    }
    
    get itemsCost(): number {
        let sum = 0;
        for (let basketItem of this._basketItems) {
            sum += basketItem.unit_amount.value * basketItem.quantity;
        }
        return Math.round(sum*100)/100;
    }

    get shippingCost(): number {
        return this._shipping.getShippingCost(this.totalQty);
        // return this._shippingOptions[this._shippingOption][Math.min(4,this.totalQty)]
    }

    get totalCost() : number {
        return Math.round((this.itemsCost + this.shippingCost + this.discountValue) * 100) / 100;
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
  