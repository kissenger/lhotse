function getConfirmationEmailBody(orderSummary: any) {

  let testMessage = orderSummary.endPoint.indexOf('sandbox') > 0 ?
    '<div><b>THIS IS A TEST: NO PAYMENT WAS TAKEN</b></div>' : 
    '';
  let discountMsg = orderSummary.costBreakdown.discount > 0 ? 
    `<div class='item'><div class='title'>Discount</div><div>-£${orderSummary.costBreakdown.discount.toFixed(2)}</div></div>` :
     '';
  return `
    <head>
      <style>
        .item { width: 100%; }
        .item > div{ display: inline-block; vertical-align:top; }
        .title { width: 20%; }
      </style>
    </head>
    <body>
      ${testMessage}
      <div> 
        <p>Thank you so much for your order: we'll let you know when it's on the way.</p>
        <p>If you have any problems with your order, or something doesn't look right below, let us
        know at <a href="mailto:orders@snorkelology.co.uk">orders@snorkelology.co.uk</a>.</p>
      <div class="item">
        <div class="title">Order number:</div>
        <div>${orderSummary.orderNumber}</div>
      </div>
      <div class="item">
        <div class="title">Shipping Address:</div>
        <div>${orderSummary.user.name}<br>
        <span style="white-space: pre;">${orderSummary.user.address.address_line_1 ?  orderSummary.user.address.address_line_1 + '\n' : ''}</span>
        <span style="white-space: pre;">${orderSummary.user.address.address_line_2 ? orderSummary.user.address.address_line_2 + '\n' : ''}</span>
        <span style="white-space: pre;">${orderSummary.user.address.admin_area_2 ? orderSummary.user.address.admin_area_2 + '\n' : ''}</span>
        <span style="white-space: pre;">${orderSummary.user.address.admin_area_1 ? orderSummary.user.address.admin_area_1 + '\n' : ''}</span>
        <span style="white-space: pre;">${orderSummary.user.address.postal_code ? orderSummary.user.address.postal_code + '\n' : ''}</span>
        ${orderSummary.user.address.country_code}
        </div>    
      </div>
      <div class="item">
        <div class="title">Shipping Option:</div>
        <div>${orderSummary.shippingOption}</div>    
      </div>                
      <div class="item">
        <div class="title">Item Cost</div>
        <div>£${orderSummary.costBreakdown.items.toFixed(2)}</div>
      </div>                  
      </div>
      <div class="item">
        <div class="title">Shipping</div>
        <div>£${orderSummary.costBreakdown.shipping.toFixed(2)}</div>
      </div>
      ${discountMsg}
      <div class="item">
        <div class="title">Subtotal</div>
        <div>£${orderSummary.costBreakdown.total.toFixed(2)}</div>
      </div>                                           
    </body>
    `
}

export {getConfirmationEmailBody}