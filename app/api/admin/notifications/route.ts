/**
 * E14Z Admin Notification Channels Management API
 * Configure and test notification channels for alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { withLogging } from '@/lib/logging/middleware';
import { supabase } from '@/lib/supabase/client';

/**
 * GET /api/admin/notifications - Get notification channels and templates
 */
export const GET = withLogging(async (req: NextRequest) => {
  try {
    const isAdmin = await verifyAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get all notification channels
    const { data: channels, error } = await supabase
      .from('notification_channels')
      .select('*')
      .order('name');

    if (error) throw error;

    // Get channel templates and configuration options
    const channelTemplates = getNotificationChannelTemplates();

    const response = {
      channels: channels || [],
      templates: channelTemplates,
      supported_types: ['email', 'webhook', 'slack', 'discord', 'sms'],
      generated_at: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Notifications API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification channels' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/notifications - Create or test notification channel
 */
export const POST = withLogging(async (req: NextRequest) => {
  try {
    const isAdmin = await verifyAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, ...channelData } = body; // action: 'create' | 'test'

    if (action === 'test') {
      // Test notification channel
      const result = await testNotificationChannel(channelData);
      return NextResponse.json(result);
      
    } else if (action === 'create' || !action) {
      // Create notification channel
      const validatedChannel = validateChannelConfig(channelData);
      
      const { data: newChannel, error } = await supabase
        .from('notification_channels')
        .insert(validatedChannel)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        message: 'Notification channel created successfully',
        channel: newChannel
      });
      
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "create" or "test"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Create/test notification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
});

/**
 * Helper Functions
 */

async function verifyAdminAccess(req: NextRequest): Promise<boolean> {
  const adminKey = req.headers.get('x-admin-key');
  if (adminKey === process.env.ADMIN_API_KEY) {
    return true;
  }

  const forwardedFor = req.headers.get('x-forwarded-for');
  const isLocalhost = !forwardedFor || forwardedFor.includes('127.0.0.1') || forwardedFor.includes('localhost');
  
  return process.env.NODE_ENV === 'development' && isLocalhost;
}

function getNotificationChannelTemplates() {
  return {
    email: {
      name: 'Email Notifications',
      description: 'Send alerts via email using SMTP or email service',
      required_config: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'from_email', 'to_emails'],
      optional_config: ['smtp_secure', 'subject_prefix'],
      example_config: {
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_user: 'your-email@gmail.com',
        smtp_password: 'your-app-password',
        smtp_secure: true,
        from_email: 'alerts@e14z.com',
        to_emails: ['admin@example.com', 'devops@example.com'],
        subject_prefix: '[E14Z Alert]'
      }
    },
    
    slack: {
      name: 'Slack Notifications',
      description: 'Send alerts to Slack channels via webhook',
      required_config: ['webhook_url'],
      optional_config: ['channel', 'username', 'icon_emoji'],
      example_config: {
        webhook_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
        channel: '#alerts',
        username: 'E14Z Alert Bot',
        icon_emoji: ':warning:'
      }
    },
    
    discord: {
      name: 'Discord Notifications',
      description: 'Send alerts to Discord channels via webhook',
      required_config: ['webhook_url'],
      optional_config: ['username', 'avatar_url'],
      example_config: {
        webhook_url: 'https://discord.com/api/webhooks/YOUR/WEBHOOK/URL',
        username: 'E14Z Alerts',
        avatar_url: 'https://e14z.com/logo.png'
      }
    },
    
    webhook: {
      name: 'Generic Webhook',
      description: 'Send alerts to any HTTP endpoint',
      required_config: ['url'],
      optional_config: ['method', 'headers', 'auth_token'],
      example_config: {
        url: 'https://your-service.com/webhooks/alerts',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer your-token'
        },
        auth_token: 'your-auth-token'
      }
    },
    
    sms: {
      name: 'SMS Notifications',
      description: 'Send alerts via SMS using Twilio or similar service',
      required_config: ['service', 'account_sid', 'auth_token', 'from_number', 'to_numbers'],
      optional_config: ['service_url'],
      example_config: {
        service: 'twilio',
        account_sid: 'your-twilio-account-sid',
        auth_token: 'your-twilio-auth-token',
        from_number: '+1234567890',
        to_numbers: ['+1987654321', '+1567890123']
      }
    }
  };
}

function validateChannelConfig(channelData: any) {
  const { name, type, config, enabled = true } = channelData;

  if (!name || !type || !config) {
    throw new Error('Name, type, and config are required');
  }

  const templates = getNotificationChannelTemplates();
  const template = templates[type as keyof typeof templates];
  
  if (!template) {
    throw new Error(`Unsupported notification type: ${type}`);
  }

  // Validate required config fields
  for (const field of template.required_config) {
    if (!config[field]) {
      throw new Error(`Missing required config field: ${field}`);
    }
  }

  // Validate specific types
  if (type === 'email') {
    validateEmailConfig(config);
  } else if (type === 'slack' || type === 'discord') {
    validateWebhookURL(config.webhook_url, type);
  } else if (type === 'webhook') {
    validateWebhookURL(config.url, 'webhook');
  }

  return {
    name,
    type,
    config,
    enabled
  };
}

function validateEmailConfig(config: any) {
  // Validate email addresses
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(config.from_email)) {
    throw new Error('Invalid from_email address');
  }

  if (!Array.isArray(config.to_emails) || config.to_emails.length === 0) {
    throw new Error('to_emails must be a non-empty array');
  }

  for (const email of config.to_emails) {
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }
  }

  // Validate port
  if (config.smtp_port && (config.smtp_port < 1 || config.smtp_port > 65535)) {
    throw new Error('Invalid SMTP port number');
  }
}

