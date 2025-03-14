import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router'
import { ShopService } from '@shared/services/shop.service';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule],
  // providers: [Shop],
  selector: 'app-order-outcome',
  templateUrl: './order-outcome.component.html',
  styleUrls: ['./order-outcome.component.css']
})

export class OrderOutcomeComponent implements OnInit {
  
  public paymentOutcome: string = '';
  private _routeSubs: Subscription | undefined;  

  constructor(
    private _route: ActivatedRoute,
    public shop: ShopService
  ) {}

  ngOnInit() {
    this._routeSubs = this._route.params.subscribe(params => {
      this.paymentOutcome = params['outcome'];
      // this.errorDetails = this.shop.order?.error;
      // this.orderNumber = this.shop.order?.orderNumber;
      // console.log(params);
      // console.log(this.shop.order?.error)
    })
  }

}
