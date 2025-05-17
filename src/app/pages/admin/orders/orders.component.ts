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

  copyAddresses() {
    let addresses = this.orders.map(o=>this.getAddress(o)+"\n")
    navigator.clipboard.writeText(addresses.join("\n"))
  }

  copyLabel(order: OrderSummary) {
    this.labelElements.toArray().forEach( (elem) => {
      if (elem.nativeElement.id === order.orderNumber) {
        const data = new ClipboardItem({"text/html": elem.nativeElement.innerHTML});
        navigator.clipboard.write([data]);
      }
    })

  }

  getAddress(order: OrderSummary) {
    return (order.user.name+"\n"+
      (order.user.organisation||'')+"\n"+
      (order.user.address.address_line_1||'')+"\n"+
      (order.user.address.address_line_2||'')+"\n"+
      (order.user.address.admin_area_2||'')+"\n"+
      (order.user.address.admin_area_1||'')+"\n"+
      order.user.address.postal_code).replaceAll(/[\n]+/g,"\n");
  }

  newOrder() {
    this._router.navigateByUrl(`/admin/orders/manual/`); 
  }

  async onDeactivate(orderNumber: string) {
    let respose = await this._http.deactivateOrder(orderNumber); 
    this.getOrders();
  }

  onUpdateList() {
    this.getOrders();
  }

  exportCSV() {
    this._exportCSV.createCSV(this.orders);
  }

  async getOrders() {

    try {
      let os = await this._http.getOrders(this.filterOnline, this.filterManual, this.filterTest, this.filterStatus, this.textSearch)
      this.orders = os.filter( (o:any) => !!o.orderNumber);
    } catch (error) {
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
    console.log(sums)
    

    // this.countMediaCopies    = this.orders.map(o=>o.orderType==='freeMediaOrder'?o.items[0].quantity:0).reduce((a,b)=> a+b,0);
    // this.countMediaCopiesDan = this.orders.map(o=>o.orderType==='freeMediaOrderDan'?o.items[0].quantity:0).reduce((a,b)=> a+b,0);
    // this.countMediaCopiesDan = this.orders.map(o=>o.orderType==='freeFriendsOrder'?o.items[0].quantity:0).reduce((a,b)=> a+b,0);
    // this.countMediaCopiesDan = this.orders.map(o=>o.orderType==='replacementOrder'?o.items[0].quantity:0).reduce((a,b)=> a+b,0);
    // this.countMediaCopiesDan = this.orders.map(o=>o.orderType==='regularOrder'?o.items[0].quantity:0).reduce((a,b)=> a+b,0);
    // this.orderValue = this.orders.map(o=>o.items[0].quantity*o.items[0].unit_amount.value).reduce((a,b)=> a+b,0).toFixed(2);
  }


  async onSetStatus(orderNumber: string | undefined, set: OrderStatus) {
    try {
      await this._http.setTimestamp(orderNumber ?? '', set );
      this.getOrders();
    } catch (error) {
      console.error(error);
    }
  }

  async onUnsetStatus(orderNumber: string | undefined, unset: OrderStatus) {
    try {
      await this._http.unsetTimestamp(orderNumber ?? '', unset);
      this.getOrders();
    } catch (error) {
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
    try {
      const note = (<HTMLInputElement>document.getElementById(`notes${orderNumber}`)).value;
      await this._http.addNote(orderNumber!, note);
      this.getOrders();
    } catch (error) {
      console.error(error);
    }
  }

  async onSendEmail(orderNumber?: string) {
    try {
      await this._http.sendPostedEmail(orderNumber);
      this.getOrders();
    } catch (error) {
      console.error(error);
    }
  }

}