function validateWebhookURL(url: string, type: string) {
  try {
    const parsedURL = new URL(url);
    
    if (!['http:', 'https:'].includes(parsedURL.protocol)) {
      throw new Error(`${type} webhook URL must use HTTP or HTTPS`);
    }

    // Additional validation for specific services
    if (type === 'slack' && !url.includes('hooks.slack.com')) {
      throw new Error('Invalid Slack webhook URL format');
    }

    if (type === 'discord' && !url.includes('discord.com/api/webhooks')) {
      throw new Error('Invalid Discord webhook URL format');
    }

  } catch (error) {
    throw new Error(`Invalid ${type} URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function testNotificationChannel(channelData: any) {
  try {
    const validatedChannel = validateChannelConfig(channelData);
    
    // Create test alert
    const testAlert = {
      rule_name: 'Test Alert',
      severity: 'info',
      message: 'This is a test alert to verify notification channel configuration',
      current_value: 42,
      threshold: 100,
      fired_at: new Date().toISOString(),
      metadata: {
        test: true,
        channel_name: validatedChannel.name
      }
    };

    // Send test notification
    const result = await sendTestNotification(validatedChannel, testAlert);
    
    return {
      success: true,
      message: 'Test notification sent successfully',
      result
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Test failed',
      details: error
    };
  }
}

async function sendTestNotification(channel: any, alert: any) {
  switch (channel.type) {
    case 'email':
      return await sendTestEmail(channel, alert);
    case 'slack':
      return await sendTestSlack(channel, alert);
    case 'discord':
      return await sendTestDiscord(channel, alert);
    case 'webhook':
      return await sendTestWebhook(channel, alert);
    case 'sms':
      return await sendTestSMS(channel, alert);
    default:
      throw new Error(`Unsupported channel type: ${channel.type}`);
  }
}

async function sendTestEmail(channel: any, alert: any) {
  // TODO: Implement actual email sending
  // For now, just validate configuration
  console.log('Test email would be sent:', {
    to: channel.config.to_emails,
    subject: `${channel.config.subject_prefix || '[E14Z Alert]'} ${alert.rule_name}`,
    body: alert.message
  });
  
  return { status: 'simulated', message: 'Email configuration validated (actual sending not implemented)' };
}

async function sendTestSlack(channel: any, alert: any) {
  const payload = {
    channel: channel.config.channel,
    username: channel.config.username || 'E14Z Alert Bot',
    icon_emoji: channel.config.icon_emoji || ':warning:',
    attachments: [{
      color: 'good',
      title: '🧪 Test Alert',
      text: alert.message,
      fields: [
        { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
        { title: 'Channel', value: channel.name, short: true },
        { title: 'Status', value: 'Test successful ✅', short: true }
      ]
    }]
  };

  const response = await fetch(channel.config.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
  }

  return { status: 'sent', response_status: response.status };
}

async function sendTestDiscord(channel: any, alert: any) {
  const embed = {
    title: '🧪 Test Alert',
    description: alert.message,
    color: 0x00ff00, // Green for test
    fields: [
      { name: 'Severity', value: alert.severity.toUpperCase(), inline: true },
      { name: 'Channel', value: channel.name, inline: true },
      { name: 'Status', value: 'Test successful ✅', inline: true }
    ],
    timestamp: new Date().toISOString()
  };

  const payload = {
    username: channel.config.username || 'E14Z Alerts',
    avatar_url: channel.config.avatar_url,
    embeds: [embed]
  };

  const response = await fetch(channel.config.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
  }

  return { status: 'sent', response_status: response.status };
}

async function sendTestWebhook(channel: any, alert: any) {
  const payload = {
    alert: {
      ...alert,
      test: true,
      channel_name: channel.name
    },
    timestamp: new Date().toISOString(),
    source: 'E14Z Alert Manager - Test'
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...channel.config.headers
  };

  if (channel.config.auth_token) {
    headers['Authorization'] = `Bearer ${channel.config.auth_token}`;
  }

  const response = await fetch(channel.config.url, {
    method: channel.config.method || 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
  }

  return { status: 'sent', response_status: response.status };
}

async function sendTestSMS(channel: any, alert: any) {
  // TODO: Implement actual SMS sending via Twilio or similar
  console.log('Test SMS would be sent:', {
    to: channel.config.to_numbers,
    message: `[E14Z Test] ${alert.message}`
  });
  
  return { status: 'simulated', message: 'SMS configuration validated (actual sending not implemented)' };
}