import { Component, Inject } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { OrderSummary } from '@shared/types';
import { ShopService, User } from '@shared/services/shop.service'
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

  private _routeSubs: Subscription | undefined;  
  public isEditMode = false;
  public newOrderNote: string = '';
  private _orderNumber: string = '';

  constructor(
    public shop: ShopService,    
    private _http: HttpService,
    @Inject(ActivatedRoute) private _route: ActivatedRoute,
    @Inject(Router) private _router: Router   
  ) {
    this.shop.reset();
    this.shop.basket.add(this.shop.item("0001"),1);
  }
    
  ngOnInit() {
     this._routeSubs = this._route.params.subscribe(async params => {
      if (params['orderNumber']) {
        // this.shop.reset();
        this.isEditMode = true;
        let order = await this._http.getOrderByOrderNumber(params['orderNumber']);
        this._orderNumber = params['orderNumber'];
        if (order?.isNoCharge) {
          this.shop.basket.isNoCharge = true;
        }
        if (order?.notes) {
          (<HTMLInputElement>document.getElementById("existing-notes")).value = order.notes;
        }
        
        this.shop.user.setDetails = order.user;
        // this.shop.basket.add(this.shop.item("0001"),order.items[0].quantity);
        this.shop.basket.updateQuantity("0001",order.items[0].quantity);
      }
    })
  }

  async onCancel() {
    this._router.navigateByUrl(`/orders`); 
  }

  async onSave() {
    try {
      let orderSummary: OrderSummary = this.shop.order.orderSummary;
      orderSummary.orderNumber = this._orderNumber;
      console.log(orderSummary);
      await this._http.upsertManualOrder(orderSummary);
    } catch (error) {
      console.error(error);
    }
    this._router.navigateByUrl(`/orders`); 
  }

  ngOnDestroy () {
    if (this._routeSubs) {
      this._routeSubs.unsubscribe();
    } 
  }

}