
import { Injectable } from '@angular/core';
import { OrderSummary } from '../types';

@Injectable({
  providedIn: 'root',
})

export class ExportFileService {


  constructor(
  ) {}

  royalMailServiceCodes(description: string) {
    switch (description) {
      case 'Royal Mail First Class':
        // return 'OLP1';
        return 'TOLP24';
      case 'Royal Mail Second Class':
        // return 'OLP2';
        return 'TOLP48';
      case 'Royal Mail Tracked 24':
        return 'TOLP24';
      case 'Royal Mail Tracked 48':
        return 'TOLP48';
      default:
        return '';
    }
  }

  createCSV(orders: Array<OrderSummary>) {

    let csvData = `Order Reference,Weight,Service Code,First Name,Second Name,Email,Organisation,Address line 1,Address line 2,City,County,Postcode\n`;
  
    orders.forEach( o => {
      csvData += o.orderNumber + ",";
      csvData += o.items[0].quantity * 0.75 + ',';
      csvData += this.royalMailServiceCodes(o.shippingOption) + ',';
      csvData += o.user.name.replaceAll(',','').split(/ (.*)/).filter(a=>a!='').join(',') + ',';
      csvData += (o.user.email_address||'') + ',';
      csvData += (o.user.organisation||'').replaceAll(',','') + ',';
      csvData += (o.user.address.address_line_1||'').replaceAll(',','') + ',';
      csvData += (o.user.address.address_line_2||'').replaceAll(',','') + ',';
      csvData += (o.user.address.admin_area_2||'').replaceAll(',','') + ',';
      csvData += (o.user.address.admin_area_1||'').replaceAll(',','') + ',';
      csvData += (o.user.address.postal_code||'').replaceAll(',','') + '\n'
    });

    let blob = new Blob([csvData], {type: 'text/csv;charset=utf-8;'});
    let dwldLink = document.createElement("a");
    let url = URL.createObjectURL(blob);
    let isSafariBrowser = navigator.userAgent.indexOf(
        'Safari') != -1 &&
        navigator.userAgent.indexOf('Chrome') == -1;

    // If Safari open in new window to
    // save file with random filename.
    if (isSafariBrowser) {
        dwldLink.setAttribute("target", "_blank");
    }
    dwldLink.setAttribute("href", url);
    dwldLink.setAttribute("download", "export.csv");
    dwldLink.style.visibility = "hidden";
    document.body.appendChild(dwldLink);
    dwldLink.click();
    document.body.removeChild(dwldLink);
  
  }

}

