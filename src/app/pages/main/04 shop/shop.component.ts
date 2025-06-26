import { Component } from '@angular/core';
import { CommonModule, CurrencyPipe} from '@angular/common';
import { ShopService } from '@shared/services/shop.service'
import { FormsModule } from "@angular/forms";
import { loadScript } from "@paypal/paypal-js";
import { environment } from '@environments/environment';
import { HttpService } from '@shared/services/http.service';
// import { ErrorService } from '@shared/services/error.service';
import { OrderOutcomeComponent } from './order-outcome/order-outcome.component';
import { CarouselComponent } from '@shared/components/carousel/carousel.component';
import { ToastService } from '@shared/services/toast.service';
import { discountCodes } from '@shared/globals';
import { stage } from '@shared/globals';


@Component({
  standalone: true,
  imports: [FormsModule, CurrencyPipe, CommonModule, OrderOutcomeComponent, CarouselComponent],
  selector: 'app-shop',
  templateUrl: './shop.component.html',
  styleUrls: ['./shop.component.css', '../main.component.css']
})

export class ShopComponent {

  public qty: number = 0;
  public discountCodes: Array<{code: string, discount: number}> = discountCodes;
  public dirtyDiscountCode = false;
  public stage = stage;
  // public testimages = [{
  //   src: 'assets/photos/shop/Snorkelology Logo Sticker v2.png',
  //   alt: 'Image showing Snorkelology Logo sticker design'
  // },{
  //   src: 'assets/photos/content/snorkelling-britain-100-marine-adventures-book-cover-3d.jpg',
  //   alt: 'Snorkelling Britain book cover in 3D '
  // }]

  constructor(
    private _http: HttpService,
    public shop: ShopService,
    public toaster: ToastService,
  ) {
    this.shop.reset();
    this.shop.basket.add(this.shop.item("0001"),1);
    this.shop.basket.add(this.shop.item("0002"),0);
    this.shop.basket.add(this.shop.item("0003"),0);
    this.shop.basket.add(this.shop.item("0004"),0);
  }
  
  async ngOnInit() {

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
          style: {
            // borderRadius: 0,
            shape: 'sharp',
            height: 50
          },
          async createOrder() {
            if(that.shop.basket.totalCost===0) {
              that.toaster.show("Nothing in basket", "warning");
              return;
            }
            let res = await that._http.createPaypalOrder(that.shop.orderNumber ?? null, that.shop.order);
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
              that.shop.basket.selectedShippingService = data.selectedShippingOption?.id;
              await that._http.patchPaypalOrder(
                that.shop.orderNumber ?? '',
                data.orderID,
                "/purchase_units/@reference_id=='default'",
                that.shop.order.paypal.intent.purchase_units[0]
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
    this.shop.basket.incrementQty(id, increment);
  }

  onCodeChange() {
    this.dirtyDiscountCode = true;
    const uec = this.shop.basket.discountCode.toLowerCase();
    for (const dc of this.discountCodes) {
      if (dc.code === uec) {
        this.shop.basket.discountPercent = dc.discount;
        break;
      } else {
        this.shop.basket.discountPercent = 0;
      }
    };
  }
}
