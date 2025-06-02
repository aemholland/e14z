/**
 * E14Z Optimized Analytics Query Engine
 * High-performance analytics queries using aggregated data and caching
 */

import { supabase } from '@/lib/supabase/client';
import { performanceLogger } from '@/lib/logging/config';

export interface AnalyticsQueryOptions {
  mcp_id?: string;
  timeframe?: '1h' | '24h' | '7d' | '30d' | '90d';
  useCache?: boolean;
  useAggregates?: boolean;
  includeRealTime?: boolean;
}

export interface PerformanceMetrics {
  total_executions: number;
  success_rate: number;
  avg_execution_time: number;
  p50_execution_time?: number;
  p95_execution_time?: number;
  p99_execution_time?: number;
  unique_users: number;
  error_rate: number;
  cache_hit_rate?: number;
}

export interface GeographicData {
  country_code: string;
  request_count: number;
  unique_users: number;
  avg_response_time: number;
  success_rate: number;
}

export interface TrendData {
  timestamp: string;
  value: number;
  trend_percent?: number;
}

export class OptimizedAnalyticsEngine {
  private cachePrefix = 'analytics:';
  private defaultCacheTTL = 900; // 15 minutes

  /**
   * Get MCP performance metrics using optimized queries
   */
  async getMCPPerformanceMetrics(
    mcpId: string, 
    timeframe: string = '7d',
    options: AnalyticsQueryOptions = {}
  ): Promise<PerformanceMetrics | null> {
    const cacheKey = `${this.cachePrefix}performance:${mcpId}:${timeframe}`;
    
    try {
      // Try cache first if enabled
      if (options.useCache !== false) {
        const cached = await this.getCachedResult(cacheKey);
        if (cached) {
          performanceLogger.info({
            event: 'analytics_cache_hit',
            cache_key: cacheKey,
            mcp_id: mcpId
          }, 'Analytics cache hit');
          return cached;
        }
      }

      const startTime = Date.now();
      let result: PerformanceMetrics | null = null;

      // Use aggregated data for longer timeframes
      if (options.useAggregates !== false && ['7d', '30d', '90d'].includes(timeframe)) {
        result = await this.getPerformanceFromAggregates(mcpId, timeframe);
      } else {
        result = await this.getPerformanceFromRawData(mcpId, timeframe);
      }

      const queryTime = Date.now() - startTime;
      
      performanceLogger.info({
        event: 'analytics_query_completed',
        mcp_id: mcpId,
        timeframe,
        query_time_ms: queryTime,
        used_aggregates: options.useAggregates !== false && ['7d', '30d', '90d'].includes(timeframe)
      }, `Analytics query completed in ${queryTime}ms`);

      // Cache the result
      if (result && options.useCache !== false) {
        await this.setCachedResult(cacheKey, result, this.defaultCacheTTL);
      }

      return result;
    } catch (error) {
      performanceLogger.error({
        event: 'analytics_query_failed',
        mcp_id: mcpId,
        timeframe,
        error: error instanceof Error ? error.message : String(error)
      }, 'Analytics query failed');
      return null;
    }
  }

