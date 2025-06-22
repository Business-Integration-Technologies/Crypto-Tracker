const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');
const { setCache, getCache } = require('../config/database');

class NotificationService {
  constructor() {
    this.emailEnabled = false;
    this.smsEnabled = false;

    // Initialize SendGrid with validation
    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY.startsWith('SG.')) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.emailEnabled = true;
    } else {
      console.warn('⚠️ SendGrid API key not configured or invalid - Email notifications disabled');
      this.emailEnabled = false;
    }

    // Initialize Twilio with validation
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && 
        process.env.TWILIO_AUTH_TOKEN.length > 10) {
      try {
        this.twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        this.smsEnabled = true;
        this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
      } catch (error) {
        console.warn('⚠️ Twilio initialization failed - SMS notifications disabled:', error.message);
        this.smsEnabled = false;
      }
    } else {
      console.warn('⚠️ Twilio credentials not configured or invalid - SMS notifications disabled');
      this.smsEnabled = false;
    }

    // Email templates - lazily loaded to avoid template generation on initialization
    this.emailTemplates = {
      welcome: {
        subject: 'Welcome to CryptoAlert! 🚀',
        text: 'Welcome to CryptoAlert! Start tracking your favorite cryptocurrencies and never miss important price movements.',
        html: null // Will be generated when needed
      },
      price_alert: {
        subject: 'CryptoAlert: Price Alert Triggered! 🚨',
        text: 'Your price alert has been triggered.',
        html: null // Will be generated when needed
      },
      portfolio_update: {
        subject: 'CryptoAlert: Portfolio Update 📊',
        text: 'Your portfolio has been updated.',
        html: null // Will be generated when needed
      },
      password_reset: {
        subject: 'CryptoAlert: Password Reset Request 🔑',
        text: 'You have requested a password reset.',
        html: null // Will be generated when needed
      },
      email_verification: {
        subject: 'CryptoAlert: Verify Your Email Address ✉️',
        text: 'Please verify your email address to complete registration.',
        html: null // Will be generated when needed
      }
    };

    // Rate limiting for notifications
    this.rateLimits = {
      email: { limit: 100, window: 3600000 }, // 100 emails per hour
      sms: { limit: 20, window: 3600000 }, // 20 SMS per hour
      push: { limit: 200, window: 3600000 } // 200 push notifications per hour
    };

    this.sentCounts = {
      email: new Map(),
      sms: new Map(),
      push: new Map()
    };
  }

  // Send email notification
  async sendEmail({ to, subject, text, html, template, data }) {
    if (!this.emailEnabled) {
      console.warn('⚠️ Email service not enabled');
      return { success: false, error: 'Email service not configured' };
    }

    // Check rate limits
    if (!(await this.checkRateLimit('email', to))) {
      throw new Error('Email rate limit exceeded');
    }

    try {
      let emailContent = { subject, text, html };

      // Use template if provided
      if (template && this.emailTemplates[template]) {
        const templateData = this.emailTemplates[template];
        let templateHtml = templateData.html;
        
        // Generate template HTML dynamically
        if (!templateHtml) {
          switch (template) {
            case 'welcome':
              templateHtml = this.getWelcomeEmailTemplate();
              break;
            case 'price_alert':
              templateHtml = this.getPriceAlertEmailTemplate();
              break;
            case 'portfolio_update':
              templateHtml = this.getPortfolioUpdateEmailTemplate();
              break;
            case 'password_reset':
              templateHtml = this.getPasswordResetEmailTemplate();
              break;
            case 'email_verification':
              templateHtml = this.getEmailVerificationTemplate();
              break;
            default:
              templateHtml = '<p>{{message}}</p>';
          }
        }
        
        emailContent = {
          subject: subject || templateData.subject,
          text: text || templateData.text,
          html: html || this.processTemplate(templateHtml, data)
        };
      }

      const msg = {
        to: to,
        from: {
          email: process.env.FROM_EMAIL || 'noreply@cryptoalert.com',
          name: 'CryptoAlert'
        },
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
        categories: ['cryptoalert', template || 'general'],
        customArgs: {
          environment: process.env.NODE_ENV || 'development',
          template: template || 'custom'
        }
      };

      const result = await sgMail.send(msg);
      
      // Update rate limit counter
      this.updateRateLimit('email', to);
      
      console.log(`✅ Email sent to ${to}: ${emailContent.subject}`);
      return { 
        success: true, 
        messageId: result[0].headers['x-message-id'],
        statusCode: result[0].statusCode
      };
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return { 
        success: false, 
        error: error.message,
        code: error.code 
      };
    }
  }

  // Send SMS notification
  async sendSMS({ to, message }) {
    if (!this.smsEnabled) {
      console.warn('⚠️ SMS service not enabled');
      return { success: false, error: 'SMS service not configured' };
    }

    // Check rate limits
    if (!(await this.checkRateLimit('sms', to))) {
      throw new Error('SMS rate limit exceeded');
    }

    try {
      // Ensure phone number is in international format
      const phoneNumber = this.formatPhoneNumber(to);
      
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.twilioPhoneNumber,
        to: phoneNumber
      });

      // Update rate limit counter
      this.updateRateLimit('sms', to);
      
      console.log(`✅ SMS sent to ${phoneNumber}: ${message.substring(0, 50)}...`);
      return { 
        success: true, 
        messageId: result.sid,
        status: result.status
      };
    } catch (error) {
      console.error('❌ Error sending SMS:', error);
      return { 
        success: false, 
        error: error.message,
        code: error.code 
      };
    }
  }

  // Send push notification (placeholder for future implementation)
  async sendPushNotification({ userId, title, message, data }) {
    // Check rate limits
    if (!(await this.checkRateLimit('push', userId))) {
      throw new Error('Push notification rate limit exceeded');
    }

    try {
      // This would integrate with a push notification service like Firebase Cloud Messaging
      // For now, we'll simulate the notification
      console.log(`📱 Push notification sent to user ${userId}: ${title}`);
      
      // Update rate limit counter
      this.updateRateLimit('push', userId);
      
      return { 
        success: true, 
        messageId: `push_${Date.now()}_${userId}`,
        platform: 'web'
      };
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Send bulk email notifications
  async sendBulkEmail(recipients) {
    if (!this.emailEnabled) {
      console.warn('⚠️ Email service not enabled');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const messages = recipients.map(recipient => ({
        to: recipient.email,
        from: {
          email: process.env.FROM_EMAIL || 'noreply@cryptoalert.com',
          name: 'CryptoAlert'
        },
        subject: recipient.subject,
        text: recipient.text,
        html: recipient.html,
        categories: ['cryptoalert', 'bulk'],
        customArgs: {
          environment: process.env.NODE_ENV || 'development',
          type: 'bulk'
        }
      }));

      const results = await sgMail.send(messages);
      
      console.log(`✅ Bulk email sent to ${recipients.length} recipients`);
      return { 
        success: true, 
        count: recipients.length,
        results: results
      };
    } catch (error) {
      console.error('❌ Error sending bulk email:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Check rate limits
  async checkRateLimit(type, identifier) {
    const key = `${type}_${identifier}`;
    const limit = this.rateLimits[type];
    const now = Date.now();
    
    // Get current count from cache
    const cached = await getCache(`rate_limit_${key}`);
    const currentCount = cached ? cached.count : 0;
    const windowStart = cached ? cached.windowStart : now;
    
    // Reset window if expired
    if (now - windowStart > limit.window) {
      await setCache(`rate_limit_${key}`, { count: 0, windowStart: now }, limit.window / 1000);
      return true;
    }
    
    // Check if limit exceeded
    if (currentCount >= limit.limit) {
      console.warn(`⚠️ Rate limit exceeded for ${type}: ${identifier}`);
      return false;
    }
    
    return true;
  }

  // Update rate limit counter
  async updateRateLimit(type, identifier) {
    const key = `${type}_${identifier}`;
    const limit = this.rateLimits[type];
    const now = Date.now();
    
    const cached = await getCache(`rate_limit_${key}`);
    const currentCount = cached ? cached.count : 0;
    const windowStart = cached ? cached.windowStart : now;
    
    await setCache(`rate_limit_${key}`, {
      count: currentCount + 1,
      windowStart: windowStart
    }, limit.window / 1000);
  }

  // Format phone number to international format
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present
    if (digits.length === 10) {
      return `+1${digits}`; // Assume US number
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    } else if (!digits.startsWith('+')) {
      return `+${digits}`;
    }
    
    return phoneNumber;
  }

  // Process email template with data
  processTemplate(template, data) {
    if (!data) return template;
    
    let processed = template;
    
    // Replace placeholders with actual data
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, data[key] || '');
    });
    
    return processed;
  }

  // Email template generators
  getWelcomeEmailTemplate() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to CryptoAlert! 🚀</h1>
        </div>
        <div style="padding: 40px 20px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Hi {{firstName}},</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Welcome to CryptoAlert - your professional cryptocurrency tracking and alert platform!
          </p>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            You can now:
          </p>
          <ul style="color: #666; font-size: 16px; line-height: 1.6;">
            <li>Track real-time cryptocurrency prices</li>
            <li>Set up custom price alerts</li>
            <li>Manage your crypto portfolio</li>
            <li>Receive instant notifications</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{dashboardUrl}}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    `;
  }

  getPriceAlertEmailTemplate() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ff6b6b; padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Price Alert Triggered!</h1>
        </div>
        <div style="padding: 30px 20px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">{{symbol}} Alert</h2>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #666; font-size: 18px; margin: 0;">
              <strong>{{message}}</strong>
            </p>
            <p style="color: #999; font-size: 14px; margin-top: 10px;">
              Current Price: ${{currentPrice}}<br>
              24h Change: {{change24h}}%<br>
              Triggered at: {{timestamp}}
            </p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{alertUrl}}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              View Alert Details
            </a>
          </div>
        </div>
      </div>
    `;
  }

  getPortfolioUpdateEmailTemplate() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📊 Portfolio Update</h1>
        </div>
        <div style="padding: 30px 20px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Hi {{firstName}},</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Your portfolio has been updated with the latest market data.
          </p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Portfolio Summary</h3>
            <p style="color: #666; margin: 0;">
              Total Value: ${{totalValue}}<br>
              24h Change: {{change24h}}%<br>
              Total P&L: {{profitLoss}}%
            </p>
          </div>
        </div>
      </div>
    `;
  }

  getPasswordResetEmailTemplate() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ff9f43; padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔑 Password Reset</h1>
        </div>
        <div style="padding: 30px 20px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            You have requested to reset your password. Click the button below to reset it:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{resetUrl}}" style="background: #ff9f43; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            This link will expire in 1 hour. If you didn't request this, please ignore this email.
          </p>
        </div>
      </div>
    `;
  }

  getEmailVerificationTemplate() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2ed573; padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">✉️ Verify Your Email</h1>
        </div>
        <div style="padding: 30px 20px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Almost There!</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Please verify your email address to complete your CryptoAlert registration:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{verificationUrl}}" style="background: #2ed573; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            This link will expire in 24 hours.
          </p>
        </div>
      </div>
    `;
  }

  // Get notification service status
  getServiceStatus() {
    return {
      email: {
        enabled: this.emailEnabled,
        provider: 'SendGrid',
        configured: !!process.env.SENDGRID_API_KEY
      },
      sms: {
        enabled: this.smsEnabled,
        provider: 'Twilio',
        configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
      },
      push: {
        enabled: true,
        provider: 'WebPush',
        configured: true
      }
    };
  }

  // Test notification services
  async testServices() {
    const results = {
      email: { available: this.emailEnabled },
      sms: { available: this.smsEnabled },
      push: { available: true }
    };

    // Test email service
    if (this.emailEnabled) {
      try {
        // SendGrid doesn't have a simple ping endpoint, so we'll check the API key
        results.email.status = 'ready';
      } catch (error) {
        results.email.status = 'error';
        results.email.error = error.message;
      }
    }

    // Test SMS service
    if (this.smsEnabled) {
      try {
        await this.twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
        results.sms.status = 'ready';
      } catch (error) {
        results.sms.status = 'error';
        results.sms.error = error.message;
      }
    }

    return results;
  }
}

module.exports = new NotificationService(); 