import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe} from '@angular/common';
import { ShopService } from '@shared/services/shop.service'
import { FormsModule } from "@angular/forms";
import { loadScript } from "@paypal/paypal-js";
import { environment } from '@environments/environment';
import { HttpService } from '@shared/services/http.service';
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
  styleUrls: ['./shop.component.css', '../home.component.css']
})

export class ShopComponent implements AfterViewInit, OnDestroy {
  public qty: number = 0;
  public discountCodes: Array<{code: string, discount: number}> = discountCodes;
  public dirtyDiscountCode = false;
  public stage = stage;
  public showBasketPopover = false;
  private _summaryObserver?: IntersectionObserver;
  private _paypalInitialized = false;

  constructor(
    private _http: HttpService,
    private _cdr: ChangeDetectorRef,
    public shop: ShopService,
    public toaster: ToastService
  ) {
    this.shop.reset();
    this.shop.basket.add(this.shop.item("0001"),0);
    this.shop.basket.add(this.shop.item("0002"),0);
    this.shop.basket.add(this.shop.item("0003"),0);
    this.shop.basket.add(this.shop.item("0004"),0);
  }
  
  ngAfterViewInit() {
    // Only run PayPal on the browser (avoid SSR issues)
    if (typeof window === 'undefined') {
      return;
    }
    // PayPal is initialized lazily on first item added (see onPlusMinus)

    // Show floating basket popover when order summary is scrolled out of view
    const summaryEl = document.getElementById('order-summary');
    if (summaryEl) {
      this._summaryObserver = new IntersectionObserver(([entry]) => {
        this.showBasketPopover = !entry.isIntersecting && this.shop.basket.itemQty > 0;
        this._cdr.detectChanges();
      }, { threshold: 0 });
      this._summaryObserver.observe(summaryEl);
    }
  }

  ngOnDestroy() {
    this._summaryObserver?.disconnect();
  }

  scrollToSummary() {
    const el = document.getElementById('order-summary');
    if (!el) return;
    const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 75;
    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  }
  
  private async _initPayPal() {

    let paypal;
    
    try {
        paypal = await loadScript({
          clientId: environment.PAYPAL_CLIENT_ID,
          currency: 'GBP'
        });
    } catch (error:any) {
      this.toaster.show('Could not load the PayPal payment form. Please refresh the page and try again.', 'error');
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
            try {
              let res = await that._http.createPaypalOrder(that.shop.orderNumber ?? null, that.shop.order);
              that.shop.orderNumber = res.orderNumber;
              return res.paypalOrderId;
            } catch (err: any) {
              that.toaster.show('We could not start your order. Please try again.', 'error');
              throw err;
            }
          },

          async onApprove(data, actions) {
            try {
              let res = await that._http.capturePaypalPayment(that.shop.orderNumber ?? '', data.orderID);
              that.shop.payerEmail = res.payer?.email_address;
              that.shop.orderStatus = "complete";
              that._cdr.detectChanges();
              that.toaster.show('Payment successful, thank you for your order.', 'success');
              return;
            } catch (err: any) {
              console.error(err);
              const issue = err?.error?.error || err?.error?.details?.[0]?.issue;
              if (issue === 'INSTRUMENT_DECLINED') {
                that.toaster.show('Your payment was declined by PayPal — please try a different card or payment method.', 'warning');
                return actions.restart();
              } else if (issue === 'COUNTRY_NOT_SUPPORTED') {
                that.shop.orderStatus = "error";
                that._cdr.detectChanges();
                that.toaster.show('Sorry, we only ship within the UK. Please place a new order with a UK delivery address.', 'warning');
                return;
              }
              that.shop.orderStatus = "error";
              that._cdr.detectChanges();
              that.toaster.show('Your payment could not be completed.', 'error');
            }
          },

          async onShippingAddressChange(data, actions) {
            if (data.shippingAddress.countryCode !== "GB") {
              that.toaster.show('Sorry, we currently only ship within the UK. Please update your delivery address.', 'warning');
              // @ts-expect-error
              return actions.reject(data.errors.COUNTRY_ERROR);
            }
          },

          async onShippingOptionsChange(data, _actions) {
            if (data.selectedShippingOption?.id && data.orderID) {
              that.shop.basket.selectedShippingService = data.selectedShippingOption?.id;
              try {
                await that._http.patchPaypalOrder(
                  that.shop.orderNumber ?? '',
                  data.orderID,
                  "/purchase_units/@reference_id=='default'",
                  that.shop.order.paypal.intent.purchase_units[0]
                )
              } catch (err: any) {
                that.toaster.show('Could not update the shipping option. Please try selecting it again.', 'error');
              }
            }
            return
          }

        }).render("#paypal-button-container");

        // E2E test hook: lets sandbox nightly tests trigger capture without the PayPal browser popup.
        // Only installed in non-production builds so it is never present in live deployments.
            if (environment.STAGE !== 'prod' && typeof window !== 'undefined') {
          (window as any).__e2ePaypalApprove = async (orderID: string, orderNum: string) => {
            try {
              if (orderNum) { that.shop.orderNumber = orderNum; }
              const res = await that._http.capturePaypalPayment(that.shop.orderNumber ?? '', orderID);
              if (!res.error) {
                that.shop.orderStatus = 'complete';
                that.toaster.show('Payment successful, thank you for your order.', 'success');
                that._cdr.detectChanges();
              }
              return res;
            } catch (err: any) {
              return { error: err?.message || String(err) };
            }
          };
        }

      } catch (error:any) {
        this.toaster.show('The payment form could not be loaded. Please refresh the page and try again.', 'error');
      }
    }
  }

  readonly bookIds = ['0001', '0002'];

  get bookQty(): number {
    return this.shop.basket.items
      .filter(i => this.bookIds.includes(i.id))
      .reduce((sum, i) => sum + i.quantity, 0);
  }

  onPlusMinus(id: string, increment: number) {
    if (increment > 0 && this.bookIds.includes(id) && this.bookQty >= 4) return;
    this.shop.basket.incrementQty(id, increment);
    if (this.shop.basket.itemQty === 0) {
      // Basket emptied — reset so PayPal re-inits next time an item is added
      this._paypalInitialized = false;
    } else if (!this._paypalInitialized) {
      // Lazy-init PayPal the first time an item is added (container now in DOM)
      this._paypalInitialized = true;
      this._cdr.detectChanges();
      this._initPayPal();
    }
    // Re-evaluate popover visibility after qty change
    const summaryEl = document.getElementById('order-summary');
    if (summaryEl) {
      const rect = summaryEl.getBoundingClientRect();
      this.showBasketPopover = (rect.bottom < 0 || rect.top > window.innerHeight) && this.shop.basket.itemQty > 0;
    }
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
