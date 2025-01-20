import {Injectable} from '@angular/core';
import { isObjectIdOrHexString } from 'mongoose';

@Injectable({
  providedIn: 'root'
})

export class Shop {
    public basket: Basket;
    public items: Array<ShopItem>;
    constructor() {
        this.basket = new Basket()
        this.items = [{
            sku: "00001",
            name: "Snorkelling Britain",
            description: "Snorkelling Birtain guidebook",
            unit_amount: {
                currency_code: 'GBP',
                value: 18.99
            },
            // image_url: 'xx',
            // url: 'xx'
        },{
            sku: "00002",
            name: "Snorkelling Britain Signed",
            description: "Snorkelling Birtain guidebook, signed by the authors",
            unit_amount: {
                currency_code: 'GBP',
                value: 23.99
            },
            // image_url: 'xx',
            // url: 'xx'
        }]
    }
    createOrder() {
        return <PaypalOrder> {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'GBP',
                    value: this.basket.totalInclShipping,
                    breakdown: {
                        item_total: {
                          currency_code: 'GBP',
                          value: this.basket.totalExclShipping
                        },
                        shipping: {
                            currency_code: 'GBP',
                            value: this.basket.shipping
                        }
                    }
                },
                items: this.basket.items
            }],
        }
    }
}



interface ShopItem {
    sku: string;
    name: string;
    description: string;
    unit_amount: {
        currency_code: string,
        value: number
    }
    image_url?: string;
    url?: string
}

interface BasketItem extends Omit<ShopItem, 'inStock'> {
    quantity: number;
}


export interface PaypalOrder {
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
        items: Array<BasketItem>
    }>

}

class Basket {
    basketItems: Array<BasketItem> = [];
    add(shopItem: ShopItem, quantity: number) {
        let basketItem: ShopItem & {quantity: number} = {...shopItem, quantity: quantity};
        this.basketItems.push(basketItem);
    }
    get totalExclShipping(): number {
        let sum = 0;
        for (let basketItem of this.basketItems) {
            sum += basketItem.unit_amount.value * basketItem.quantity;
        }
        return sum
    }
    get shipping(): number {
        return 10
    }
    get totalInclShipping() : number {
        return this.totalExclShipping + this.shipping
    }
    get totalQty(): number {
        let sum = 0
        for (let basketItem of this.basketItems) {
            sum += basketItem.quantity;
        }
        return sum
    }
    get items(): Array<BasketItem> {
        return this.basketItems
    }
}
  