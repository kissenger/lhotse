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
  public orders: Array<OrderSummary> = [];
  public selectedOrderNumber: string = '';
  public selectedQty: number = 1;

  constructor(
    public shop: ShopService,    
    private _http: HttpService,
    @Inject(ActivatedRoute) private _route: ActivatedRoute,
    @Inject(Router) private _router: Router   
  ) {
    this.shop.reset();
    this.shop.basket.add(this.shop.item("0001"),this.selectedQty);
  }
    
  ngOnInit() {

    this._routeSubs = this._route.params.subscribe(async params => {
      if (params['orderNumber']) {
        // this.shop.reset();
        this.isEditMode = true;
        let order = await this._http.getOrderByOrderNumber(params['orderNumber']);
        this._orderNumber = params['orderNumber'];
        this.shop.basket.orderType = order.orderType;
        if (order?.notes) {
          (<HTMLInputElement>document.getElementById("existing-notes")).value = order.notes;
        }
        this.shop.user.setDetails = order.user;
        // this.shop.basket.updateQuantity("0001",order.items[0].quantity);
      }
    })
  }

  async onCancel() {
    this._router.navigateByUrl(`/admin/orders`); 
  }

  onQuantityChange() {
    this.shop.basket.setQty("0001",this.selectedQty)
  }

  async onSave() {
    try {
      let orderSummary: OrderSummary = this.shop.order.orderSummary;
      orderSummary.orderNumber = this._orderNumber;
      await this._http.upsertManualOrder(orderSummary);
    } catch (error) {
      console.error(error);
    }
    this._router.navigateByUrl(`/admin/orders`); 
  }

  async onSelectionChange() {
    let order = await this._http.getOrderByOrderNumber(this.selectedOrderNumber);
    this.shop.user.setDetails = order.user;
  }

  async fillDropdown() {

    // let orders: Array<OrderSummary> = [];
    try {
      let os = await this._http.getOrders(true, true, false, 'completed', '')
      this.orders = os.filter( (o:any) => !!o.orderNumber);
    } catch (error) {
      document.body.style.cursor = 'auto';
      console.error(error);
    }

    //Set filters duplicates
    // this.prefillDropdownList = [...new Set(
    //   orders
    //     .map( o => `${o.user.name}, ${o.user.address.address_line_1}, ${o.user.address.postal_code}`)
    //     .sort()
    //   )];


  }



  ngOnDestroy () {
    if (this._routeSubs) {
      this._routeSubs.unsubscribe();
    } 
  }

}