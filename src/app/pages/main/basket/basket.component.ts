import { Component } from '@angular/core';
import { CommonModule, CurrencyPipe, NgOptimizedImage} from '@angular/common';
import { ShopService } from '@shared/services/shop.service'
import { FormsModule } from "@angular/forms";
import { loadScript } from "@paypal/paypal-js";
import { environment } from '@environments/environment';
import { HttpService } from '@shared/services/http.service';
import { OrderOutcomeComponent } from './order-outcome/order-outcome.component';

@Component({
  standalone: true,
  imports: [FormsModule, CurrencyPipe, CommonModule, OrderOutcomeComponent, NgOptimizedImage],
  selector: 'app-basket',
  templateUrl: './basket.component.html',
  styleUrls: ['./basket.component.css', '../main.component.css']
})

export class BasketComponent {

  public qty: number = 0;
  public discountCodes: Array<{code: string, discount: number}> = [
    {code: "snorkelpromo", discount: 25}
  ];
  public userEnteredCode: string = "";
  public discount: number = 0;

  constructor(
    private _http: HttpService,
    public shop: ShopService,
    
  ) {
    try {
      this.shop.basket.add(this.shop.item("0001"),1);
    } catch (err) {
      console.log(err);
    }
  }

  ngAfterViewInit() {
    
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
            let res = await that._http.createPaypalOrder(that.shop.orderIntent);
            if (res.error) {
              console.error(res);
              return;
            } else {
              that.shop.orderNumber = res.orderNumber;
              return res.paypalOrderId;
            }

          },

          async onApprove(data, actions) {
            let res = await that._http.capturePaypalPayment(that.shop.orderNumber ?? '', data.orderID);
            if (res.error) {
              console.error(res);
              that.shop.orderStatus = "error";
              if (res.error === 'INSTRUMENT_DECLINED') {
                return actions.restart();
              } else {
                return;
              }
            } else {
              that.shop.orderStatus = "complete";
              return;                
            }  
          },

          async onShippingAddressChange(data, actions) {
            if (data.shippingAddress.countryCode !== "GB") {
              // @ts-expect-error
              return actions.reject(data.errors.COUNTRY_ERROR);
            }
          },

          async onShippingOptionsChange(data, actions) {
            if (data.selectedShippingOption?.id && data.orderID) {
              that.shop.basket.shippingOption = data.selectedShippingOption?.id;
            
              let res=await that._http.patchPaypalOrder(
                that.shop.orderNumber ?? '',
                data.orderID,
                "/purchase_units/@reference_id=='default'",  
                that.shop.orderIntent.purchase_units[0]
              )
            }
            return 
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
      if (dc.code === this.userEnteredCode) {
        this.shop.basket.discount = dc.discount;
        this.discount = dc.discount;
      } else {
        this.shop.basket.discount = 0;
      }
    })

  }
}
