import { Component } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Shop, PaypalOrder } from '@shared/services/shop.service'
import { FormsModule } from "@angular/forms";
import { loadScript } from "@paypal/paypal-js";
import { environment } from '@environments/environment';
import { HttpService } from '@shared/services/http.service';
// import { PaypalOrder } from '@shared/types'




@Component({
  standalone: true,
  imports: [FormsModule, CurrencyPipe, CommonModule],
  selector: 'app-basket',
  templateUrl: './basket.component.html',
  styleUrls: ['./basket.component.css']
})



export class BasketComponent {
  
  // public payPalConfig ? : IPayPalConfig;
  public shop: Shop;
  public qty: number = 0;
  constructor(
    private _http: HttpService
  ) {
    this.shop = new Shop();
    console.log(this.shop.basket.add(this.shop.items[0],2))
    console.log(this.shop.basket.add(this.shop.items[1],2))
  }

  async ngOnInit() {

    let paypal;

    try {
        paypal = await loadScript({ 
          clientId: environment.PAYPAL_CLIENT_ID,
          currency: 'GBP'
        });
    } catch (error) {
        console.error("failed to load the PayPal JS SDK script", error);
    }

    if (paypal?.Buttons !== undefined && paypal !== null) {
      try {
        const that = this;
        await paypal.Buttons({
          async createOrder() {
            let order = that.shop.createOrder();
            console.log(order)
            return await that.waitForOrderNumber(order)
          }
        },
      ).render("#paypal-button-container");
        } catch (error) {
            console.error("failed to render the PayPal Buttons", error);
        }
    }
  }

  waitForOrderNumber(order: PaypalOrder) {
    return new Promise<string>((res, rej) => {
      this._http.createPaypalOrder(order).subscribe({
        next: (response) => {
          console.log(response)
          res(response.id);
        },
        error: (error) => {
          console.log(error);
          rej();
        }
      }) 
    })
      
  }

  onPlusMinus(inc: number, lineNo: number) {
    let min = 0;
    let max = 9;
    let qty = this.shop.basket.basketItems[lineNo].quantity;
    this.shop.basket.basketItems[lineNo].quantity = Math.min(max,Math.max(min,qty+inc))
  }
}
