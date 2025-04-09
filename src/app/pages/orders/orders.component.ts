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

  public orders: Array<OrderSummary> = [];
  
  constructor(
    private _http: HttpService,
  ) {}
    
  ngOnInit() {
    this.getOrders();
  }

  onUpdateList() {
    this.getOrders();
  }

  async getOrders() {

    try {
      this.orders = await this._http.getOrders()
    } catch (error) {
      console.error(error);
    }

    this.orders.sort((a, b) => {
      let x: number = new Date(a?.timeStamps?.orderCompleted ?? '').getTime();
      let y: number = new Date(b?.timeStamps?.orderCompleted ?? '').getTime();
      return y-x
    })

  }

  async onSetStatus(orderNumber: string | undefined, newStatus: OrderStatus) {
    try {
      await this._http.setTimestamp(orderNumber ?? '', newStatus);
      this.getOrders();
    } catch (error) {
      console.error(error);
    }
  }

}