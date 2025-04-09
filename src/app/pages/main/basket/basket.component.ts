import { Component } from '@angular/core';
import { CommonModule, CurrencyPipe, NgOptimizedImage} from '@angular/common';
import { ShopService } from '@shared/services/shop.service'
import { FormsModule } from "@angular/forms";
import { loadScript } from "@paypal/paypal-js";
import { environment } from '@environments/environment';
import { HttpService } from '@shared/services/http.service';
import { OrderOutcomeComponent } from './order-outcome/order-outcome.component';
import { ToastService } from '@shared/services/toast.service';

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
  // public discount: number = 0;

  constructor(
    private _http: HttpService,
    public shop: ShopService,
    private toaster: ToastService
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
    this.shop.basket.discount = 0;
    let paypal;

    try {
        paypal = await loadScript({ 
          clientId: environment.PAYPAL_CLIENT_ID,
          currency: 'GBP'
        });
    } catch (error) {
        console.error('Failed to load the PayPal JS SDK script', error);
    }

    if (paypal?.Buttons !== undefined && paypal !== null) {
      try {

        const that = this;
        await paypal.Buttons({
          
          async createOrder() {
            let res = await that._http.createPaypalOrder(that.shop.orderIntent);
            if (res.paypalOrderId) {
              that.shop.orderNumber = res.orderNumber;
              return res.paypalOrderId;
            } else {
              console.error(res.error);
              that.toaster.show(res.error ?? 'null', 'error');
              return;
            }
          },

          async onApprove(data, actions) {
            let res = await that._http.capturePaypalPayment(that.shop.orderNumber ?? '', data.orderID);
            if (res.error) {
              console.error(res);
              that.shop.orderStatus = "error";
              if (res.error === 'INSTRUMENT_DECLINED') {
                that.toaster.show('PayPal payment was declined, please try again', 'warning');
                return actions.restart();
              } else {
                that.toaster.show(res.error, 'error');
                return;
              }
            } else {
              that.shop.orderStatus = 'complete';
              return;                
            }  
          },

          async onShippingAddressChange(data, actions) {
            if (data.shippingAddress.countryCode !== "GB") {
              that.toaster.show("Sorry, we are not currently shipping outside the UK", "warning");
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

      } catch (error: any) {
        
          this.toaster.show(error.message, "error");

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

  onCodeChange() {
    this.discountCodes.forEach(dc => {
      if (dc.code === this.userEnteredCode) {
        this.shop.basket.discount = dc.discount;
      } else {
        this.shop.basket.discount = 0;
      }
    })
    console.log(this.shop.basket.discount)

  }
}
