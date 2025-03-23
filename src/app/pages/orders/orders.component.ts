import { NgClass } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { HttpService } from '@shared/services/http.service';
import { Subscription } from 'rxjs';
import { OrderStatus } from '@shared/types';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [NgClass, FormsModule],  
  providers: [], 
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})

export class OrdersComponent  {

  public orders?: any;
  private _httpSubs: Subscription | undefined;
  
  constructor(
    private _http: HttpService,
  ) {}
    
  async ngOnInit() {
    this.getOrders();
  }

  getOrders() {
    this._httpSubs = this._http.getOrders()
      .subscribe({
        next: (result) => {
          console.log(result)
          this.orders = result;
        },
        error: (error) => {
          console.log(error);
          // this._window!.alert(`Something didn't work, with error message: \n${error.error.message}`);          
        }
      }) 
  }

  onUpdateList() {
    this.getOrders();
  }

  onSetStatus(orderNumber: string, newStatus: OrderStatus) {
    // console.log(orderNumber)
    this._httpSubs = this._http.setTimestamp(orderNumber, newStatus)
      .subscribe({
        next: (result) => {
          this.getOrders();
          console.log(result);
        },
        error: (error) => {
          console.log(error);
        }
      });
  }

}