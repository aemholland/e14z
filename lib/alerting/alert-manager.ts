/**
 * E14Z Alert Management System
 * Monitors system health and sends notifications for critical issues
 */

import { supabase } from '@/lib/supabase/client';
import { securityLogger, performanceLogger } from '@/lib/logging/config';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  cooldown_minutes: number;
  notification_channels: string[];
  query: string;
  evaluation_window_minutes: number;
}

export interface Alert {
  id: string;
  rule_id: string;
  rule_name: string;
  severity: string;
  message: string;
  current_value: number;
  threshold: number;
  status: 'firing' | 'resolved';
  fired_at: string;
  resolved_at?: string;
  notification_sent: boolean;
  metadata: Record<string, any>;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'slack' | 'discord' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
}

export class AlertManager {
  private evaluationInterval: NodeJS.Timeout | null = null;
  private alertHistory: Map<string, Alert> = new Map();

  constructor(private options: {
    evaluationIntervalMs?: number;
    defaultCooldownMinutes?: number;
  } = {}) {
    this.options.evaluationIntervalMs = options.evaluationIntervalMs || 60000; // 1 minute
    this.options.defaultCooldownMinutes = options.defaultCooldownMinutes || 5;
  }

  /**
   * Start the alert monitoring system
   */
  async start() {
    performanceLogger.info({ event: 'alert_manager_starting' }, 'Starting Alert Manager');
    
    await this.loadDefaultAlertRules();
    
    // Start periodic evaluation
    this.evaluationInterval = setInterval(
      () => this.evaluateAllRules().catch(error => 
        securityLogger.error({ event: 'alert_evaluation_error', error: error.message }, 
          'Failed to evaluate alert rules')
      ),
      this.options.evaluationIntervalMs
    );
    
    performanceLogger.info({ event: 'alert_manager_started' }, 'Alert Manager started successfully');
  }

