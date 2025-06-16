import {Injectable} from '@angular/core';
import {StockItem, BasketItem, OrderType, PayPalShippingOption, ParcelType} from '@shared/types';
import {shippingOptions, shopItems} from '@shared/globals';

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
        this._items = shopItems;
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
                shippingOption: this.basket.selectedShippingService,
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
    private _parcelType: ParcelType = shippingOptions[0];
    private _selectedShippingService: string | undefined;

    // Add an item to the basket with a qty = 1
    add(stockItem: StockItem, quantity: number) {
        let itemForBasket: BasketItem & {isInStock?: boolean} = {...stockItem, quantity: quantity};
        delete itemForBasket.isInStock;
        this._basketItems.push(itemForBasket);
        this.setParcelType();
    }

    // Increments the basket quantity, checking to ensure maximum allowable order weight is not violated, and tha qty>=0
    incrementQty(itemId: string, inc: number) {
        const item = this._basketItems.find(item=>item.id===itemId)!;
        if ( (item.quantity + inc >= 0) && (this.totalOrderWeight + inc * item.weightInGrams < shippingOptions.slice(-1)[0].maxWeight) ) {
            item.quantity += inc;
            this.setParcelType();
        } 
    }

    // Select parcel based on size and weight of items in basket
    // Returns the parcelType object from the array and stores it in the class 
    setParcelType() {
        const {weight, thickness} = this.basketProperties;
        this._parcelType = shippingOptions.find( so => 
            (so.maxWeight - so.packaging.weight > weight) &&
            (so.maxDimensions.thickness > thickness)
        )!;
        console.log(this._parcelType, weight, thickness, this.totalOrderWeight)
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
    get basketProperties() {
        return {
            weight: this._basketItems.reduce( (sum,item) => sum + item.weightInGrams*item.quantity, 0),
            thickness: this._basketItems.reduce( (sum,item) => sum + item.dimensions.thickness*item.quantity, 0)
        }
    }

    get totalOrderWeight() {
        return this.basketProperties.weight + this._parcelType!.packaging.weight;
    }

    get shippingCost(): number {
        
        if (this._selectedShippingService) {
            try {
                return this._parcelType!.services.find( s => s.label===this._selectedShippingService)!.cost;
            } catch {
                this._selectedShippingService = undefined;
                this._parcelType!.services[0].cost;
            }
        } 
        return this._parcelType!.services[0].cost;
    }    
    
    get parcelType(): ParcelType {
        return this._parcelType!;
    }

    set selectedShippingService(label: string) {
        this._selectedShippingService = label;
    }

    get selectedShippingService() {
        return this._selectedShippingService || this._parcelType!.services[0].label;
    }    

    // called only when paypal pay button is pressed
    get paypalShippingOptions(): Array<PayPalShippingOption> {
        return this._parcelType!.services.map( (s,i) => ({
            id: s.label,
            label: s.label,
            selected: this._selectedShippingService ? this._selectedShippingService===s.label : i===0,
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
  