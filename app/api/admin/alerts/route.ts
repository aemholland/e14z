/**
 * E14Z Admin Alerts Management API
 * Manage alert rules, active alerts, and notification channels
 */

import { NextRequest, NextResponse } from 'next/server';
import { withLogging } from '@/lib/logging/middleware';
import { supabase } from '@/lib/supabase/client';

/**
 * GET /api/admin/alerts - Get alerts overview
 */
export const GET = withLogging(async (req: NextRequest) => {
  try {
    // TODO: Add admin authentication check
    const isAdmin = await verifyAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all'; // all, firing, resolved
    const severity = searchParams.get('severity') || 'all'; // all, info, warning, critical
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query for alerts
    let alertsQuery = supabase
      .from('alerts')
      .select('*')
      .order('fired_at', { ascending: false })
      .limit(limit);

    if (status !== 'all') {
      alertsQuery = alertsQuery.eq('status', status);
    }

    if (severity !== 'all') {
      alertsQuery = alertsQuery.eq('severity', severity);
    }

    // Get alerts, alert rules, and notification channels in parallel
    const [
      { data: alerts, error: alertsError },
      { data: alertRules, error: rulesError },
      { data: notificationChannels, error: channelsError }
    ] = await Promise.all([
      alertsQuery,
      supabase.from('alert_rules').select('*').order('name'),
      supabase.from('notification_channels').select('*').order('name')
    ]);

    if (alertsError || rulesError || channelsError) {
      throw new Error('Failed to fetch alerts data');
    }

    // Get alert statistics
    const alertStats = await getAlertStatistics();

    const response = {
      alerts: alerts || [],
      alert_rules: alertRules || [],
      notification_channels: notificationChannels || [],
      statistics: alertStats,
      filters: {
        status,
        severity,
        limit
      },
      generated_at: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Admin alerts API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts data' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/alerts - Create alert rule or notification channel
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
    const { type, ...data } = body; // type: 'alert_rule' | 'notification_channel'

    if (type === 'alert_rule') {
      const { data: newRule, error } = await supabase
        .from('alert_rules')
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        message: 'Alert rule created successfully',
        alert_rule: newRule
      });

    } else if (type === 'notification_channel') {
      const { data: newChannel, error } = await supabase
        .from('notification_channels')
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        message: 'Notification channel created successfully',
        notification_channel: newChannel
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be "alert_rule" or "notification_channel"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Create alert/channel error:', error);
    return NextResponse.json(
      { error: 'Failed to create resource' },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/admin/alerts - Update alert rule or acknowledge alert
 */
export const PATCH = withLogging(async (req: NextRequest) => {
  try {
    const isAdmin = await verifyAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { type, id, action, ...updateData } = body;

    if (type === 'alert_rule') {
      const { data: updatedRule, error } = await supabase
        .from('alert_rules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        message: 'Alert rule updated successfully',
        alert_rule: updatedRule
      });

    } else if (type === 'alert' && action === 'acknowledge') {
      // Acknowledge an alert
      const { data: updatedAlert, error } = await supabase
        .from('alerts')
        .update({ 
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Record in alert history
      await supabase.from('alert_history').insert({
        alert_id: id,
        rule_id: updatedAlert.rule_id,
        action: 'acknowledged',
        performed_by: 'admin', // TODO: Get actual admin user
        notes: updateData.notes || 'Alert acknowledged via admin dashboard'
      });

      return NextResponse.json({
        message: 'Alert acknowledged successfully',
        alert: updatedAlert
      });

    } else if (type === 'notification_channel') {
      const { data: updatedChannel, error } = await supabase
        .from('notification_channels')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        message: 'Notification channel updated successfully',
        notification_channel: updatedChannel
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid type or action' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Update alert/channel error:', error);
    return NextResponse.json(
      { error: 'Failed to update resource' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/alerts - Delete alert rule or notification channel
 */
export const DELETE = withLogging(async (req: NextRequest) => {
  try {
    const isAdmin = await verifyAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'alert_rule' | 'notification_channel'
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Type and ID are required' },
        { status: 400 }
      );
    }

    if (type === 'alert_rule') {
      const { error } = await supabase
        .from('alert_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return NextResponse.json({
        message: 'Alert rule deleted successfully'
      });

    } else if (type === 'notification_channel') {
      const { error } = await supabase
        .from('notification_channels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return NextResponse.json({
        message: 'Notification channel deleted successfully'
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid type' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Delete alert/channel error:', error);
    return NextResponse.json(
      { error: 'Failed to delete resource' },
      { status: 500 }
    );
  }
});

/**
 * Helper Functions
 */

async function verifyAdminAccess(req: NextRequest): Promise<boolean> {
  // For now, check for admin API key
  const adminKey = req.headers.get('x-admin-key');
  if (adminKey === process.env.ADMIN_API_KEY) {
    return true;
  }

  // For development, allow localhost requests
  const forwardedFor = req.headers.get('x-forwarded-for');
  const isLocalhost = !forwardedFor || forwardedFor.includes('127.0.0.1') || forwardedFor.includes('localhost');
  
  return process.env.NODE_ENV === 'development' && isLocalhost;
}

async function getAlertStatistics() {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get alert counts with null safety
    const [
      { count: totalAlertsRaw },
      { count: firingAlertsRaw },
      { count: criticalAlertsRaw },
      { count: alerts24hRaw },
      { count: alertsWeekRaw }
    ] = await Promise.all([
      supabase.from('alerts').select('*', { count: 'exact', head: true }),
      supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'firing'),
      supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('severity', 'critical'),
      supabase.from('alerts').select('*', { count: 'exact', head: true }).gte('fired_at', last24h.toISOString()),
      supabase.from('alerts').select('*', { count: 'exact', head: true }).gte('fired_at', lastWeek.toISOString())
    ]);

    // Ensure counts are never null
    const totalAlerts = totalAlertsRaw ?? 0;
    const firingAlerts = firingAlertsRaw ?? 0;
    const criticalAlerts = criticalAlertsRaw ?? 0;
    const alerts24h = alerts24hRaw ?? 0;
    const alertsWeek = alertsWeekRaw ?? 0;

    // Get alert rules stats with null safety
    const { count: totalRulesRaw } = await supabase
      .from('alert_rules')
      .select('*', { count: 'exact', head: true });

    const { count: enabledRulesRaw } = await supabase
      .from('alert_rules')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true);

    // Get notification channels stats with null safety
    const { count: totalChannelsRaw } = await supabase
      .from('notification_channels')
      .select('*', { count: 'exact', head: true });

    const { count: enabledChannelsRaw } = await supabase
      .from('notification_channels')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true);

    // Ensure all counts are never null
    const totalRules = totalRulesRaw ?? 0;
    const enabledRules = enabledRulesRaw ?? 0;
    const totalChannels = totalChannelsRaw ?? 0;
    const enabledChannels = enabledChannelsRaw ?? 0;

    // Get top alerting rules
    const { data: topRules } = await supabase
      .from('alerts')
      .select('rule_name, rule_id')
      .gte('fired_at', lastWeek.toISOString())
      .order('fired_at', { ascending: false });

    const ruleFrequency = (topRules || []).reduce((acc, alert) => {
      if (alert.rule_name) {
        acc[alert.rule_name] = (acc[alert.rule_name] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const topAlertingRules = Object.entries(ruleFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ rule_name: name, alert_count: count }));

    return {
      total_alerts: totalAlerts,
      firing_alerts: firingAlerts,
      critical_alerts: criticalAlerts,
      alerts_24h: alerts24h,
      alerts_week: alertsWeek,
      total_rules: totalRules,
      enabled_rules: enabledRules,
      total_channels: totalChannels,
      enabled_channels: enabledChannels,
      top_alerting_rules: topAlertingRules,
      alert_frequency_24h: alerts24h / 24, // alerts per hour
      resolution_rate: totalAlerts > 0 ? ((totalAlerts - firingAlerts) / totalAlerts) : 1
    };
  } catch (error) {
    console.error('Error getting alert statistics:', error);
    return {
      total_alerts: 0,
      firing_alerts: 0,
      critical_alerts: 0,
      alerts_24h: 0,
      alerts_week: 0,
      total_rules: 0,
      enabled_rules: 0,
      total_channels: 0,
      enabled_channels: 0,
      top_alerting_rules: [],
      alert_frequency_24h: 0,
      resolution_rate: 1
    };
  }
}