import { Component } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Shop } from '@shared/services/shop.service'
import { FormsModule } from "@angular/forms";

@Component({
  standalone: true,
  imports: [FormsModule, CurrencyPipe],
  selector: 'app-basket',
  templateUrl: './basket.component.html',
  styleUrls: ['./basket.component.css']
})

export class BasketComponent  {
  public shop: Shop;
  public qty: number = 0;
  constructor() {
    this.shop = new Shop();
    console.log(this.shop.basket.add(this.shop.items[0],2))
  }


}