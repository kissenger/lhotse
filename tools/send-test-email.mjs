/**
 * One-off script to send a test confirmation email for visual verification.
 * Usage: node tools/send-test-email.mjs
 * Requires: GMAIL_APP_PASSWD in .env
 */
import nodemailer from 'nodemailer';
import 'dotenv/config';

const EMAIL_CONFIG = {
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  auth: {
    user: 'hello@snorkelology.co.uk',
    pass: process.env.GMAIL_APP_PASSWD
  }
};

// Mock order summary with realistic data
const orderSummary = {
  orderNumber: '1712345678901',
  endPoint: 'https://api.sandbox.paypal.com',
  user: {
    name: 'Gordon Taylor',
    address: {
      address_line_1: '123 High Street',
      admin_area_2: 'Bristol',
      postal_code: 'BS1 1AA',
      country_code: 'GB'
    }
  },
  items: [
    { name: 'Snorkelling Britain', quantity: '1', unit_amount: { value: '14.99' } },
    { name: 'High quality logo stickers', quantity: '2', unit_amount: { value: '2.99' } }
  ],
  shippingOption: 'Royal Mail Tracked 48',
  costBreakdown: {
    items: 20.97,
    shipping: 4.49,
    discount: 2.10,
    total: 23.36
  }
};

function getConfirmationEmailBody(orderSummary) {

  const isTest = orderSummary.endPoint?.indexOf('sandbox') > 0;

  const itemRows = (orderSummary.items ?? []).map((item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;color:#333;">${item.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;color:#333;">${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;color:#333;">&pound;${parseFloat(item.unit_amount?.value ?? 0).toFixed(2)}</td>
    </tr>
  `).join('');

  const discountRow = orderSummary.costBreakdown?.discount > 0 ? `
    <tr>
      <td colspan="2" style="padding:6px 0;color:#2a7d2a;">Discount</td>
      <td style="padding:6px 0;text-align:right;color:#2a7d2a;">&minus;&pound;${parseFloat(orderSummary.costBreakdown.discount).toFixed(2)}</td>
    </tr>
  ` : '';

  const address = orderSummary.user?.address ?? {};
  const addressLines = [
    address.address_line_1,
    address.address_line_2,
    address.admin_area_2,
    address.admin_area_1,
    address.postal_code,
    address.country_code
  ].filter(Boolean).join('<br>');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#333;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">

          ${isTest ? '<tr><td style="background-color:#fff3cd;padding:10px 32px;text-align:center;font-weight:700;color:#856404;font-size:13px;">TEST ORDER &mdash; NO PAYMENT WAS TAKEN</td></tr>' : ''}

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="width:112px;vertical-align:top;padding-right:20px;">
                    <a href="https://snorkelology.co.uk" style="text-decoration:none;">
                      <img src="https://snorkelology.co.uk/assets/banner/snround.webp" width="96" height="96" alt="Snorkelology logo" style="display:block;border-radius:50%;">
                    </a>
                  </td>
                  <td style="vertical-align:top;">
                    <h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1D3D59;">Thank you for your order!</h2>
                    <p style="margin:0;line-height:1.6;color:#555;">
                      We're getting your order ready and will let you know when it's on its way.
                      If anything doesn't look right, just reply to this email or drop us a line at
                      <a href="mailto:orders@snorkelology.co.uk" style="color:#1D3D59;">orders@snorkelology.co.uk</a>.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Order number -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background-color:#f8f9fa;border-radius:6px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <span style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Order number</span><br>
                    <span style="font-size:16px;font-weight:700;color:#1D3D59;">${orderSummary.orderNumber}</span>
                  </td>
                </tr>
              </table>

              <!-- Items -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr style="border-bottom:2px solid #1D3D59;">
                  <th style="padding:8px 0;text-align:left;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #1D3D59;">Item</th>
                  <th style="padding:8px 0;text-align:center;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #1D3D59;">Qty</th>
                  <th style="padding:8px 0;text-align:right;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #1D3D59;">Price</th>
                </tr>
                ${itemRows}
              </table>

              <!-- Totals -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td colspan="2" style="padding:6px 0;color:#555;">Items</td>
                  <td style="padding:6px 0;text-align:right;color:#555;">&pound;${parseFloat(orderSummary.costBreakdown?.items ?? 0).toFixed(2)}</td>
                </tr>
                ${discountRow}
                <tr>
                  <td colspan="2" style="padding:6px 0;color:#555;">Shipping (${orderSummary.shippingOption ?? 'Standard'})</td>
                  <td style="padding:6px 0;text-align:right;color:#555;">&pound;${parseFloat(orderSummary.costBreakdown?.shipping ?? 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:10px 0 0;font-weight:700;font-size:16px;color:#1D3D59;border-top:2px solid #1D3D59;">Total</td>
                  <td style="padding:10px 0 0;text-align:right;font-weight:700;font-size:16px;color:#1D3D59;border-top:2px solid #1D3D59;">&pound;${parseFloat(orderSummary.costBreakdown?.total ?? 0).toFixed(2)}</td>
                </tr>
              </table>

              <!-- Shipping address -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;background-color:#f8f9fa;border-radius:6px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <span style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Shipping to</span><br>
                    <span style="font-weight:600;color:#333;">${orderSummary.user?.name ?? ''}</span><br>
                    <span style="color:#555;line-height:1.6;">${addressLines}</span>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1D3D59;padding:20px 32px;text-align:center;">
              <p style="margin:0 0 10px;font-size:13px;">
                <a href="https://snorkelology.co.uk" style="color:#ffffff;text-decoration:none;">Snorkelology</a>
                <span style="color:rgba(255,255,255,0.5);margin:0 6px;">&middot;</span>
                <a href="https://www.youtube.com/@snorkelology" style="color:#ffffff;text-decoration:none;">YouTube</a>
                <span style="color:rgba(255,255,255,0.5);margin:0 6px;">&middot;</span>
                <a href="https://www.facebook.com/snorkelology" style="color:#ffffff;text-decoration:none;">Facebook</a>
                <span style="color:rgba(255,255,255,0.5);margin:0 6px;">&middot;</span>
                <a href="https://www.instagram.com/snorkelology/" style="color:#ffffff;text-decoration:none;">Instagram</a>
              </p>
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.7);">
                &copy; Snorkelology 2022-${new Date().getFullYear()}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

const html = getConfirmationEmailBody(orderSummary);
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

const message = {
  from: 'noreply@snorkelology.co.uk',
  to: 'gordon.taylor@hotmail.co.uk',
  subject: '[TEST] Thank you for ordering from Snorkelology',
  html
};

try {
  const info = await transporter.sendMail(message);
  console.log('Test email sent successfully:', info.messageId);
} catch (err) {
  console.error('Failed to send test email:', err.message);
}
