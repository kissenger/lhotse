import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShopService } from '@shared/services/shop.service';
import { HttpService } from '@shared/services/http.service';
import { OrderSummary } from '@shared/types';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-order-outcome',
  templateUrl: './order-outcome.component.html',
  styleUrls: ['./order-outcome.component.css']
})

export class OrderOutcomeComponent implements OnInit {
  
  public paymentOutcome: string = '';
  public orderDetails?: OrderSummary;

  constructor(
    private _http: HttpService,
    public shop: ShopService,
  ) {}

  async ngOnInit() {
    try {
      this.orderDetails = await this._http.getOrderByOrderNumber(this.shop.orderNumber);
    } catch (error) {
      console.error(error);
    }
  }

}
