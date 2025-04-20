import { CurrencyPipe, NgClass } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { HttpService } from '@shared/services/http.service';
import { OrderStatus, OrderSummary } from '@shared/types';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [NgClass, FormsModule, CurrencyPipe],  
  providers: [], 
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})

export class OrdersComponent  {

  public includeManualOrders = true;
  public includeOnlineOrders = true;
  public includeTestOrders = false;
  public textSearch: string = '';

  // public emails: Array<string> = [];
  public orders: Array<OrderSummary> = [];
  
  constructor(
    private _http: HttpService,
  ) {}
    
  ngOnInit() {
    this.getOrders();
  }

  copyEmails() {
    let emails = this.orders.map(o=>o.user.email_address);
    navigator.clipboard.writeText(emails.join(";"))
  }

  onUpdateList() {
    this.getOrders();
  }

  async getOrders() {

    try {
      this.orders = await this._http.getOrders(this.includeOnlineOrders, this.includeManualOrders, this.includeTestOrders, this.textSearch)
    } catch (error) {
      console.error(error);
    }

    this.orders.sort((a, b) => {
      let x: number = new Date(a?.timeStamps?.orderCompleted ?? '').getTime();
      let y: number = new Date(b?.timeStamps?.orderCompleted ?? '').getTime();
      return y-x
    })

  }

  async onSetStatus(orderNumber: string | undefined, set: OrderStatus, unset?: OrderStatus) {
    try {
      await this._http.setTimestamp(orderNumber ?? '', set, unset);
      this.getOrders();
    } catch (error) {
      console.error(error);
    }
  }

}