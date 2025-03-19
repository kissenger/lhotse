import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router'
import { OrderDetails, ShopService } from '@shared/services/shop.service';
import { Subscription } from 'rxjs';
import { HttpService } from '@shared/services/http.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-order-outcome',
  templateUrl: './order-outcome.component.html',
  styleUrls: ['./order-outcome.component.css']
})

export class OrderOutcomeComponent implements OnInit {
  
  public paymentOutcome: string = '';
  public orderDetails?: OrderDetails;

  constructor(
    private _http: HttpService,
    public shop: ShopService,
  ) {}

  async ngOnInit() {
    this.orderDetails = await this._http.getOrderDetails(this.shop.orderNumber);
    console.log(this.orderDetails);
  }

}
