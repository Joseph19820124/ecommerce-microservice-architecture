interface EmailTemplate {
  subject: string;
  html: string;
}

export const templates: Record<string, EmailTemplate> = {
  ORDER_CREATED: {
    subject: 'Order Confirmation - {{orderNumber}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hi {{customerName}},</p>
            <p>Thank you for your order! We've received your order and are getting it ready.</p>
            <p><strong>Order Number:</strong> {{orderNumber}}</p>
            <p><strong>Total Amount:</strong> {{currency}} {{totalAmount}}</p>
            <p>You can track your order status in your account.</p>
            <p style="text-align: center; margin-top: 20px;">
              <a href="{{trackingUrl}}" class="button">Track Order</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 E-Commerce. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },

  ORDER_SHIPPED: {
    subject: 'Your Order Has Been Shipped - {{orderNumber}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .tracking-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Order is On Its Way!</h1>
          </div>
          <div class="content">
            <p>Hi {{customerName}},</p>
            <p>Great news! Your order has been shipped.</p>
            <div class="tracking-box">
              <p><strong>Order Number:</strong> {{orderNumber}}</p>
              <p><strong>Tracking Number:</strong> {{trackingNumber}}</p>
            </div>
            <p>Estimated delivery: {{estimatedDelivery}}</p>
          </div>
          <div class="footer">
            <p>© 2024 E-Commerce. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },

  ORDER_DELIVERED: {
    subject: 'Your Order Has Been Delivered - {{orderNumber}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Delivered!</h1>
          </div>
          <div class="content">
            <p>Hi {{customerName}},</p>
            <p>Your order {{orderNumber}} has been delivered.</p>
            <p>We hope you love your purchase! If you have a moment, we'd appreciate your feedback.</p>
            <p style="text-align: center; margin-top: 20px;">
              <a href="{{reviewUrl}}" class="button">Leave a Review</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 E-Commerce. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },

  ORDER_CANCELLED: {
    subject: 'Order Cancelled - {{orderNumber}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Cancelled</h1>
          </div>
          <div class="content">
            <p>Hi {{customerName}},</p>
            <p>Your order {{orderNumber}} has been cancelled.</p>
            <p><strong>Reason:</strong> {{cancelReason}}</p>
            <p>If a payment was made, you will receive a refund within 5-7 business days.</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>© 2024 E-Commerce. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },

  PAYMENT_SUCCESS: {
    subject: 'Payment Successful - {{orderNumber}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Successful</h1>
          </div>
          <div class="content">
            <p>Hi {{customerName}},</p>
            <p>Your payment of {{currency}} {{amount}} for order {{orderNumber}} was successful.</p>
            <p><strong>Transaction ID:</strong> {{transactionId}}</p>
            <p>Thank you for your purchase!</p>
          </div>
          <div class="footer">
            <p>© 2024 E-Commerce. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },

  WELCOME: {
    subject: 'Welcome to E-Commerce!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome!</h1>
          </div>
          <div class="content">
            <p>Hi {{customerName}},</p>
            <p>Welcome to E-Commerce! We're excited to have you join us.</p>
            <p>Start exploring our products and enjoy exclusive deals.</p>
            <p style="text-align: center; margin-top: 20px;">
              <a href="{{shopUrl}}" class="button">Start Shopping</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 E-Commerce. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },

  PASSWORD_RESET: {
    subject: 'Password Reset Request',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <p>Hi {{customerName}},</p>
            <p>We received a request to reset your password. Click the button below to create a new password.</p>
            <p style="text-align: center; margin-top: 20px;">
              <a href="{{resetUrl}}" class="button">Reset Password</a>
            </p>
            <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">
              If you didn't request this, you can safely ignore this email. The link will expire in 1 hour.
            </p>
          </div>
          <div class="footer">
            <p>© 2024 E-Commerce. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },
};
