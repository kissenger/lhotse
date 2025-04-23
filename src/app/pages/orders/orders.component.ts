import { CurrencyPipe, NgClass } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { HttpService } from '@shared/services/http.service';
import { OrderItems, OrderStatus, OrderSummary } from '@shared/types';
import { Router, RouterLink } from '@angular/router';


@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [NgClass, FormsModule, CurrencyPipe, RouterLink],  
  providers: [], 
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})

export class OrdersComponent  {

  public filterManual = true;
  public filterOnline = true;
  public filterTest = false;
  public filterWithAction = true;
  public filterNoAction = true;
  public filterWithError = false;  
  public textSearch: string = '';
  public numberOfCopies: number = 0;
  public orderValue: string = '';

  // public emails: Array<string> = [];
  public orders: Array<OrderSummary> = [];
  
  constructor(
    private _http: HttpService,    
    @Inject(Router) private _router: Router
    
  ) {}
    
  ngOnInit() {
    this.getOrders();
  }

  copyEmails() {
    let emails = this.orders.map(o=>o.user.email_address);
    navigator.clipboard.writeText(emails.join(";"))
  }

  copyAddresses() {
    let addresses = this.orders.map(o=> {
        return o.items[0].quantity+"x copies"+"\n"+
        o.user.name+"\n"+
        o.user.address.address_line_1+"\n"+
        o.user.address.admin_area_2+"\n"+
        o.user.address.admin_area_1+"\n"+
        o.user.address.postal_code+"\n"
      }
    );
    navigator.clipboard.writeText(addresses.join("\n"))
  }

  newOrder() {
    this._router.navigateByUrl(`/orders/manual/`); 
  }
  async onDeactivate(orderNumber: string) {
    let respose = await this._http.deactivateOrder(orderNumber); 
    this.getOrders();
  }
  onUpdateList() {
    this.getOrders();
  }

  async getOrders() {

    try {
      this.orders = await this._http.getOrders(this.filterOnline, this.filterManual, this.filterTest, this.filterWithAction, this.filterNoAction, this.filterWithError, this.textSearch)
    } catch (error) {
      console.error(error);
    }

    this.orders.sort((a, b) => {
      let x: number = new Date(a?.timeStamps?.orderCompleted ?? '').getTime();
      let y: number = new Date(b?.timeStamps?.orderCompleted ?? '').getTime();
      return y-x
    })

    this.numberOfCopies = this.orders.map(o=>o.items[0].quantity).reduce((a,b)=> a+b,0);
    this.orderValue = this.orders.map(o=>o.items[0].quantity*o.items[0].unit_amount.value).reduce((a,b)=> a+b,0).toFixed(2);
  }

  async onSetStatus(orderNumber: string | undefined, set: OrderStatus, unset?: OrderStatus) {
    try {
      await this._http.setTimestamp(orderNumber ?? '', set, unset);
      this.getOrders();
    } catch (error) {
      console.error(error);
    }
  }

  async onSendEmail(orderNumber?: string) {
    try {
      await this._http.sendPostedEmail(orderNumber);
      this.getOrders();
    } catch (error) {
      console.error(error);
    }
  }

}