import { Component, Inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { OrderSummary } from '@shared/types';
import { ShopService, User } from '@shared/services/shop.service'
import { HttpService } from '@shared/services/http.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { switchMap, of } from 'rxjs';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [ FormsModule],  
  providers: [], 
  templateUrl: './manual-order.component.html',
  styleUrl: './manual-order.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
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
    @Inject(Router) private _router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.shop.reset();
    this.shop.basket.add(this.shop.item("0001"),this.selectedQty);
  }
    
  ngOnInit() {

    this._routeSubs = this._route.params
      .pipe(
        switchMap((params: { [key: string]: string }) => {
          if (params['orderNumber']) {
            this.isEditMode = true;
            return this._http.getOrderByOrderNumber(params['orderNumber']);
          }
          return of(null);
        })
      )
      .subscribe((order: OrderSummary | null) => {
        if (order) {
          this._orderNumber = order.orderNumber ?? '';
          this.shop.basket.orderType = order.orderType ?? this.shop.basket.orderType;
          if (order.notes) {
            (<HTMLInputElement>document.getElementById("existing-notes")).value = order.notes;
          }
          this.shop.user.setDetails = order.user;
          this.cdr.markForCheck();
        }
      });
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
    try {
      const order = await this._http.getOrderByOrderNumber(this.selectedOrderNumber);
      this.shop.user.setDetails = order.user;
      this.cdr.markForCheck();
    } catch (error) {
      console.error(error);
    }
  }

  async fillDropdown() {
    try {
      const os = await this._http.getOrders(true, true, false, 'completed', '') as Array<OrderSummary>;
      this.orders = os.filter((o: OrderSummary) => !!o.orderNumber);
      this.cdr.markForCheck();
    } catch (error) {
      console.error(error);
    }
  }



  ngOnDestroy () {
    if (this._routeSubs) {
      this._routeSubs.unsubscribe();
    } 
  }

}