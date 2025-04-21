import { Component, Inject } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { OrderSummary } from '@shared/types';
import { ShopService } from '@shared/services/shop.service'
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [ FormsModule],  
  providers: [], 
  templateUrl: './manual-order.component.html',
  styleUrl: './manual-order.component.css'
})

export class ManualOrderComponent  {

  public order!: OrderSummary;
  public shippingOptions: any;
  private _routeSubs: Subscription | undefined;  

  constructor(
    public shop: ShopService,    
    private _http: HttpService,
    @Inject(ActivatedRoute) private _route: ActivatedRoute,
    @Inject(Router) private _router: Router
    
  ) {
    this.shop.basket.add(this.shop.item("0001"),1);
    this.order = this.shop.manualOrder;
    this.shippingOptions = this.shop.basket.shippingOptions;
  }
    
  ngOnInit() {
     this._routeSubs = this._route.params.subscribe(async params => {
      if (params['orderNumber']) {
        // this.order = this.shop.manualOrder;
        let orderFromDB = await this._http.getOrderByOrderNumber(params['orderNumber']);
        let orderQty = orderFromDB.items[0].quantity;
        this.shop.resetBasket();

        this.shop.basket.add(this.shop.item("0001"),orderQty);
        this.order = this.shop.manualOrder;
        this.order = {...this.order, ...orderFromDB};
        // console.log(this.order)
      } 
    })
  }
  async onCancel() {
    this._router.navigateByUrl(`/orders`); 
  }

  async onSave() {
    this.shop.basket.shippingOption = this.order.shippingOption;
    this.shop.basket.updateQuantity(this.order.items[0].id,this.order.items[0].quantity);
    this.order.items = this.shop.basket.items;
    this.order.costBreakdown = this.shop.basket.costBreakdown;
    try {
      await this._http.upsertManualOrder(this.order);
    } catch (error) {
      console.error(error);
    }
    this._router.navigateByUrl(`/orders`); 

    // this.shop.resetBasket();
    // this.shop.basket.add(this.shop.item("0001"),1);
    // this.order = this.shop.manualOrder;
  }

  ngOnDestroy () {
    if (this._routeSubs) {
      this._routeSubs.unsubscribe();
    } 
  }

}