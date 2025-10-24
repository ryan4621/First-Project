// services/email-service.js
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Email configuration
const EMAIL_CONFIG = {
  from: {
    email: process.env.FROM_EMAIL || 'noreply@yourwebsite.com',
    name: process.env.FROM_NAME || 'Your Website Support'
  },
  adminEmail: process.env.ADMIN_EMAIL || 'admin@yourwebsite.com'
};

/**
 * Send email verification link
 */
export const sendVerificationEmail = async (userEmail, userName, verificationUrl) => {
  try {
    const subjectLine = 'Verify Your Email - FARFETCH';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 2rem;
          }
          .header h1 {
            margin: 0;
            font-size: 1.5rem;
          }
          .btn {
            display: inline-block;
            padding: 15px 30px;
            background: #000;
            color: #fff;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
            margin: 1.5rem 0;
          }
          .link-box {
            background: #f5f5f5;
            padding: 1rem;
            border-radius: 4px;
            word-break: break-all;
            margin: 1rem 0;
            font-size: 0.9rem;
            color: #7f8c8d;
          }
          .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #e9ecef;
            font-size: 0.9rem;
            color: #7f8c8d;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to FARFETCH, ${userName}!</h1>
          </div>
          
          <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="btn">Verify Email Address</a>
          </div>
          
          <p>Or copy and paste this link in your browser:</p>
          <div class="link-box">${verificationUrl}</div>
          
          <p><strong>This link will expire in 24 hours.</strong></p>
          
          <p style="color: #666; font-size: 0.9rem;">If you didn't create an account, please ignore this email.</p>
          
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} FARFETCH. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Welcome to FARFETCH, ${userName}!

Thank you for registering. Please verify your email address by visiting this link:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, please ignore this email.

