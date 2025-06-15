import {Injectable} from '@angular/core';
import {StockItem, BasketItem, OrderType, PayPalShippingOption, ShippingMethod} from '@shared/types';
import {maxPackageWeight, shippingOptionsByWeight} from '@shared/globals';

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
            description: "Snorkelling Britain guidebook (ISBN 978-1910636473)",
            unit_amount: { currency_code: 'GBP', value: 18.99 },
            // maxOrderQty: 5,
            isInStock: true,
            image: {
                src: 'assets/photos/content/snorkelling-britain-100-marine-adventures-book-cover-3d.jpg',
                alt: 'Snorkelling Britain book cover in 3D '
            },
            weightInGrams: 660
        }, {
            id: "0002",
            name: "Snorkelling Britain Signed",
            description: "Snorkelling Britain guidebook (ISBN 978-1910636473), signed by the authors",
            unit_amount: { currency_code: 'GBP', value: 18.99 },
            image: {
                src: 'assets/photos/content/snorkelling-britain-100-marine-adventures-book-cover-3d.jpg',
                alt: 'Snorkelling Britain book cover in 3D '
            },
            isInStock: true,
            weightInGrams: 660
        }, {
            id: "0003",
            name: "Snorkelology logo sticker",
            description: "5 x Snorkelology logo sticker (50mm diameter)",
            unit_amount: { currency_code: 'GBP', value: 3.99 },
            image: {
                src: 'photos/shop/snorkelology-stickers.jpg',
                alt: 'Image showing five Snorkelology logo stickers'
            },
            isInStock: true,
            weightInGrams: 50
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
                orderType: this.basket.orderType,
                notes: this._orderNotes,
                user: this._user.json,
                items: this.basket.items,
                shippingOption: this.basket.selectedShippingLabel,
                costBreakdown: this.basket.costBreakdown,
                endPoint: 'manual',
                signedByAuthors: 'false'
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
                        items: this.basket.items.filter( item => item.quantity!=0),
                        shipping: {
                            options: this.basket.paypalShippingOptions
                        }
                    }]
                }
            }
        }
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

    private _basketItems: Array<BasketItem> = [];
    private _discountPercent: number = 0;
    private _discountCode: string = '';
    private _orderType: OrderType = 'manualOrder';
    private _parcelType: ShippingMethod | undefined;
    private _selectedShippingLabel: string | undefined;

    add(stockItem: StockItem, quantity: number) {
        let itemForBasket: BasketItem & {isInStock?: boolean} = {...stockItem, quantity: quantity};
        delete itemForBasket.isInStock;
        this._basketItems.push(itemForBasket);
        this._parcelType = shippingOptionsByWeight.find(so => so.maxWeight - so.packagingWeight > this.weightOfItems)!;
    }

    incrementQty(itemId: string, inc: number) {
        const item = this._basketItems.find(item=>item.id===itemId)!;
        if ( (item.quantity + inc >= 0) && (this.totalOrderWeight + inc * item.weightInGrams < maxPackageWeight) ) {
            item.quantity += inc;
            this._parcelType = shippingOptionsByWeight.find(so => so.maxWeight - so.packagingWeight > this.weightOfItems)!;
        } 
   }

    set orderType(ot: OrderType) {
        this._orderType = ot;
    }

    get orderType() {
        return this._orderType;
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

    get costBreakdown() {
        return {
            items: this.itemsCost,
            shipping: this.shippingCost,
            discount: this.discountValue,
            total: this.totalCost
        }
    }

    //weight of package excluding packaging
    get weightOfItems() {
        return this._basketItems.reduce( (sum,item) => sum + item.weightInGrams*item.quantity, 0);
    }

    get totalOrderWeight() {
        return this.weightOfItems + this._parcelType!.packagingWeight;
    }

    get shippingCost(): number {
        
        if (this._selectedShippingLabel) {
            try {
                return this._parcelType!.services.find( s => s.label===this._selectedShippingLabel)!.cost;
            } catch {
                this._selectedShippingLabel = undefined;
                this._parcelType!.services[0].cost;
            }
        } 
        return this._parcelType!.services[0].cost;
    }    
    
    get parcelType(): ShippingMethod {
        return this._parcelType!;
    }

    set selectedShippingLabel(label: string) {
        this._selectedShippingLabel = label;
    }

    get selectedShippingLabel() {
        return this._selectedShippingLabel || this._parcelType!.services[0].label;
    }    

    // called only when paypal pay button is pressed
    get paypalShippingOptions(): Array<PayPalShippingOption> {
        return this._parcelType!.services.map( (s,i) => ({
            id: s.label,
            label: s.label,
            selected: this._selectedShippingLabel ? this._selectedShippingLabel===s.label : i===0,
            type: 'SHIPPING',
            amount: {
                currency_code: 'GBP',
                value: s.cost
            }
        }));
    }
    
    get discountValue() {
        return Math.trunc(Math.round(-this.itemsCost * 100) * this._discountPercent/100) / 100;
    } 

    get itemsCost(): number {
        return Math.round(this._basketItems.reduce((sum,item) => sum + item.unit_amount.value*item.quantity,0)*100)/100;
    }


    get totalCost(): number {
        return Math.round((this.itemsCost + this.shippingCost + this.discountValue) * 100) / 100;
    }

    get itemQty(): number {
        return this._basketItems.reduce( (sum,item) => sum+item.quantity,0);
    }

    get items(): Array<BasketItem> {
        return this._basketItems
    }

}
  