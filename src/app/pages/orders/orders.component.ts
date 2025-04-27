import { CurrencyPipe, NgClass } from '@angular/common';
import { Component, ElementRef, Inject, QueryList, ViewChildren } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { HttpService } from '@shared/services/http.service';
import { ExportFileService } from '@shared/services/export.service';
import { OrderItems, OrderStatus, OrderSummary } from '@shared/types';
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
        console.log(order.orderNumber)
        console.log(elem.nativeElement.innerHTML)
        const data = new ClipboardItem({"text/html": elem.nativeElement.innerHTML});
        navigator.clipboard.write([data]);
      }
    })

    // let label = `<style><.qty { font-size: 0.5em }></style><span class="qty">${order.items[0].name} x ${order.items[0].quantity}<span><br>` + this.getAddress(order);
    // // let label = "text";
    // const data = new ClipboardItem({"text/html": label});
    // navigator.clipboard.write([data]);
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
    this._router.navigateByUrl(`/orders/manual/`); 
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
      this.orders = await this._http.getOrders(this.filterOnline, this.filterManual, this.filterTest, this.filterStatus, this.textSearch)
    } catch (error) {
      console.error(error);
    }
console.log(this.orders)

    this.orders.sort((a, b) => {
      let x: number = new Date(a?.timeStamps?.orderCompleted ?? '').getTime();
      let y: number = new Date(b?.timeStamps?.orderCompleted ?? '').getTime();
      return y-x
    }).sort((a, b) => {
      return Number(b.isAction) - Number(a.isAction);
    })

    this.numberOfCopies = this.orders.map(o=>o.items[0].quantity).reduce((a,b)=> a+b,0);
    this.orderValue = this.orders.map(o=>o.items[0].quantity*o.items[0].unit_amount.value).reduce((a,b)=> a+b,0).toFixed(2);
  }

  async onSetStatus(orderNumber: string | undefined, set: OrderStatus, unset?: OrderStatus) {
    try {
      await this._http.setTimestamp(orderNumber ?? '', set, unset);
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
  async onSendEmail(orderNumber?: string) {
    try {
      await this._http.sendPostedEmail(orderNumber);
      this.getOrders();
    } catch (error) {
      console.error(error);
    }
  }

}