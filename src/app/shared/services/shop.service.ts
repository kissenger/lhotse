import {Injectable} from '@angular/core';
import {StockItem, BasketItem, OrderSummary} from '@shared/types';
import {shippingOptions} from '@shared/globals';

@Injectable({
  providedIn: 'root'
})

export class ShopService { 

    private _basket: Basket;
    private _user: User;
    private _items: Array<StockItem>;
    private _orderNumber?: string;
    private _orderStatus: "error" | "complete" | "draft" = "draft";
    private _orderNotes: string = '';
    
    constructor() {
        this._basket = new Basket();
        this._user = new User();
        this._items = [{
            id: "0001",
            name: "Snorkelling Britain",
            description: "Snorkelling Britain guidebook",
            unit_amount: { currency_code: 'GBP', value: 18.99 },
            isInStock: true,
        }, {
            id: "0002",
            name: "Snorkelling Britain Signed",
            description: "Snorkelling Britain guidebook, signed by the authors",
            unit_amount: { currency_code: 'GBP', value: 23.99 },
            isInStock: true,
        }]
    }

    set orderNotes(notes:string) {
        this._orderNotes = notes
    }

    get orderNotes() {
        return this._orderNotes;
    }

    get user() {
        return this._user;
    }

    set orderStatus(os: "draft" | "error" | "complete") {
        this._orderStatus = os;
    }
    
    get orderStatus() {
        return this._orderStatus;
    }
    
    get items() {
        return this._items;
    }

    item(id: string) {
        return this._items.find(item=>item.id==id) || this._items[0];
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
    
    reset() {
        this._basket = new Basket();
        this._user = new User();
    }

    get order() {
        return {
            orderSummary: {
                discountInfo: this.basket.discountInfo,
                isNoCharge: this.basket.isNoCharge,
                notes: this._orderNotes,
                user: this._user.json,
                items: this.basket.items,
                shippingOption: this.basket.shippingOption,
                costBreakdown: this.basket.costBreakdown,
                endPoint: 'manual'
            },
            paypal: {
                intent: {
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
    }
}


export class Shipping {

    private _shippingOptions = shippingOptions;
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
        return this._activeShippingOption.costs[Math.min(4,qty)];
    }

}

export class User {

    public name = '';
    public organisation = '';
    public email_address = '';
    public address_line_1 = '';
    public address_line_2 = '';
    public admin_area_2 = '';
    public admin_area_1 = '';
    public postal_code = '';
    public country_code = '';

    set setDetails(user: any) {
        this.name = user.name;
        this.organisation = user.organisation;
        this.email_address = user.email_address;
        this.address_line_1 = user.address.address_line_1;
        this.address_line_2 = user.address.address_line_2;
        this.admin_area_2 = user.address.admin_area_2;
        this.admin_area_1 = user.address.admin_area_1;
        this.postal_code = user.address.postal_code;
        this.country_code = user.address.country_code;
    }

    get json() {
        return {
            name: this.name,
            organisation: this.organisation,
            email_address: this.email_address,
            address: {
                address_line_1: this.address_line_1,
                address_line_2: this.address_line_2,
                admin_area_2: this.admin_area_2,
                admin_area_1: this.admin_area_1,
                postal_code: this.postal_code,
                country_code: this.country_code
            }
        }
    }
  }
  

class Basket {
    private _shipping = new Shipping();
    private _basketItems: Array<BasketItem> = [];
    private _discountPercent: number = 0;
    private _discountCode: string = '';
    private _isNoCharge: boolean = false;

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

    set isNoCharge(isnc: boolean) {
        this._isNoCharge = isnc;
    }

    get isNoCharge() {
        return this._isNoCharge;
    }

    get discountInfo() {
        return {
            discountCode: this.discountCode,
            discountPercent: this.discountPercent,
            discountValue: this.discountValue
        }
    }

    set discountCode(dc: string) {
        this._discountCode = dc;
    }

    get discountCode() {
        return this._discountCode;
    }

    set discountPercent(dc: number) {
        this._discountPercent = dc;
    }

    get discountPercent() {
        return this._discountPercent;
    }

    get discountValue() {
        return Math.trunc(Math.round(-this.itemsCost * 100) * this._discountPercent/100) / 100;
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
        // if (this._isNoCharge) {
        //     return 0;
        // } else {
            let sum = 0;
            for (let basketItem of this._basketItems) {
                sum += basketItem.unit_amount.value * basketItem.quantity;
            }
            return Math.round(sum*100)/100;
        // }
    }

    get shippingCost(): number {
        return this._shipping.getShippingCost(this.totalQty);
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
  