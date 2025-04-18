import { Component, Inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DOCUMENT, NgOptimizedImage} from '@angular/common';
import { ShopService } from '@shared/services/shop.service'
import { FormsModule } from "@angular/forms";
import { loadScript } from "@paypal/paypal-js";
import { environment } from '@environments/environment';
import { HttpService } from '@shared/services/http.service';
// import { ErrorService } from '@shared/services/error.service';
import { OrderOutcomeComponent } from './order-outcome/order-outcome.component';
import { ToastService } from '@shared/services/toast.service';
import * as fromFile from "@assets/discount-codes.json"

@Component({
  standalone: true,
  imports: [FormsModule, CurrencyPipe, CommonModule, OrderOutcomeComponent, NgOptimizedImage],
  selector: 'app-basket',
  templateUrl: './basket.component.html',
  styleUrls: ['./basket.component.css', '../main.component.css']
})

export class BasketComponent {

  public qty: number = 0;
  public discountCodes: Array<{code: string, discount: number}> = fromFile.discountCodes;
  public userEnteredCode: string = "";
  public dirtyDiscountCode = false;

  constructor(
    private _http: HttpService,
    public shop: ShopService,
    public toaster: ToastService,
  ) {
    this.shop.basket.add(this.shop.item("0001"),1);
    console.log(this.discountCodes)
  }
  
  async ngOnInit() {

    this.shop.basket.discount = 0;
    let paypal;
    
    try {
        paypal = await loadScript({
          clientId: environment.PAYPAL_CLIENT_ID,
          currency: 'GBP'
        });
    } catch (error:any) {
      this.toaster.show(error, 'warning');
    }

    if (paypal?.Buttons !== undefined && paypal !== null) {

      try {
        const that = this;
        await paypal.Buttons({


          async createOrder() {
            let res = await that._http.createPaypalOrder(that.shop.orderNumber ?? null, that.shop.orderIntent);
            that.shop.orderNumber = res.orderNumber;
            return res.paypalOrderId;              
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
              that.shop.orderStatus = "complete";
              that.toaster.show('Payment successful, thank you for your order.', 'success');
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

              await that._http.patchPaypalOrder(
                that.shop.orderNumber ?? '',
                data.orderID,
                "/purchase_units/@reference_id=='default'",
                that.shop.orderIntent.purchase_units[0]
              )
            }
            return
          }

        }).render("#paypal-button-container");

      } catch (error:any) {
        this.toaster.show(error, "error");
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
    this.dirtyDiscountCode = true;
    const uec = this.userEnteredCode.toLowerCase();
    for (const dc of this.discountCodes) {
      if (dc.code === uec) {
        this.shop.basket.discount = dc.discount;
        break;
      } else {
        this.shop.basket.discount = 0;
      }
    };
  }
}
