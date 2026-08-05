import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef, OnInit, Inject, CSP_NONCE } from '@angular/core';
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
import { ScrollOffsetService } from '@shared/services/scroll-offset.service';
import { ShopOutOfOfficePublicSettings } from '@shared/types';


@Component({
  standalone: true,
  imports: [FormsModule, CurrencyPipe, CommonModule, OrderOutcomeComponent, CarouselComponent],
  selector: 'app-shop',
  templateUrl: './shop.component.html',
  styleUrls: ['./shop.component.css', '../home/home.component.css']
})

export class ShopComponent implements OnInit, AfterViewInit, OnDestroy {
  public qty: number = 0;
  public discountCodes: Array<{code: string, discount: number}> = discountCodes;
  public dirtyDiscountCode = false;
  public stage = stage;
  public showBasketPopover = false;
  public shopSettingsError = '';
  public checkoutNotice: ShopOutOfOfficePublicSettings = { active: false, message: '', endDate: null };
  public checkoutNoticeReady = false;
  private _summaryObserver?: IntersectionObserver;
  private _paypalInitialized = false;
  private _acknowledgedNotice = '';

  constructor(
    private _http: HttpService,
    private _cdr: ChangeDetectorRef,
    @Inject(ScrollOffsetService) private _scrollOffset: ScrollOffsetService,
    @Inject(CSP_NONCE) private _cspNonce: string | null,
    public shop: ShopService,
    public toaster: ToastService
  ) {}

  async ngOnInit() {
    this.shop.initializeDefaultBasket();
    await this.refreshShopSettings();
  }
  
  ngAfterViewInit() {
    // Only run PayPal on the browser (avoid SSR issues)
    if (typeof window === 'undefined') {
      return;
    }
    // PayPal is initialized lazily on first item added (see onPlusMinus)

    // Show floating basket popover when order summary is scrolled out of view
    const summaryEl = this._getOrderSummaryElement();
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
    const el = this._getOrderSummaryElement();
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - this._scrollOffset.getHeaderOffset(16);
    window.scrollTo({ top, behavior: 'smooth' });
  }

  private _getOrderSummaryElement(): HTMLElement | null {
    return document.getElementById('order-summary');
  }

  get checkoutWarningActive(): boolean {
    return this.checkoutNotice.active && this._acknowledgedNotice !== this._getNoticeFingerprint(this.checkoutNotice);
  }

  get checkoutBlocked(): boolean {
    return !this.checkoutNoticeReady || !!this.shopSettingsError || this.checkoutWarningActive;
  }

  private _canInitializePayPal(): boolean {
    return typeof window !== 'undefined'
      && this.shop.orderStatus === 'draft'
      && this.shop.basket.itemQty > 0
      && !this.checkoutBlocked;
  }

  private _maybeInitPayPal(): void {
    if (!this._canInitializePayPal() || this._paypalInitialized) {
      return;
    }

    this._paypalInitialized = true;
    this._cdr.detectChanges();
    void this._initPayPal();
  }

  private _getNoticeFingerprint(settings: ShopOutOfOfficePublicSettings): string {
    return `${settings.message}::${settings.endDate ?? ''}`;
  }

  private _applyShopSettings(settings: ShopOutOfOfficePublicSettings): void {
    this.checkoutNotice = settings.active ? settings : { active: false, message: '', endDate: null };
    if (!settings.active) {
      this._acknowledgedNotice = '';
    }
  }

  async refreshShopSettings(): Promise<void> {
    this.shopSettingsError = '';

    try {
      const settings = await this._http.getPublicShopSettings();
      this._applyShopSettings(settings);
      this.checkoutNoticeReady = true;
      this._maybeInitPayPal();
    } catch {
      this.checkoutNoticeReady = false;
      this.shopSettingsError = 'We could not confirm the current checkout notice. Please try again.';
    }

    this._cdr.detectChanges();
  }

  async acknowledgeOutOfOffice(): Promise<void> {
    await this.refreshShopSettings();
    if (this.shopSettingsError || !this.checkoutNotice.active) {
      return;
    }

    this._acknowledgedNotice = this._getNoticeFingerprint(this.checkoutNotice);
    this._maybeInitPayPal();
    this._cdr.detectChanges();
  }
  
  private async _initPayPal() {

    let paypal;
    
    try {
        paypal = await loadScript({
          clientId: environment.PAYPAL_CLIENT_ID,
          currency: 'GBP',
          environment: environment.STAGE === 'prod' ? 'production' : 'sandbox',
          dataCspNonce: this._cspNonce || undefined
        });
    } catch (error:any) {
      this.toaster.show('Could not load the PayPal payment form. Please refresh the page and try again.', 'error');
    }

    if (paypal?.Buttons !== undefined && paypal !== null) {

      try {
        const that = this;
        await paypal.Buttons({
          style: {
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

        // E2E test hook: lets sandbox nightly tests trigger capture without the PayPal popup.
        if (environment.STAGE !== 'prod') {
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
      // Lazy-init PayPal the first time an item is added once checkout is available.
      this._maybeInitPayPal();
    }
    // Re-evaluate popover visibility after qty change
    const summaryEl = this._getOrderSummaryElement();
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
