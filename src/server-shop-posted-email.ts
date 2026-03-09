function getPostedEmailBody(orderSummary: any) {

  let testMessage = orderSummary.endPoint.indexOf('sandbox') > 0 ?
    '<div><b>THIS IS A TEST</b></div>' : 
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
        <p>
          Just to let you know that your order number ${orderSummary.orderNumber} has been posted
          using your selected shipping method.
        </p>
        <p>
          If you have any issues with delivery, please let us
          know at <a href="mailto:orders@snorkelology.co.uk">orders@snorkelology.co.uk</a>.  Otherwise,
          thanks for your order and we hope you enjoy the book!
        </p>
      </div>                                  
    </body>
    `
}

export {getPostedEmailBody}