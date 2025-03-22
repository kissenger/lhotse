    
import nodemailer from 'nodemailer';
import 'dotenv/config';

let config = {
  service: 'gmail', 
  host: "stmp.gmail.com",
  port: 587,
  auth: {
      user: 'hello@snorkelology.co.uk',  
      pass: process.env['GMAIL_APP_PASSWD'] // app password snorkelology.co.uk account through google workspace
  },
  secure: true,
}
let transporter = nodemailer.createTransport(config);

let message = {
    from: 'noreply@snorkelology.co.uk', 
    to: 'gordon.taylor@hotmail.co.uk', 
    subject: 'Your Snorkelology order is on its way!', 
    html: `
  <head>
    <style>
      .item { width: 100%; }
      .item > div{ display: inline-block; vertical-align:top; }
      .title { width: 20%; }
    </style>
  </head>
  <body>
    <div class="item">
      <div class="title">Order number:</div>
      <div>bvuiebvueo</div>
    </div>
    <div class="item">
      <div class="title">Shipping:</div>
      <div>x<br>
      x
      </div>    
    </div>
  </body>
    `
};

transporter.sendMail(message).then(res => {console.log(res)});