  /**
   * Stop the alert monitoring system
   */
  stop() {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }
    performanceLogger.info({ event: 'alert_manager_stopped' }, 'Alert Manager stopped');
  }

  /**
   * Load default alert rules for E14Z monitoring
   */
  private async loadDefaultAlertRules() {
    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds 10% over 5 minutes',
        metric: 'error_rate',
        condition: 'greater_than',
        threshold: 0.1,
        severity: 'critical',
        enabled: true,
        cooldown_minutes: 5,
        notification_channels: ['email', 'slack'],
        evaluation_window_minutes: 5,
        query: `
          SELECT 
            COUNT(CASE WHEN execution_success = false THEN 1 END)::float / COUNT(*) as error_rate
          FROM mcp_execution_analytics 
          WHERE execution_start_time >= NOW() - INTERVAL '5 minutes'
        `
      },
      {
        name: 'High Response Time',
        description: 'Alert when average response time exceeds 5 seconds',
        metric: 'avg_response_time',
        condition: 'greater_than',
        threshold: 5000,
        severity: 'warning',
        enabled: true,
        cooldown_minutes: 10,
        notification_channels: ['slack'],
        evaluation_window_minutes: 10,
        query: `
          SELECT AVG(execution_duration_ms) as avg_response_time
          FROM mcp_execution_analytics 
          WHERE execution_start_time >= NOW() - INTERVAL '10 minutes'
          AND execution_duration_ms IS NOT NULL
        `
      },
      {
        name: 'Low Request Volume',
        description: 'Alert when request volume drops significantly',
        metric: 'request_count',
        condition: 'less_than',
        threshold: 10,
        severity: 'warning',
        enabled: true,
        cooldown_minutes: 15,
        notification_channels: ['email'],
        evaluation_window_minutes: 15,
        query: `
          SELECT COUNT(*) as request_count
          FROM mcp_execution_analytics 
          WHERE execution_start_time >= NOW() - INTERVAL '15 minutes'
        `
      },
      {
        name: 'Database Connection Issues',
        description: 'Alert when database queries are failing',
        metric: 'db_error_rate',
        condition: 'greater_than',
        threshold: 0.05,
        severity: 'critical',
        enabled: true,
        cooldown_minutes: 2,
        notification_channels: ['email', 'slack', 'webhook'],
        evaluation_window_minutes: 5,
        query: `
          SELECT 
            COUNT(CASE WHEN execution_error LIKE '%database%' OR execution_error LIKE '%connection%' THEN 1 END)::float / COUNT(*) as db_error_rate
          FROM mcp_execution_analytics 
          WHERE execution_start_time >= NOW() - INTERVAL '5 minutes'
          AND execution_error IS NOT NULL
        `
      },
      {
        name: 'Memory Usage High',
        description: 'Alert when memory usage exceeds 80%',
        metric: 'memory_usage',
        condition: 'greater_than',
        threshold: 80,
        severity: 'warning',
        enabled: true,
        cooldown_minutes: 10,
        notification_channels: ['email'],
        evaluation_window_minutes: 5,
        query: `
          SELECT AVG(peak_memory_usage_mb) as memory_usage
          FROM mcp_execution_analytics 
          WHERE execution_start_time >= NOW() - INTERVAL '5 minutes'
          AND peak_memory_usage_mb IS NOT NULL
        `
      },
      {
        name: 'Failed Authentication Spike',
        description: 'Alert on potential security breach - many auth failures',
        metric: 'auth_failure_rate',
        condition: 'greater_than',
        threshold: 20,
        severity: 'critical',
        enabled: true,
        cooldown_minutes: 1,
        notification_channels: ['email', 'slack'],
        evaluation_window_minutes: 5,
        query: `
          SELECT COUNT(*) as auth_failure_rate
          FROM mcp_execution_analytics 
          WHERE execution_start_time >= NOW() - INTERVAL '5 minutes'
          AND execution_error_type = 'auth'
        `
      }
    ];

    // Store rules in database
    for (const rule of defaultRules) {
      await this.createOrUpdateAlertRule(rule);
    }
  }

  /**
   * Evaluate all enabled alert rules
   */
  private async evaluateAllRules() {
    try {
      const { data: rules } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('enabled', true);

      if (!rules) return;

      for (const rule of rules) {
        await this.evaluateRule(rule);
      }
    } catch (error) {
      securityLogger.error({ 
        event: 'alert_rule_evaluation_failed', 
        error: error instanceof Error ? error.message : String(error) 
      }, 'Failed to evaluate alert rules');
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateRule(rule: AlertRule) {
    try {
      // Check cooldown period
      if (await this.isInCooldown(rule.id)) {
        return;
      }

      // Execute the rule query
      const result = await this.executeRuleQuery(rule.query);
      
      if (!result || result.length === 0) {
        return;
      }

      const currentValue = result[0][rule.metric];
      if (currentValue === undefined || currentValue === null) {
        return;
      }

      // Evaluate condition
      const isTriggered = this.evaluateCondition(
        currentValue, 
        rule.condition, 
        rule.threshold
      );

      if (isTriggered) {
        await this.fireAlert(rule, currentValue);
      } else {
        await this.resolveAlert(rule.id);
      }

    } catch (error) {
      securityLogger.error({ 
        event: 'alert_rule_evaluation_error', 
        rule_id: rule.id,
        rule_name: rule.name,
        error: error instanceof Error ? error.message : String(error) 
      }, `Failed to evaluate rule: ${rule.name}`);
    }
  }

  /**
   * Execute a rule query against the database
   */
  private async executeRuleQuery(query: string): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('execute_alert_query', { query_text: query });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      // Fallback to direct query for simple cases
      throw error;
    }
  }

  /**
   * Evaluate if a condition is met
   */
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Fire an alert
   */
  private async fireAlert(rule: AlertRule, currentValue: number) {
    const alertId = `alert_${rule.id}_${Date.now()}`;
    
    const alert: Omit<Alert, 'id'> = {
      rule_id: rule.id,
      rule_name: rule.name,
      severity: rule.severity,
      message: `${rule.name}: ${rule.metric} is ${currentValue} (threshold: ${rule.threshold})`,
      current_value: currentValue,
      threshold: rule.threshold,
      status: 'firing',
      fired_at: new Date().toISOString(),
      notification_sent: false,
      metadata: {
        rule_description: rule.description,
        evaluation_window: rule.evaluation_window_minutes
      }
    };

    // Store alert
    await supabase.from('alerts').insert({ ...alert, id: alertId });
    
    // Send notifications
    await this.sendNotifications(rule, alert);
    
    // Update alert as notified
    await supabase
      .from('alerts')
      .update({ notification_sent: true })
      .eq('id', alertId);

    securityLogger.warn({
      event: 'alert_fired',
      alert_id: alertId,
      rule_name: rule.name,
      severity: rule.severity,
      current_value: currentValue,
      threshold: rule.threshold
    }, `Alert fired: ${rule.name}`);
  }

  /**
   * Resolve an alert
   */
  private async resolveAlert(ruleId: string) {
    const { data: activeAlerts } = await supabase
      .from('alerts')
      .select('*')
      .eq('rule_id', ruleId)
      .eq('status', 'firing');

    if (activeAlerts && activeAlerts.length > 0) {
      const now = new Date().toISOString();
      
      for (const alert of activeAlerts) {
        await supabase
          .from('alerts')
          .update({ 
            status: 'resolved',
            resolved_at: now
          })
          .eq('id', alert.id);

        performanceLogger.info({
          event: 'alert_resolved',
          alert_id: alert.id,
          rule_name: alert.rule_name,
          duration_ms: Date.now() - new Date(alert.fired_at).getTime()
        }, `Alert resolved: ${alert.rule_name}`);
      }
    }
  }

  /**
   * Check if rule is in cooldown period
   */
  private async isInCooldown(ruleId: string): Promise<boolean> {
    const { data: recentAlerts } = await supabase
      .from('alerts')
      .select('fired_at')
      .eq('rule_id', ruleId)
      .order('fired_at', { ascending: false })
      .limit(1);

    if (!recentAlerts || recentAlerts.length === 0) {
      return false;
    }

    const lastAlert = recentAlerts[0];
    const rule = await this.getRule(ruleId);
    
    if (!rule) return false;

    const cooldownMs = rule.cooldown_minutes * 60 * 1000;
    const timeSinceLastAlert = Date.now() - new Date(lastAlert.fired_at).getTime();
    
    return timeSinceLastAlert < cooldownMs;
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(rule: AlertRule, alert: Omit<Alert, 'id'>) {
    const { data: channels } = await supabase
      .from('notification_channels')
      .select('*')
      .eq('enabled', true)
      .in('type', rule.notification_channels);

    if (!channels) return;

    for (const channel of channels) {
      try {
        await this.sendNotification(channel, alert);
      } catch (error) {
        securityLogger.error({
          event: 'notification_send_failed',
          channel_id: channel.id,
          channel_type: channel.type,
          error: error instanceof Error ? error.message : String(error)
        }, `Failed to send notification via ${channel.type}`);
      }
    }
  }

  /**
   * Send notification via specific channel
   */
  private async sendNotification(channel: NotificationChannel, alert: Omit<Alert, 'id'>) {
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(channel, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel, alert);
        break;
      case 'slack':
        await this.sendSlackNotification(channel, alert);
        break;
      case 'discord':
        await this.sendDiscordNotification(channel, alert);
        break;
      case 'sms':
        await this.sendSMSNotification(channel, alert);
        break;
    }
  }

  /**
   * Notification implementations
   */
  private async sendEmailNotification(channel: NotificationChannel, alert: Omit<Alert, 'id'>) {
    // Email sending integration point for notifications
    console.log(`EMAIL ALERT: ${alert.message}`);
  }

  private async sendWebhookNotification(channel: NotificationChannel, alert: Omit<Alert, 'id'>) {
    const response = await fetch(channel.config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert: alert,
        timestamp: new Date().toISOString(),
        source: 'E14Z Alert Manager'
      })
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`);
    }
  }

  private async sendSlackNotification(channel: NotificationChannel, alert: Omit<Alert, 'id'>) {
    const color = alert.severity === 'critical' ? 'danger' : 'warning';
    
    const payload = {
      attachments: [{
        color: color,
        title: `🚨 ${alert.rule_name}`,
        text: alert.message,
        fields: [
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Current Value', value: alert.current_value.toString(), short: true },
          { title: 'Threshold', value: alert.threshold.toString(), short: true },
          { title: 'Time', value: new Date().toISOString(), short: true }
        ]
      }]
    };

    const response = await fetch(channel.config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.status}`);
    }
  }

  private async sendDiscordNotification(channel: NotificationChannel, alert: Omit<Alert, 'id'>) {
    const embed = {
      title: `🚨 ${alert.rule_name}`,
      description: alert.message,
      color: alert.severity === 'critical' ? 0xff0000 : 0xffa500,
      fields: [
        { name: 'Severity', value: alert.severity.toUpperCase(), inline: true },
        { name: 'Current Value', value: alert.current_value.toString(), inline: true },
        { name: 'Threshold', value: alert.threshold.toString(), inline: true }
      ],
      timestamp: new Date().toISOString()
    };

    const response = await fetch(channel.config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (!response.ok) {
      throw new Error(`Discord notification failed: ${response.status}`);
    }
  }

  private async sendSMSNotification(channel: NotificationChannel, alert: Omit<Alert, 'id'>) {
    // SMS sending integration point for notifications
    console.log(`SMS ALERT: ${alert.message}`);
  }

  /**
   * Utility methods
   */
  private async getRule(ruleId: string): Promise<AlertRule | null> {
    const { data } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('id', ruleId)
      .single();

    return data;
  }

  private async createOrUpdateAlertRule(rule: Omit<AlertRule, 'id'>): Promise<void> {
    const { data: existing } = await supabase
      .from('alert_rules')
      .select('id')
      .eq('name', rule.name)
      .single();

    if (existing) {
      await supabase
        .from('alert_rules')
        .update(rule)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('alert_rules')
        .insert(rule);
    }
  }
}

// Singleton instance
export const alertManager = new AlertManager();