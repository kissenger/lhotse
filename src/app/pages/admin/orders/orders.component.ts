import { CurrencyPipe, NgClass } from '@angular/common';
import { Component, ElementRef, Inject, QueryList, ViewChildren } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { HttpService } from '@shared/services/http.service';
import { ExportFileService } from '@shared/services/export.service';
import { OrderStatus, OrderSummary } from '@shared/types';
import { Router, RouterLink } from '@angular/router';


@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [NgClass, FormsModule, CurrencyPipe, RouterLink],  
  providers: [], 
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})

export class OrdersComponent  {

  public filterManual = true;
  public filterOnline = true;
  public filterTest = false;
  public textSearch: string = '';
  public filterStatus: string = '';
  public numberOfCopies: number = 0;
  public orderValue: string = '';
  public orders: Array<OrderSummary> = [];
  public timeStamps: Array<{}> = [];

  @ViewChildren('label') labelElements!: QueryList<ElementRef>;
  
  constructor(
    private _http: HttpService,    
    private _exportCSV: ExportFileService,
    @Inject(Router) private _router: Router
    
  ) {}
    
  ngOnInit() {
    this.getOrders();
  }

  copyEmails() {
    let emails = this.orders.map(o=>o.user.email_address);
    navigator.clipboard.writeText(emails.join(";"))
  }

  newOrder() {
    this._router.navigateByUrl(`/admin/orders/manual/`); 
  }

  async onDeactivate(orderNumber: string) {
    // Optimistic update: remove from list immediately
    const originalOrders = [...this.orders];
    this.orders = this.orders.filter(o => o.orderNumber !== orderNumber);
    try {
      await this._http.deactivateOrder(orderNumber);
    } catch (error) {
      // Revert on error
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
      let os = await this._http.getOrders(this.filterOnline, this.filterManual, this.filterTest, this.filterStatus, this.textSearch)
      this.orders = os.filter( (o:any) => !!o.orderNumber);
    } catch (error) {
      document.body.style.cursor = 'auto';
      console.error(error);
    }

    this.orders.sort((a, b) => {
      let x: number = new Date(a?.timeStamps?.orderCompleted ?? '').getTime();
      let y: number = new Date(b?.timeStamps?.orderCompleted ?? '').getTime();
      return y-x
    }).sort((a, b) => {
      return Number(b.isAction) - Number(a.isAction);
    })


    let sums:any = {};
    this.orders.forEach(o=>{
      if (o.orderType! in sums) {
        sums[o.orderType!].orders += 1
        sums[o.orderType!].units += o.items[0].quantity;
        sums[o.orderType!].value += o.items[0].quantity*o.items[0].unit_amount.value;
        sums[o.orderType!].income += (o.costBreakdown.items-o.costBreakdown.discount);
      } else {
        sums[o.orderType!] = {
          orders: 1,
          units: o.items[0].quantity,
          value: o.items[0].quantity*o.items[0].unit_amount.value,
          income: o.costBreakdown.items-o.costBreakdown.discount
        }
      }
    })
    document.body.style.cursor = 'auto';

    this.numberOfCopies = this.orders.reduce((acc,cv)=> 
      cv.items.reduce((a,c)=>{
        if (c.id === '0001' || c.id === '0002') return a+c.quantity
        else return a
      },0) + acc, 0);

      console.log(this.numberOfCopies);
    

    // this.countMediaCopies    = this.orders.map(o=>o.orderType==='freeMediaOrder'?o.items[0].quantity:0).reduce((a,b)=> a+b,0);
    // this.countMediaCopiesDan = this.orders.map(o=>o.orderType==='freeMediaOrderDan'?o.items[0].quantity:0).reduce((a,b)=> a+b,0);
    // this.countMediaCopiesDan = this.orders.map(o=>o.orderType==='freeFriendsOrder'?o.items[0].quantity:0).reduce((a,b)=> a+b,0);
    // this.countMediaCopiesDan = this.orders.map(o=>o.orderType==='replacementOrder'?o.items[0].quantity:0).reduce((a,b)=> a+b,0);
    // this.countMediaCopiesDan = this.orders.map(o=>o.orderType==='regularOrder'?o.items[0].quantity:0).reduce((a,b)=> a+b,0);
    // this.orderValue = this.orders.map(o=>o.items[0].quantity*o.items[0].unit_amount.value).reduce((a,b)=> a+b,0).toFixed(2);
  }


  async onSetStatus(orderNumber: string | undefined, set: string) {
    // Optimistic update: update local state immediately
    const order = this.orders.find(o => o.orderNumber === orderNumber);
    const originalTimestamps = order?.timeStamps ? { ...order.timeStamps } : undefined;
    if (order) {
      order.timeStamps = { ...order.timeStamps, [set]: new Date().toISOString() };
    }
    try {
      await this._http.setTimestamp(orderNumber ?? '', <OrderStatus>set);
    } catch (error) {
      // Revert on error
      if (order && originalTimestamps !== undefined) {
        order.timeStamps = originalTimestamps;
      }
      console.error(error);
    }
  }

  async onUnsetStatus(orderNumber: string | undefined, unset?: string) {
    // Optimistic update: remove timestamp from local state immediately
    const order = this.orders.find(o => o.orderNumber === orderNumber);
    const originalTimestamps = order?.timeStamps ? { ...order.timeStamps } : undefined;
    if (order && unset && order.timeStamps) {
      const { [unset]: _, ...rest } = order.timeStamps as Record<string, any>;
      order.timeStamps = rest as typeof order.timeStamps;
    }
    try {
      await this._http.unsetTimestamp(orderNumber ?? '', <OrderStatus>unset);
    } catch (error) {
      // Revert on error
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
    const noteInput = <HTMLInputElement>document.getElementById(`notes${orderNumber}`);
    const note = noteInput.value;
    // Optimistic update: append note to local state immediately
    const order = this.orders.find(o => o.orderNumber === orderNumber);
    const originalNotes = order?.notes;
    if (order) {
      order.notes = order.notes ? `${order.notes}\n${note}` : note;
    }
    try {
      await this._http.addNote(orderNumber!, note);
      noteInput.value = ''; // Clear input on success
    } catch (error) {
      // Revert on error
      if (order) {
        order.notes = originalNotes;
      }
      console.error(error);
    }
  }

  async onSendEmail(orderNumber?: string) {
    // Optimistic update: mark as emailed immediately
    const order = this.orders.find(o => o.orderNumber === orderNumber);
    const originalTimestamps = order?.timeStamps ? { ...order.timeStamps } : undefined;
    if (order) {
      order.timeStamps = { ...order.timeStamps, postedEmailSent: new Date().toISOString() };
    }
    try {
      await this._http.sendPostedEmail(orderNumber);
    } catch (error) {
      // Revert on error
      if (order && originalTimestamps !== undefined) {
        order.timeStamps = originalTimestamps;
      }
      console.error(error);
    }
  }

}