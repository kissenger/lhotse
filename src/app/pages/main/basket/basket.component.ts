import { Component } from '@angular/core';
import { CommonModule, CurrencyPipe, NgOptimizedImage} from '@angular/common';
import { ShopService } from '@shared/services/shop.service'
import { FormsModule } from "@angular/forms";
import { loadScript } from "@paypal/paypal-js";
import { environment } from '@environments/environment';
import { HttpService } from '@shared/services/http.service';
import { Router } from '@angular/router';
import { OrderOutcomeComponent } from './order-outcome/order-outcome.component';
import { ScreenService } from '@shared/services/screen.service';

@Component({
  standalone: true,
  imports: [FormsModule, CurrencyPipe, CommonModule, OrderOutcomeComponent, NgOptimizedImage],
  // providers: [Shop],
  selector: 'app-basket',
  templateUrl: './basket.component.html',
  styleUrls: ['./basket.component.css', '../main.component.css']
})

export class BasketComponent {

  public qty: number = 0;
  public discountCodes: Array<{code: string, discount: number}> = [
    {code: "iheartsnorkelling", discount: 25}
  ];
  public userEnteredCode: string = "";
  public discount: number = 0;

  constructor(
    private _http: HttpService,
    private _router: Router,
    public shop: ShopService,
    private _screen: ScreenService,
    
  ) {
    try {
      this.shop.basket.add(this.shop.item("0001"),1);
      // this.shop.basket.add(this.shop.item("0002"),2);
    } catch (err) {
      console.log(err);
      // this._router.navigateByUrl(`/shop/order_outcome`);
    }
  }

  ngAfterViewInit() {
    
    // this.widthDescriptor = this._screen.widthDescriptor;
    // this._screen.resize.subscribe( (hasOrientationChanged) => {
    //   this.widthDescriptor = this._screen.widthDescriptor;
    //   if (hasOrientationChanged) {
    //     this.loadBackgroundImages();
    //   }
    // });
    
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
            let order = that.shop.newOrder;
            console.log(order.intent)
            let res = await that._http.createPaypalOrder(order.intent);
            if (res.error) {
              console.error(res);
              return false;
            } else {
              order.orderNumber = res.id;
              return res.id;
            }

          },

          async onApprove(data, actions) {
            let res = await that._http.capturePaypalPayment(data.orderID);
            if (res.error) {
              console.error(res);
              if (res.error === 'INSTRUMENT_DECLINED') {
                return actions.restart();
              } else {
                return;
              }
            } else {
              that.shop.order?.createApproved(res);
              return;                
            }  
          },

          async onShippingAddressChange(data, actions) {
            // console.log(data.shippingAddress.countryCode)
            if (data.shippingAddress.countryCode !== "GB") {
              // @ts-expect-error
              return actions.reject(data.errors.COUNTRY_ERROR);
            }
          },

          async onShippingOptionsChange(data, actions) {
            // console.log(data);
            if (data.selectedShippingOption?.id) {
              that.shop.basket.shippingOption = data.selectedShippingOption.id;
            }
            if (data.selectedShippingOption?.type === 'PICKUP') {
                return actions.reject();
            }
          }

        }).render("#paypal-button-container");

      } catch (error) {
          console.error("failed to render the PayPal Buttons", error);
      }
    }
  }

  onPlusMinus(id: string, increment: number) {
    const min = 0;
    const max = 9;
    const qty = this.shop.basket.getQuantity(id);
    if (this.shop.basket.totalQty+increment <= max) {
      const newQty = Math.min(max,Math.max(min,qty+increment))
      this.shop.basket.updateQuantity(id, newQty)
    }
  }

  onCodeChange(){
    this.discountCodes.forEach(dc => {
      // console.log(this.userEnteredCode)
      // console.log(dc.code)
      if (dc.code === this.userEnteredCode) {
        this.shop.basket.discount = dc.discount;
        this.discount = dc.discount;
      } else {
        this.shop.basket.discount = 0;
      }
      // console.log(this.shop.basket.appliedDiscount)
    })

  }
}
