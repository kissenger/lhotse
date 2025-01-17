import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})

export class Shop {
    public basket: Basket;
    public items: Array<ShopItem>;
    constructor() {
        this.basket = new Basket()
        this.items = [{
            id: "1",
            name: "Snorkelling Britain",
            price: 18.99,
            stockStatus: true
        }]
    }
}

interface ShopItem {
    id: string;
    name: string;
    price: number;
    stockStatus: boolean;
}

class Basket {
    basketItems: Array<{item: ShopItem, qty: number}>=[];
    add(itemToAdd: ShopItem, qty: number) {
        this.basketItems.push({item: itemToAdd, qty});
    }
    update(itemToUpdate: ShopItem, newQty: number) {
        for (let basketItem of this.basketItems) {
            if (basketItem.item.name == itemToUpdate.name) {
                basketItem.qty = newQty
            }
        }
    }
    get totalPrice(): number {
        let sum = 0
        for (let basketItem of this.basketItems) {
            sum += basketItem.item.price * basketItem.qty;
        }
        return sum
    }
    get totalQty(): number {
        let sum = 0
        for (let basketItem of this.basketItems) {
            sum += basketItem.qty;
        }
        return sum
    }
}
  