© ${new Date().getFullYear()} FARFETCH. All rights reserved.
    `;

    const msg = {
      to: userEmail,
      from: EMAIL_CONFIG.from,
      subject: subjectLine,
      text: textContent,
      html: htmlContent
    };

    await sgMail.send(msg);
    console.log(`Verification email sent to ${userEmail}`);
    return { success: true };

  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send confirmation email to customer after support form submission
 */
export const sendContactConfirmationEmail = async (customerEmail, customerName, submissionId, subject, message, priority = 'normal') => {
  try {
    const subjectLine = `Support Request Received - Ticket #${submissionId}`;
    
    const estimatedResponse = priority === 'high' || priority === 'urgent' ? '4-8 hours' : '12-24 hours';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Support Request Confirmation</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 2rem;
          }
          .header h1 {
            margin: 0;
            font-size: 1.5rem;
          }
          .ticket-info {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #3498db;
            margin: 1.5rem 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
            padding: 0.25rem 0;
            border-bottom: 1px solid #e9ecef;
          }
          .info-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
          }
          .label {
            font-weight: 600;
            color: #2c3e50;
          }
          .value {
            color: #7f8c8d;
          }
          .message-box {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
            border-left: 4px solid #27ae60;
          }
          .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #e9ecef;
            font-size: 0.9rem;
            color: #7f8c8d;
            text-align: center;
          }
          .priority-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
          }
          .priority-normal { background: #dbeafe; color: #3498db; }
          .priority-high { background: #fdeaa7; color: #f39c12; }
          .priority-urgent { background: #fadbd8; color: #e74c3c; }
          .priority-low { background: #d5f4e6; color: #27ae60; }
          @media (max-width: 600px) {
            body { padding: 10px; }
            .container { padding: 1rem; }
            .info-row { flex-direction: column; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Support Request Received</h1>
            <p style="margin: 0; opacity: 0.9;">We've received your message and will respond soon</p>
          </div>
          
          <p>Dear ${customerName},</p>
          
          <p>Thank you for contacting our support team. We have successfully received your message and created a support ticket for your inquiry.</p>
          
          <div class="ticket-info">
            <h3 style="margin-top: 0; color: #2c3e50;">Ticket Information</h3>
            <div class="info-row">
              <span class="label">Ticket ID:</span>
              <span class="value">#${submissionId}</span>
            </div>
            <div class="info-row">
              <span class="label">Subject:</span>
              <span class="value">${formatSubjectForEmail(subject)}</span>
            </div>
            <div class="info-row">
              <span class="label">Priority:</span>
              <span class="value">
                <span class="priority-badge priority-${priority}">${priority}</span>
              </span>
            </div>
            <div class="info-row">
              <span class="label">Expected Response:</span>
              <span class="value">${estimatedResponse}</span>
            </div>
            <div class="info-row">
              <span class="label">Status:</span>
              <span class="value">Pending Review</span>
            </div>
          </div>
          
          <div class="message-box">
            <h4 style="margin-top: 0; color: #27ae60;">Your Message:</h4>
            <p style="margin-bottom: 0;">${message.replace(/\n/g, '<br>')}</p>
          </div>
          
          <p><strong>What happens next?</strong></p>
          <ul>
            <li>Our support team will review your request</li>
            <li>You'll receive a response within ${estimatedResponse}</li>
            <li>All communication will be sent to this email address</li>
            <li>Please keep your ticket ID (#${submissionId}) for reference</li>
          </ul>
          
          <p><strong>Need urgent assistance?</strong> If this is a critical issue, please mention "URGENT" in any follow-up emails.</p>
          
          <div class="footer">
            <p>This is an automated confirmation email. Please do not reply directly to this message.</p>
            <p>If you need to add more information to your ticket, please submit a new support request and reference ticket #${submissionId}.</p>
            <p>&copy; ${new Date().getFullYear()} Your Website. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Support Request Received - Ticket #${submissionId}

Dear ${customerName},

Thank you for contacting our support team. We have successfully received your message and created a support ticket for your inquiry.

Ticket Information:
- Ticket ID: #${submissionId}
- Subject: ${formatSubjectForEmail(subject)}
- Priority: ${priority}
- Expected Response: ${estimatedResponse}
- Status: Pending Review

Your Message:
${message}

What happens next?
- Our support team will review your request
- You'll receive a response within ${estimatedResponse}
- All communication will be sent to this email address
- Please keep your ticket ID (#${submissionId}) for reference

Need urgent assistance? If this is a critical issue, please mention "URGENT" in any follow-up emails.

This is an automated confirmation email. Please do not reply directly to this message.
If you need to add more information to your ticket, please submit a new support request and reference ticket #${submissionId}.

© ${new Date().getFullYear()} Your Website. All rights reserved.
    `;

    const msg = {
      to: customerEmail,
      from: EMAIL_CONFIG.from,
      subject: subjectLine,
      text: textContent,
      html: htmlContent
    };

    await sgMail.send(msg);
    console.log(`Confirmation email sent to ${customerEmail} for ticket #${submissionId}`);
    return { success: true };

  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification email to admin when new support request is received
 */
export const sendContactNotificationToAdmin = async (submissionId, customerName, customerEmail, subject, message, priority = 'normal', userInfo = null) => {
  try {
    const subjectLine = `New Support Request - Ticket #${submissionId} [${priority.toUpperCase()}]`;
    
    const customerType = userInfo ? 'Registered User' : 'Guest';
    const adminPanelUrl = `https://yourwebsite.com/admin-support.html`; // Update with your actual admin URL
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Support Request</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 2rem;
          }
          .header.high-priority {
            background: linear-gradient(135deg, #f39c12, #d68910);
          }
          .header.urgent-priority {
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }
          .header h1 {
            margin: 0;
            font-size: 1.5rem;
          }
          .customer-info {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #3498db;
            margin: 1.5rem 0;
          }
          .ticket-details {
            background: #fff3cd;
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #f39c12;
            margin: 1.5rem 0;
          }
          .message-box {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            margin: 1.5rem 0;
            border-left: 4px solid #e74c3c;
          }
          .action-buttons {
            text-align: center;
            margin: 2rem 0;
          }
          .btn {
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 0 10px;
          }
          .btn:hover {
            background: linear-gradient(135deg, #2980b9, #1f618d);
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
            padding: 0.25rem 0;
            border-bottom: 1px solid #e9ecef;
          }
          .info-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
          }
          .label {
            font-weight: 600;
            color: #2c3e50;
          }
          .value {
            color: #7f8c8d;
          }
          .priority-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
          }
          .priority-normal { background: #dbeafe; color: #3498db; }
          .priority-high { background: #fdeaa7; color: #f39c12; }
          .priority-urgent { background: #fadbd8; color: #e74c3c; }
          .priority-low { background: #d5f4e6; color: #27ae60; }
          @media (max-width: 600px) {
            body { padding: 10px; }
            .container { padding: 1rem; }
            .info-row { flex-direction: column; }
            .btn { display: block; margin: 10px 0; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header ${priority === 'urgent' ? 'urgent-priority' : priority === 'high' ? 'high-priority' : ''}">
            <h1>New Support Request</h1>
            <p style="margin: 0; opacity: 0.9;">Ticket #${submissionId} requires attention</p>
          </div>
          
          <div class="customer-info">
            <h3 style="margin-top: 0; color: #2c3e50;">Customer Information</h3>
            <div class="info-row">
              <span class="label">Name:</span>
              <span class="value">${customerName}</span>
            </div>
            <div class="info-row">
              <span class="label">Email:</span>
              <span class="value">${customerEmail}</span>
            </div>
            <div class="info-row">
              <span class="label">Account Type:</span>
              <span class="value">${customerType}</span>
            </div>
            ${userInfo ? `
            <div class="info-row">
              <span class="label">Account Name:</span>
              <span class="value">${userInfo.full_name}</span>
            </div>
            <div class="info-row">
              <span class="label">Account Email:</span>
              <span class="value">${userInfo.user_email}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="ticket-details">
            <h3 style="margin-top: 0; color: #2c3e50;">Ticket Details</h3>
            <div class="info-row">
              <span class="label">Ticket ID:</span>
              <span class="value">#${submissionId}</span>
            </div>
            <div class="info-row">
              <span class="label">Subject:</span>
              <span class="value">${formatSubjectForEmail(subject)}</span>
            </div>
            <div class="info-row">
              <span class="label">Priority:</span>
              <span class="value">
                <span class="priority-badge priority-${priority}">${priority}</span>
              </span>
            </div>
            <div class="info-row">
              <span class="label">Submitted:</span>
              <span class="value">${new Date().toLocaleString()}</span>
            </div>
          </div>
          
          <div class="message-box">
            <h4 style="margin-top: 0; color: #e74c3c;">Customer Message:</h4>
            <p style="margin-bottom: 0; white-space: pre-line;">${message}</p>
          </div>
          
          <div class="action-buttons">
            <a href="${adminPanelUrl}" class="btn">View in Admin Panel</a>
          </div>
          
          <p style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e9ecef; font-size: 0.9rem; color: #7f8c8d; text-align: center;">
            This notification was sent automatically when a new support request was submitted.
          </p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
New Support Request - Ticket #${submissionId}

Customer Information:
- Name: ${customerName}
- Email: ${customerEmail}
- Account Type: ${customerType}
${userInfo ? `- Account Name: ${userInfo.full_name}\n- Account Email: ${userInfo.user_email}` : ''}

Ticket Details:
- Ticket ID: #${submissionId}
- Subject: ${formatSubjectForEmail(subject)}
- Priority: ${priority}
- Submitted: ${new Date().toLocaleString()}

Customer Message:
${message}

View this ticket in the admin panel: ${adminPanelUrl}

This notification was sent automatically when a new support request was submitted.
    `;

    const msg = {
      to: EMAIL_CONFIG.adminEmail,
      from: EMAIL_CONFIG.from,
      subject: subjectLine,
      text: textContent,
      html: htmlContent
    };

    await sgMail.send(msg);
    console.log(`Admin notification sent for ticket #${submissionId}`);
    return { success: true };

  } catch (error) {
    console.error('Error sending admin notification email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Format subject for display in emails
 */
function formatSubjectForEmail(subject) {
  const subjects = {
    'general': 'General Inquiry',
    'account': 'Account Issues',
    'product': 'Product Questions',
    'technical': 'Technical Support',
    'billing': 'Billing & Payments',
    'feedback': 'Feedback & Suggestions',
    'other': 'Other'
  };
  return subjects[subject] || subject;
}

/**
 * Test email configuration
 */
export const testEmailConfiguration = async () => {
  try {
    const testMsg = {
      to: EMAIL_CONFIG.adminEmail,
      from: EMAIL_CONFIG.from,
      subject: 'SendGrid Configuration Test',
      text: 'This is a test email to verify SendGrid configuration is working correctly.',
      html: '<p>This is a test email to verify SendGrid configuration is working correctly.</p>'
    };

    await sgMail.send(testMsg);
    console.log('Test email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error sending test email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification email based on category
 */
export const sendNotificationEmail = async (userEmail, userName, title, message, category) => {
  try {
    const subjectLine = `${title}`;
    
    // Get template based on category
    const template = getNotificationTemplate(category, title, message, userName);
    
    const msg = {
      to: userEmail,
      from: EMAIL_CONFIG.from,
      subject: subjectLine,
      text: template.text,
      html: template.html
    };

    await sgMail.send(msg);
    console.log(`Notification email sent to ${userEmail} (${category})`);
    return { success: true };

  } catch (error) {
    console.error('Error sending notification email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get notification template based on category
 */
function getNotificationTemplate(category, title, message, userName) {
  const baseStyles = `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f8f9fa;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .message-content {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 8px;
      margin: 1.5rem 0;
    }
    .footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #e9ecef;
      font-size: 0.9rem;
      color: #7f8c8d;
      text-align: center;
    }
    @media (max-width: 600px) {
      body { padding: 10px; }
      .container { padding: 1rem; }
    }
  `;

  switch (category) {
    case 'marketing_emails':
      return {
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>${baseStyles}
              .header {
                background: linear-gradient(135deg, #3498db, #2980b9);
                color: white;
                padding: 1.5rem;
                border-radius: 8px;
                text-align: center;
                margin-bottom: 2rem;
              }
              .message-content {
                border-left: 4px solid #3498db;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 1.5rem;">${title}</h1>
              </div>
              
              <p>Hi ${userName},</p>
              
              <div class="message-content">
                ${message.replace(/\n/g, '<br>')}
              </div>
              
              <div class="footer">
                <p>You received this because you subscribed to marketing updates.</p>
                <p>You can update your notification preferences in your account settings.</p>
                <p>&copy; ${new Date().getFullYear()} Your Website. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `${title}\n\nHi ${userName},\n\n${message}\n\nYou received this because you subscribed to marketing updates.\nYou can update your notification preferences in your account settings.\n\n© ${new Date().getFullYear()} Your Website. All rights reserved.`
      };

    case 'order_updates':
      return {
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>${baseStyles}
              .header {
                background: linear-gradient(135deg, #27ae60, #229954);
                color: white;
                padding: 1.5rem;
                border-radius: 8px;
                text-align: center;
                margin-bottom: 2rem;
              }
              .message-content {
                border-left: 4px solid #27ae60;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 1.5rem;">Order Update</h1>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">${title}</p>
              </div>
              
              <p>Hi ${userName},</p>
              
              <div class="message-content">
                ${message.replace(/\n/g, '<br>')}
              </div>
              
              <div class="footer">
                <p>This is an important update about your order.</p>
                <p>You can update your notification preferences in your account settings.</p>
                <p>&copy; ${new Date().getFullYear()} Your Website. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Order Update: ${title}\n\nHi ${userName},\n\n${message}\n\nThis is an important update about your order.\nYou can update your notification preferences in your account settings.\n\n© ${new Date().getFullYear()} Your Website. All rights reserved.`
      };

    case 'promotional_offers':
      return {
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>${baseStyles}
              .header {
                background: linear-gradient(135deg, #f39c12, #d68910);
                color: white;
                padding: 1.5rem;
                border-radius: 8px;
                text-align: center;
                margin-bottom: 2rem;
              }
              .message-content {
                border-left: 4px solid #f39c12;
              }
              .promo-highlight {
                background: #fff3cd;
                padding: 1rem;
                border-radius: 8px;
                text-align: center;
                margin: 1rem 0;
                border: 2px solid #f39c12;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 1.5rem;">Special Offer!</h1>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">${title}</p>
              </div>
              
              <p>Hi ${userName},</p>
              
              <div class="promo-highlight">
                <strong style="color: #d68910; font-size: 1.1rem;">Limited Time Offer</strong>
              </div>
              
              <div class="message-content">
                ${message.replace(/\n/g, '<br>')}
              </div>
              
              <div class="footer">
                <p>You received this promotional offer because you opted in to promotional emails.</p>
                <p>You can update your notification preferences in your account settings.</p>
                <p>&copy; ${new Date().getFullYear()} Your Website. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Special Offer: ${title}\n\nHi ${userName},\n\nLIMITED TIME OFFER\n\n${message}\n\nYou received this promotional offer because you opted in to promotional emails.\nYou can update your notification preferences in your account settings.\n\n© ${new Date().getFullYear()} Your Website. All rights reserved.`
      };

    case 'general':
    default:
      return {
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>${baseStyles}
              .header {
                background: linear-gradient(135deg, #34495e, #2c3e50);
                color: white;
                padding: 1.5rem;
                border-radius: 8px;
                text-align: center;
                margin-bottom: 2rem;
              }
              .message-content {
                border-left: 4px solid #34495e;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 1.5rem;">${title}</h1>
              </div>
              
              <p>Hi ${userName},</p>
              
              <div class="message-content">
                ${message.replace(/\n/g, '<br>')}
              </div>
              
              <div class="footer">
                <p>This is a general notification from our team.</p>
                <p>You can update your notification preferences in your account settings.</p>
                <p>&copy; ${new Date().getFullYear()} Your Website. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `${title}\n\nHi ${userName},\n\n${message}\n\nThis is a general notification from our team.\nYou can update your notification preferences in your account settings.\n\n© ${new Date().getFullYear()} Your Website. All rights reserved.`
      };
  }
}

/**
 * Send password reset code email
 */
export const sendPasswordResetEmail = async (userEmail, userName, resetCode) => {
  try {
    const subjectLine = 'Password Reset Code - Action Required';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 2rem;
          }
          .header h1 {
            margin: 0;
            font-size: 1.5rem;
          }
          .code-box {
            background: #f8f9fa;
            padding: 2rem;
            border-radius: 8px;
            text-align: center;
            margin: 2rem 0;
            border: 2px dashed #e74c3c;
          }
          .reset-code {
            font-size: 2.5rem;
            font-weight: bold;
            color: #e74c3c;
            letter-spacing: 0.5rem;
            font-family: 'Courier New', monospace;
          }
          .warning-box {
            background: #fff3cd;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #f39c12;
            margin: 1rem 0;
          }
          .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #e9ecef;
            font-size: 0.9rem;
            color: #7f8c8d;
            text-align: center;
          }
          @media (max-width: 600px) {
            body { padding: 10px; }
            .container { padding: 1rem; }
            .reset-code { font-size: 2rem; letter-spacing: 0.3rem; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
            <p style="margin: 0; opacity: 0.9;">Your verification code is ready</p>
          </div>
          
          <p>Hi ${userName},</p>
          
          <p>We received a request to reset your password. Use the code below to complete the process:</p>
          
          <div class="code-box">
            <p style="margin: 0; font-size: 0.9rem; color: #7f8c8d; margin-bottom: 1rem;">Your Reset Code</p>
            <div class="reset-code">${resetCode}</div>
            <p style="margin: 1rem 0 0 0; font-size: 0.9rem; color: #7f8c8d;">This code expires in 15 minutes</p>
          </div>
          
          <div class="warning-box">
            <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email or contact support if you're concerned about your account security.
          </div>
          
          <p><strong>What to do next:</strong></p>
          <ul>
            <li>Enter this 6-digit code on the password reset page</li>
            <li>Create a new secure password</li>
            <li>The code will expire in 15 minutes</li>
          </ul>
          
          <p><strong>Security Tips:</strong></p>
          <ul>
            <li>Never share your reset code with anyone</li>
            <li>Choose a strong, unique password</li>
            <li>Use a combination of letters, numbers, and symbols</li>
          </ul>
          
          <div class="footer">
            <p>This is an automated security email.</p>
            <p>If you didn't request a password reset, no action is needed - your password remains secure.</p>
            <p>&copy; ${new Date().getFullYear()} Your Website. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Password Reset Request

Hi ${userName},

We received a request to reset your password. Use the code below to complete the process:

YOUR RESET CODE: ${resetCode}

This code expires in 15 minutes.

⚠️ Security Notice: If you didn't request this password reset, please ignore this email or contact support if you're concerned about your account security.

What to do next:
- Enter this 6-digit code on the password reset page
- Create a new secure password
- The code will expire in 15 minutes

Security Tips:
- Never share your reset code with anyone
- Choose a strong, unique password
- Use a combination of letters, numbers, and symbols

This is an automated security email.
If you didn't request a password reset, no action is needed - your password remains secure.

© ${new Date().getFullYear()} Your Website. All rights reserved.
    `;

    const msg = {
      to: userEmail,
      from: EMAIL_CONFIG.from,
      subject: subjectLine,
      text: textContent,
      html: htmlContent
    };

    await sgMail.send(msg);
    console.log(`Password reset email sent to ${userEmail}`);
    return { success: true };

  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset confirmation email
 */
export const sendPasswordResetConfirmation = async (userEmail, userName) => {
  try {
    const subjectLine = 'Password Successfully Reset';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Confirmation</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #27ae60, #229954);
            color: white;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 2rem;
          }
          .header h1 {
            margin: 0;
            font-size: 1.5rem;
          }
          .success-icon {
            font-size: 3rem;
            text-align: center;
            margin: 1rem 0;
          }
          .info-box {
            background: #d5f4e6;
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #27ae60;
            margin: 1.5rem 0;
          }
          .warning-box {
            background: #fff3cd;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #f39c12;
            margin: 1rem 0;
          }
          .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #e9ecef;
            font-size: 0.9rem;
            color: #7f8c8d;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Successful</h1>
          </div>
          
          <div class="success-icon">✅</div>
          
          <p>Hi ${userName},</p>
          
          <div class="info-box">
            <p style="margin: 0;"><strong>Your password has been successfully reset.</strong></p>
            <p style="margin: 0.5rem 0 0 0;">You can now log in to your account using your new password.</p>
          </div>
          
          <p><strong>What changed:</strong></p>
          <ul>
            <li>Your old password is no longer valid</li>
            <li>You can now use your new password to log in</li>
            <li>All active sessions have been maintained</li>
          </ul>
          
          <div class="warning-box">
            <strong>⚠️ Didn't make this change?</strong> If you didn't reset your password, your account may be compromised. Please contact our support team immediately.
          </div>
          
          <p><strong>Security Recommendations:</strong></p>
          <ul>
            <li>Don't reuse passwords across different websites</li>
            <li>Enable two-factor authentication for extra security</li>
            <li>Regularly update your password</li>
            <li>Never share your password with anyone</li>
          </ul>
          
          <div class="footer">
            <p>This is a security notification about your account.</p>
            <p>If you need help, please contact our support team.</p>
            <p>&copy; ${new Date().getFullYear()} Your Website. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Password Reset Successful

Hi ${userName},

✅ Your password has been successfully reset.

You can now log in to your account using your new password.

What changed:
- Your old password is no longer valid
- You can now use your new password to log in
- All active sessions have been maintained

⚠️ Didn't make this change? If you didn't reset your password, your account may be compromised. Please contact our support team immediately.

Security Recommendations:
- Don't reuse passwords across different websites
- Enable two-factor authentication for extra security
- Regularly update your password
- Never share your password with anyone

This is a security notification about your account.
If you need help, please contact our support team.

© ${new Date().getFullYear()} Your Website. All rights reserved.
    `;

    const msg = {
      to: userEmail,
      from: EMAIL_CONFIG.from,
      subject: subjectLine,
      text: textContent,
      html: htmlContent
    };

    await sgMail.send(msg);
    console.log(`Password reset confirmation sent to ${userEmail}`);
    return { success: true };

  } catch (error) {
    console.error('Error sending password reset confirmation:', error);
    return { success: false, error: error.message };
  }
};

// ADD THIS TO YOUR services/email-service.js file

/**
 * Send critical error alert to all super admins
 */
export const sendCriticalErrorAlert = async (errorDetails) => {
  try {
    const {
      errorId,
      errorType,
      errorMessage,
      requestPath,
      userId,
      userEmail,
      timestamp
    } = errorDetails;

    // Import pool to get super admin emails
    const { default: pool } = await import('../main.js');
    
    // Get all super admin emails
    const [admins] = await pool.execute(
      'SELECT email, name FROM users WHERE role = "super_admin" AND deleted_at IS NULL'
    );

    if (admins.length === 0) {
      console.log('⚠️  No super admins found to send critical error alert');
      return { success: false, message: 'No super admins found' };
    }

    const adminPanelUrl = `${process.env.FRONTEND_URL || 'https://yourwebsite.com'}/admin-error-logs.html`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Critical Error Alert</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 2rem;
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.9; }
          }
          .header h1 {
            margin: 0;
            font-size: 1.5rem;
          }
          .alert-badge {
            background: #fff;
            color: #e74c3c;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-weight: bold;
            display: inline-block;
            margin-top: 0.5rem;
          }
          .error-details {
            background: #fadbd8;
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #e74c3c;
            margin: 1.5rem 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.75rem;
            padding: 0.5rem 0;
            border-bottom: 1px solid #f8d7da;
          }
          .info-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
          }
          .label {
            font-weight: 600;
            color: #721c24;
          }
          .value {
            color: #856404;
            font-family: 'Courier New', monospace;
            word-break: break-all;
          }
          .error-message {
            background: #fff3cd;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
            border-left: 4px solid #ffc107;
          }
          .action-buttons {
            text-align: center;
            margin: 2rem 0;
          }
          .btn {
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
          }
          .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #e9ecef;
            font-size: 0.9rem;
            color: #7f8c8d;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 Critical Error Detected</h1>
            <div class="alert-badge">IMMEDIATE ATTENTION REQUIRED</div>
          </div>
          
          <p><strong>A critical error has occurred in the system that requires immediate attention.</strong></p>
          
          <div class="error-details">
            <h3 style="margin-top: 0; color: #721c24;">Error Information</h3>
            <div class="info-row">
              <span class="label">Error ID:</span>
              <span class="value">#${errorId}</span>
            </div>
            <div class="info-row">
              <span class="label">Error Type:</span>
              <span class="value">${errorType}</span>
            </div>
            <div class="info-row">
              <span class="label">Timestamp:</span>
              <span class="value">${new Date(timestamp).toLocaleString()}</span>
            </div>
            ${requestPath ? `
            <div class="info-row">
              <span class="label">Request Path:</span>
              <span class="value">${requestPath}</span>
            </div>
            ` : ''}
            ${userId ? `
            <div class="info-row">
              <span class="label">User ID:</span>
              <span class="value">${userId}</span>
            </div>
            ` : ''}
            ${userEmail ? `
            <div class="info-row">
              <span class="label">User Email:</span>
              <span class="value">${userEmail}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="error-message">
            <h4 style="margin-top: 0; color: #856404;">Error Message:</h4>
            <p style="margin-bottom: 0; font-family: 'Courier New', monospace;">${errorMessage}</p>
          </div>
          
          <div class="action-buttons">
            <a href="${adminPanelUrl}" class="btn">View in Admin Panel</a>
          </div>
          
          <p><strong>Recommended Actions:</strong></p>
          <ul>
            <li>Review the error details in the admin panel</li>
            <li>Check system logs for related issues</li>
            <li>Verify system resources and database connectivity</li>
            <li>Mark as resolved once fixed</li>
          </ul>
          
          <div class="footer">
            <p>This is an automated critical error alert sent to all super administrators.</p>
            <p>Error ID: #${errorId} | ${new Date(timestamp).toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
🚨 CRITICAL ERROR DETECTED 🚨

A critical error has occurred in the system that requires immediate attention.

Error Information:
- Error ID: #${errorId}
- Error Type: ${errorType}
- Timestamp: ${new Date(timestamp).toLocaleString()}
${requestPath ? `- Request Path: ${requestPath}` : ''}
${userId ? `- User ID: ${userId}` : ''}
${userEmail ? `- User Email: ${userEmail}` : ''}

Error Message:
${errorMessage}

View in Admin Panel: ${adminPanelUrl}

Recommended Actions:
- Review the error details in the admin panel
- Check system logs for related issues
- Verify system resources and database connectivity
- Mark as resolved once fixed

This is an automated critical error alert sent to all super administrators.
Error ID: #${errorId} | ${new Date(timestamp).toLocaleString()}
    `;

    // Send to all super admins
    const emailPromises = admins.map(admin => {
      const msg = {
        to: admin.email,
        from: EMAIL_CONFIG.from,
        subject: `🚨 CRITICAL ERROR #${errorId} - Immediate Action Required`,
        text: textContent,
        html: htmlContent
      };
      return sgMail.send(msg);
    });

    await Promise.all(emailPromises);
    
    console.log(`✅ Critical error alert sent to ${admins.length} super admin(s) for error #${errorId}`);
    return { success: true, sentTo: admins.length };

  } catch (error) {
    console.error('Error sending critical error alert:', error);
    return { success: false, error: error.message };
  }
};

// Add this function to your services/email-service.js file

/**
 * Send 2FA verification code email
 */
export const send2FACodeEmail = async (userEmail, userName, code) => {
  try {
    const subjectLine = 'Your Login Verification Code';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>2FA Verification Code</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 2rem;
          }
          .header h1 {
            margin: 0;
            font-size: 1.5rem;
          }
          .code-box {
            background: #f8f9fa;
            padding: 2rem;
            border-radius: 8px;
            text-align: center;
            margin: 2rem 0;
            border: 2px dashed #667eea;
          }
          .verification-code {
            font-size: 2.5rem;
            font-weight: bold;
            color: #667eea;
            letter-spacing: 0.5rem;
            font-family: 'Courier New', monospace;
          }
          .warning-box {
            background: #fff3cd;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #f39c12;
            margin: 1rem 0;
          }
          .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #e9ecef;
            font-size: 0.9rem;
            color: #7f8c8d;
            text-align: center;
          }
          @media (max-width: 600px) {
            body { padding: 10px; }
            .container { padding: 1rem; }
            .verification-code { font-size: 2rem; letter-spacing: 0.3rem; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Login Verification</h1>
            <p style="margin: 0; opacity: 0.9;">Your two-factor authentication code</p>
          </div>
          
          <p>Hi ${userName},</p>
          
          <p>You're attempting to sign in to your account. To complete the login process, please use the verification code below:</p>
          
          <div class="code-box">
            <p style="margin: 0; font-size: 0.9rem; color: #7f8c8d; margin-bottom: 1rem;">Your Verification Code</p>
            <div class="verification-code">${code}</div>
            <p style="margin: 1rem 0 0 0; font-size: 0.9rem; color: #7f8c8d;">This code expires in 15 minutes</p>
          </div>
          
          <div class="warning-box">
            <strong>⚠️ Security Notice:</strong> If you didn't attempt to log in, please ignore this email and consider changing your password. Someone may be trying to access your account.
          </div>
          
          <p><strong>Important:</strong></p>
          <ul>
            <li>Never share this code with anyone</li>
            <li>Our team will never ask for this code</li>
            <li>The code will expire in 15 minutes</li>
            <li>You can request a new code if needed</li>
          </ul>
          
          <div class="footer">
            <p>This is an automated security message.</p>
            <p>If you didn't request this code, no action is needed.</p>
            <p>&copy; ${new Date().getFullYear()} FARFETCH. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Login Verification Code

      Hi ${userName},

      You're attempting to sign in to your account. To complete the login process, please use the verification code below:

      YOUR VERIFICATION CODE: ${code}

      This code expires in 15 minutes.

      ⚠️ Security Notice: If you didn't attempt to log in, please ignore this email and consider changing your password. Someone may be trying to access your account.

      Important:
      - Never share this code with anyone
      - Our team will never ask for this code
      - The code will expire in 15 minutes
      - You can request a new code if needed

      This is an automated security message.
      If you didn't request this code, no action is needed.

      © ${new Date().getFullYear()} FARFETCH. All rights reserved.
    `;

    const msg = {
      to: userEmail,
      from: EMAIL_CONFIG.from,
      subject: subjectLine,
      text: textContent,
      html: htmlContent
    };

    await sgMail.send(msg);
    console.log(`2FA code email sent to ${userEmail}`);
    return { success: true };

  } catch (error) {
    console.error('Error sending 2FA code email:', error);
    return { success: false, error: error.message };
  }
};

export default {
  sendVerificationEmail,
  sendContactConfirmationEmail,
  sendContactNotificationToAdmin,
  sendNotificationEmail,
  testEmailConfiguration,
  sendPasswordResetEmail,
  sendPasswordResetConfirmation,
  sendCriticalErrorAlert,
  send2FACodeEmail
};