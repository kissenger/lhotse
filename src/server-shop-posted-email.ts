function getPostedEmailBody(orderSummary: any) {

  const isTest = orderSummary.endPoint?.indexOf('sandbox') > 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your order is on its way</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#333;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1D3D59;padding:20px 32px;">
              <a href="https://snorkelology.co.uk" style="text-decoration:none;">
                <img src="https://snorkelology.co.uk/assets/banner/snround.webp" width="72" height="72" alt="Snorkelology logo" style="display:inline-block;vertical-align:middle;border-radius:50%;border:2px solid #ffffff;margin:-12px 0;">
                <span style="display:inline-block;vertical-align:middle;margin-left:14px;font-size:20px;font-weight:600;color:#ffffff;letter-spacing:0.5px;">Snorkelology</span>
              </a>
            </td>
          </tr>

          ${isTest ? '<tr><td style="background-color:#fff3cd;padding:10px 32px;text-align:center;font-weight:700;color:#856404;font-size:13px;">THIS IS A TEST</td></tr>' : ''}

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1D3D59;">Your order is on its way!</h2>
              <p style="margin:0 0 24px;line-height:1.6;color:#555;">
                Order <strong style="color:#1D3D59;">${orderSummary.orderNumber}</strong> has been
                posted using your selected shipping method.
              </p>
              <p style="margin:0 0 24px;line-height:1.6;color:#555;">
                If you have any issues with delivery, please let us know at
                <a href="mailto:orders@snorkelology.co.uk" style="color:#1D3D59;">orders@snorkelology.co.uk</a>.
                Otherwise, thanks again for your order and we hope you enjoy it!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1D3D59;padding:20px 32px;text-align:center;">
              <p style="margin:0 0 10px;font-size:13px;">
                <a href="https://www.youtube.com/@snorkelology" style="color:#ffffff;text-decoration:none;margin:0 8px;">YouTube</a>
                <a href="https://www.facebook.com/snorkelology" style="color:#ffffff;text-decoration:none;margin:0 8px;">Facebook</a>
                <a href="https://www.instagram.com/snorkelology/" style="color:#ffffff;text-decoration:none;margin:0 8px;">Instagram</a>
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

export {getPostedEmailBody}