  /**
   * Get performance metrics from aggregated tables (faster for longer timeframes)
   */
  private async getPerformanceFromAggregates(
    mcpId: string, 
    timeframe: string
  ): Promise<PerformanceMetrics | null> {
    const days = this.getTimeframeDays(timeframe);
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Query from daily aggregates for longer timeframes
    if (days >= 7) {
      const { data, error } = await supabase
        .from('mcp_daily_aggregates')
        .select(`
          total_executions,
          successful_executions,
          failed_executions,
          unique_users,
          avg_execution_time_ms,
          p50_execution_time_ms,
          p95_execution_time_ms,
          p99_execution_time_ms
        `)
        .eq('mcp_id', mcpId)
        .gte('date', cutoffDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      return this.aggregateMetrics(data);
    }

    // Query from hourly aggregates for shorter timeframes
    const { data, error } = await supabase
      .from('mcp_usage_aggregates')
      .select(`
        total_executions,
        successful_executions,
        failed_executions,
        unique_users,
        avg_execution_time_ms,
        p50_execution_time_ms,
        p95_execution_time_ms,
        p99_execution_time_ms,
        cache_hit_rate,
        error_rate
      `)
      .eq('mcp_id', mcpId)
      .gte('date', cutoffDate.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .order('hour', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return null;

    return this.aggregateMetrics(data);
  }

  /**
   * Get performance metrics from raw analytics data (for real-time or short timeframes)
   */
  private async getPerformanceFromRawData(
    mcpId: string, 
    timeframe: string
  ): Promise<PerformanceMetrics | null> {
    const hours = this.getTimeframeHours(timeframe);
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Use optimized query with proper indexes
    const { data, error } = await supabase
      .from('mcp_execution_analytics')
      .select(`
        execution_success,
        execution_duration_ms,
        user_id,
        ip_address,
        cache_hit
      `)
      .eq('mcp_id', mcpId)
      .gte('execution_start_time', cutoffTime.toISOString())
      .order('execution_start_time', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return null;

    return this.calculateMetricsFromRaw(data);
  }

  /**
   * Get time series data for charts
   */
  async getTimeSeriesData(
    mcpId: string,
    metric: 'executions' | 'response_time' | 'error_rate' | 'users',
    timeframe: string = '24h',
    granularity: 'hour' | 'day' = 'hour'
  ): Promise<TrendData[]> {
    const cacheKey = `${this.cachePrefix}timeseries:${mcpId}:${metric}:${timeframe}:${granularity}`;
    
    // Try cache first
    const cached = await this.getCachedResult(cacheKey);
    if (cached) return cached;

    let query;
    const days = this.getTimeframeDays(timeframe);
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    if (granularity === 'hour') {
      // Use hourly aggregates
      query = supabase
        .from('mcp_usage_aggregates')
        .select(`
          date,
          hour,
          total_executions,
          avg_execution_time_ms,
          error_rate,
          unique_users
        `)
        .eq('mcp_id', mcpId)
        .gte('date', cutoffDate.toISOString().split('T')[0])
        .order('date', { ascending: true })
        .order('hour', { ascending: true });
    } else {
      // Use daily aggregates
      query = supabase
        .from('mcp_daily_aggregates')
        .select(`
          date,
          total_executions,
          avg_execution_time_ms,
          unique_users
        `)
        .eq('mcp_id', mcpId)
        .gte('date', cutoffDate.toISOString().split('T')[0])
        .order('date', { ascending: true });
    }

    const { data, error } = await query;
    if (error) throw error;

    const result = this.formatTimeSeriesData(data || [], metric, granularity);
    
    // Cache for 5 minutes
    await this.setCachedResult(cacheKey, result, 300);
    
    return result;
  }

  /**
   * Get geographic distribution using materialized view
   */
  async getGeographicDistribution(timeframe: string = '7d'): Promise<GeographicData[]> {
    const cacheKey = `${this.cachePrefix}geographic:${timeframe}`;
    
    // Try cache first
    const cached = await this.getCachedResult(cacheKey);
    if (cached) return cached;

    // Use materialized view for 7d, otherwise query aggregates
    if (timeframe === '7d') {
      const { data, error } = await supabase
        .from('mv_geographic_distribution')
        .select('*')
        .order('request_count', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      const result = data || [];
      await this.setCachedResult(cacheKey, result, 600); // 10 minutes
      return result;
    }

    // For other timeframes, query raw data with time filter
    const days = this.getTimeframeDays(timeframe);
    const cutoffTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .rpc('get_geographic_stats', {
        start_time: cutoffTime.toISOString(),
        end_time: new Date().toISOString()
      });

    if (error) throw error;
    
    const result = data || [];
    await this.setCachedResult(cacheKey, result, 600);
    return result;
  }

  /**
   * Get top performing MCPs using materialized view
   */
  async getTopMCPs(limit: number = 10): Promise<any[]> {
    const cacheKey = `${this.cachePrefix}top_mcps:${limit}`;
    
    const cached = await this.getCachedResult(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('mv_top_mcps_by_usage')
      .select('*')
      .order('total_executions', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    const result = data || [];
    await this.setCachedResult(cacheKey, result, 300); // 5 minutes
    return result;
  }

  /**
   * Get error analysis using materialized view
   */
  async getErrorAnalysis(): Promise<any[]> {
    const cacheKey = `${this.cachePrefix}errors:24h`;
    
    const cached = await this.getCachedResult(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('mv_error_analysis')
      .select('*')
      .order('error_count', { ascending: false });

    if (error) throw error;
    
    const result = data || [];
    await this.setCachedResult(cacheKey, result, 300); // 5 minutes
    return result;
  }

  /**
   * Trigger aggregate updates for real-time data
   */
  async updateAggregates(mcpId?: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_hourly_aggregates', {
        target_mcp_id: mcpId || null,
        target_date: new Date().toISOString().split('T')[0],
        target_hour: new Date().getHours()
      });

      if (error) throw error;

      performanceLogger.info({
        event: 'aggregates_updated',
        mcp_id: mcpId || 'all'
      }, 'Analytics aggregates updated');
    } catch (error) {
      performanceLogger.error({
        event: 'aggregates_update_failed',
        mcp_id: mcpId || 'all',
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to update aggregates');
    }
  }

  /**
   * Refresh materialized views
   */
  async refreshMaterializedViews(): Promise<void> {
    try {
      const { error } = await supabase.rpc('refresh_analytics_views');
      
      if (error) throw error;

      performanceLogger.info({
        event: 'materialized_views_refreshed'
      }, 'Materialized views refreshed');
    } catch (error) {
      performanceLogger.error({
        event: 'materialized_views_refresh_failed',
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to refresh materialized views');
    }
  }

  // Private helper methods

  private async getCachedResult(key: string): Promise<any> {
    try {
      const { data } = await supabase.rpc('get_cached_analytics', { key });
      return data || null;
    } catch (error) {
      return null;
    }
  }

  private async setCachedResult(key: string, data: any, ttl: number): Promise<void> {
    try {
      await supabase.rpc('set_cached_analytics', {
        key,
        data: JSON.stringify(data),
        ttl_seconds: ttl
      });
    } catch (error) {
      // Cache failures shouldn't break the main functionality
      performanceLogger.warn({
        event: 'cache_set_failed',
        cache_key: key,
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to set cache');
    }
  }

  private getTimeframeDays(timeframe: string): number {
    switch (timeframe) {
      case '1h': return 1/24;
      case '24h': return 1;
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      default: return 7;
    }
  }

  private getTimeframeHours(timeframe: string): number {
    switch (timeframe) {
      case '1h': return 1;
      case '24h': return 24;
      case '7d': return 24 * 7;
      case '30d': return 24 * 30;
      case '90d': return 24 * 90;
      default: return 24 * 7;
    }
  }

  private aggregateMetrics(data: any[]): PerformanceMetrics {
    const totalExecutions = data.reduce((sum, row) => sum + (row.total_executions || 0), 0);
    const successfulExecutions = data.reduce((sum, row) => sum + (row.successful_executions || 0), 0);
    const failedExecutions = data.reduce((sum, row) => sum + (row.failed_executions || 0), 0);

    // Weighted averages for response times
    const totalTime = data.reduce((sum, row) => 
      sum + (row.avg_execution_time_ms || 0) * (row.total_executions || 0), 0);
    const avgExecutionTime = totalExecutions > 0 ? totalTime / totalExecutions : 0;

    // Use the most recent percentile data (latest day/hour)
    const latestData = data[0] || {};

    return {
      total_executions: totalExecutions,
      success_rate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      avg_execution_time: Math.round(avgExecutionTime),
      p50_execution_time: latestData.p50_execution_time_ms,
      p95_execution_time: latestData.p95_execution_time_ms,
      p99_execution_time: latestData.p99_execution_time_ms,
      unique_users: Math.max(...data.map(row => row.unique_users || 0)),
      error_rate: totalExecutions > 0 ? failedExecutions / totalExecutions : 0,
      cache_hit_rate: latestData.cache_hit_rate
    };
  }

  private calculateMetricsFromRaw(data: any[]): PerformanceMetrics {
    const totalExecutions = data.length;
    const successfulExecutions = data.filter(row => row.execution_success).length;
    const executionTimes = data
      .map(row => row.execution_duration_ms)
      .filter(time => time !== null && time !== undefined)
      .sort((a, b) => a - b);

    const uniqueUsers = new Set(
      data.map(row => row.user_id || row.ip_address).filter(id => id)
    ).size;

    const cacheHits = data.filter(row => row.cache_hit).length;

    return {
      total_executions: totalExecutions,
      success_rate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      avg_execution_time: executionTimes.length > 0 
        ? Math.round(executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length)
        : 0,
      p50_execution_time: this.calculatePercentile(executionTimes, 0.5),
      p95_execution_time: this.calculatePercentile(executionTimes, 0.95),
      p99_execution_time: this.calculatePercentile(executionTimes, 0.99),
      unique_users: uniqueUsers,
      error_rate: totalExecutions > 0 ? (totalExecutions - successfulExecutions) / totalExecutions : 0,
      cache_hit_rate: totalExecutions > 0 ? cacheHits / totalExecutions : 0
    };
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number | undefined {
    if (sortedArray.length === 0) return undefined;
    
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private formatTimeSeriesData(data: any[], metric: string, granularity: 'hour' | 'day'): TrendData[] {
    return data.map((row, index) => {
      let timestamp: string;
      let value: number;

      if (granularity === 'hour') {
        timestamp = `${row.date}T${String(row.hour).padStart(2, '0')}:00:00Z`;
      } else {
        timestamp = `${row.date}T00:00:00Z`;
      }

      switch (metric) {
        case 'executions':
          value = row.total_executions || 0;
          break;
        case 'response_time':
          value = row.avg_execution_time_ms || 0;
          break;
        case 'error_rate':
          value = row.error_rate || 0;
          break;
        case 'users':
          value = row.unique_users || 0;
          break;
        default:
          value = 0;
      }

      // Calculate trend if we have previous data
      let trend_percent: number | undefined;
      if (index > 0 && data[index - 1]) {
        const prevValue = data[index - 1][this.getMetricField(metric)] || 0;
        if (prevValue > 0) {
          trend_percent = ((value - prevValue) / prevValue) * 100;
        }
      }

      return {
        timestamp,
        value,
        trend_percent
      };
    });
  }

  private getMetricField(metric: string): string {
    switch (metric) {
      case 'executions': return 'total_executions';
      case 'response_time': return 'avg_execution_time_ms';
      case 'error_rate': return 'error_rate';
      case 'users': return 'unique_users';
      default: return 'total_executions';
    }
  }
}

export const optimizedAnalytics = new OptimizedAnalyticsEngine();