import { Component } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { OrderSummary } from '@shared/types';
import { Shipping, ShopService } from '@shared/services/shop.service'
import { HttpService } from '@shared/services/http.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [ FormsModule],  
  providers: [], 
  templateUrl: './manual-order.component.html',
  styleUrl: './manual-order.component.css'
})

export class ManualOrderComponent  {

    public order: OrderSummary;
    public shippingOptions;

  constructor(
    public shop: ShopService,    
    private _http: HttpService,
  ) {
    this.shop.basket.add(this.shop.item("0001"),1);
    this.order = this.shop.manualOrder;
    this.shippingOptions = this.shop.basket.shippingOptions;
  }
    
  ngOnInit() {

  }

  async onSave() {
    // console.log(this.order.shippingOption)
    this.shop.basket.shippingOption = this.order.shippingOption;
    this.shop.basket.updateQuantity(this.order.items[0].id,this.order.items[0].quantity);
    this.order.items = this.shop.basket.items;
    this.order.costBreakdown = this.shop.basket.costBreakdown;
    // console.log(this.order);
    await this._http.createManualOrder(this.order);
    this.shop.resetBasket();
    this.shop.basket.add(this.shop.item("0001"),1);
    this.order = this.shop.manualOrder;
  }


}