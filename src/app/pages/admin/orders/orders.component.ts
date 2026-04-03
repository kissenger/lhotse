import { CurrencyPipe, NgClass } from '@angular/common';
import { Component, Inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ExportFileService } from '@shared/services/export.service';
import { HttpService } from '@shared/services/http.service';
import { OrderStatus, OrderSummary } from '@shared/types';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [NgClass, FormsModule, CurrencyPipe, RouterLink],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersComponent {
  public filterManual = true;
  public filterOnline = true;
  public filterTest = false;
  public textSearch = '';
  public filterStatus = '';
  public numberOfCopies = 0;
  public orderValue = '';
  public orders: Array<OrderSummary> = [];
  public timeStamps: Array<object> = [];

  constructor(
    private _http: HttpService,
    private _exportCSV: ExportFileService,
    @Inject(Router) private _router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.getOrders();
  }

  copyEmails() {
    const emails = this.orders.map((o) => o.user.email_address);
    navigator.clipboard.writeText(emails.join(';'));
  }

  newOrder() {
    this._router.navigateByUrl('/orders/manual/');
  }

  async onDeactivate(orderNumber: string) {
    const originalOrders = [...this.orders];
    this.orders = this.orders.filter((o) => o.orderNumber !== orderNumber);
    try {
      await this._http.deactivateOrder(orderNumber);
    } catch (error) {
      this.orders = originalOrders;
      console.error(error);
    }
  }

  onUpdateList() {
    this.getOrders();
  }

  exportCSV() {
    this._exportCSV.createCSV(this.orders);
  }

  async getOrders() {
    document.body.style.cursor = 'wait';
    try {
      const os = (await this._http.getOrders(
        this.filterOnline,
        this.filterManual,
        this.filterTest,
        this.filterStatus,
        this.textSearch
      )) as Array<OrderSummary>;
      this.orders = os.filter((o: OrderSummary) => !!o.orderNumber);
      this.cdr.markForCheck();
    } catch (error) {
      console.error(error);
    } finally {
      document.body.style.cursor = 'auto';
    }

    this.orders
      .sort((a, b) => {
        const x = new Date(a?.timeStamps?.orderCompleted ?? '').getTime();
        const y = new Date(b?.timeStamps?.orderCompleted ?? '').getTime();
        return y - x;
      })
      .sort((a, b) => Number(b.isAction) - Number(a.isAction));

    this.numberOfCopies = this.orders.reduce(
      (acc, cv) =>
        cv.items.reduce((a, c) => {
          if (c.id === '0001' || c.id === '0002') {
            return a + c.quantity;
          }
          return a;
        }, 0) + acc,
      0
    );
    this.cdr.markForCheck();
  }

  async onSetStatus(orderNumber: string | undefined, set: string) {
    const order = this.orders.find((o) => o.orderNumber === orderNumber);
    const originalTimestamps = order?.timeStamps ? { ...order.timeStamps } : undefined;
    if (order) {
      order.timeStamps = { ...order.timeStamps, [set]: new Date().toISOString() };
    }
    try {
      await this._http.setTimestamp(orderNumber ?? '', set as OrderStatus);
    } catch (error) {
      if (order && originalTimestamps !== undefined) {
        order.timeStamps = originalTimestamps;
      }
      console.error(error);
    }
  }

  async onUnsetStatus(orderNumber: string | undefined, unset?: string) {
    const order = this.orders.find((o) => o.orderNumber === orderNumber);
    const originalTimestamps = order?.timeStamps ? { ...order.timeStamps } : undefined;
    if (order && unset && order.timeStamps) {
      const { [unset]: _, ...rest } = order.timeStamps as Record<string, unknown>;
      order.timeStamps = rest as typeof order.timeStamps;
    }
    try {
      await this._http.unsetTimestamp(orderNumber ?? '', unset as OrderStatus);
    } catch (error) {
      if (order && originalTimestamps !== undefined) {
        order.timeStamps = originalTimestamps;
      }
      console.error(error);
    }
  }

  resetFilters() {
    this.filterManual = true;
    this.filterOnline = true;
    this.filterTest = false;
    this.textSearch = '';
    this.filterStatus = '';
    this.getOrders();
  }

  async addNote(orderNumber?: string) {
    const noteInput = document.getElementById(`notes${orderNumber}`) as HTMLInputElement;
    const note = noteInput.value;
    const order = this.orders.find((o) => o.orderNumber === orderNumber);
    const originalNotes = order?.notes;
    if (order) {
      order.notes = order.notes ? `${order.notes}\n${note}` : note;
    }
    try {
      await this._http.addNote(orderNumber!, note);
      noteInput.value = '';
    } catch (error) {
      if (order) {
        order.notes = originalNotes;
      }
      console.error(error);
    }
  }

  async onSendEmail(orderNumber?: string) {
    const order = this.orders.find((o) => o.orderNumber === orderNumber);
    const originalTimestamps = order?.timeStamps ? { ...order.timeStamps } : undefined;
    if (order) {
      order.timeStamps = { ...order.timeStamps, postedEmailSent: new Date().toISOString() };
    }
    try {
      await this._http.sendPostedEmail(orderNumber);
    } catch (error) {
      if (order && originalTimestamps !== undefined) {
        order.timeStamps = originalTimestamps;
      }
      console.error(error);
    }
  }
}
