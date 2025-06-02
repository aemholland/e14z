/**
 * E14Z Comprehensive Analytics Collection System
 * 
 * Captures detailed MCP usage intelligence for monetization and developer insights.
 * This data becomes a premium offering for MCP developers.
 */

import { supabase } from '@/lib/supabase/client';
import { performanceLogger } from '@/lib/logging/config';

// Comprehensive analytics event types
export interface MCPExecutionAnalytics {
  // Core Identification
  session_id: string;
  execution_id: string;
  mcp_id: string;
  mcp_slug: string;
  mcp_version?: string;
  
  // User Intelligence
  user_id?: string;
  user_tier: 'anonymous' | 'community' | 'verified' | 'enterprise';
  user_agent: string;
  ip_address: string;
  country_code?: string;
  city?: string;
  timezone?: string;
  
  // Discovery Journey Analytics
  discovery_session_id?: string;
  discovery_query?: string;
  discovery_rank?: number; // Position in search results
  time_from_discovery_to_execution?: number; // milliseconds
  referrer_source?: 'search' | 'direct' | 'api' | 'cli' | 'web';
  
  // Pre-Execution Intelligence
  installation_method: 'cached' | 'npm' | 'pip' | 'git' | 'docker';
  installation_duration_ms?: number;
  installation_success: boolean;
  installation_error?: string;
  cache_hit: boolean;
  dependencies_installed?: string[];
  
  // Execution Performance
  execution_start_time: string;
  execution_end_time?: string;
  execution_duration_ms?: number;
  execution_success: boolean;
  execution_error?: string;
  execution_error_type?: 'auth' | 'timeout' | 'crash' | 'network' | 'security';
  
  // Resource Usage (captured from sandbox)
  peak_memory_usage_mb?: number;
  cpu_usage_percent?: number;
  network_requests_count?: number;
  file_operations_count?: number;
  
  // Tool Usage Intelligence
  tools_available: number;
  tools_used?: string[];
  tool_call_count?: number;
  most_used_tool?: string;
  tool_success_rates?: Record<string, number>;
  
  // Business Intelligence
  use_case_detected?: string;
  complexity_score?: number; // 1-10 based on tools used, duration, etc.
  user_satisfaction_inferred?: number; // Based on completion, errors, etc.
  repeat_user: boolean;
  session_length_total_ms?: number;
  
  // Technical Environment
  node_version?: string;
  python_version?: string;
  operating_system: string;
  architecture: string;
  container_environment?: boolean;
  
  // Authentication & Security
  auth_method_used?: string;
  auth_success?: boolean;
  security_violations?: string[];
  rate_limit_encountered?: boolean;
  
  // Output Intelligence
  output_size_bytes?: number;
  output_type?: 'json' | 'text' | 'binary' | 'stream';
  output_contains_errors?: boolean;
  
  // Timing Intelligence
  time_of_day: string;
  day_of_week: string;
  is_business_hours: boolean;
  
  // Quality Metrics
  execution_quality_score?: number; // 1-100 based on success, performance, etc.
  user_experience_score?: number; // 1-100 based on speed, errors, etc.
  
  // Revenue Attribution
  cost_center?: string; // For enterprise customers
  project_id?: string; // For enterprise customers
  billing_category?: 'free' | 'community' | 'verified' | 'enterprise';
}

export interface MCPUsageAggregates {
  mcp_id: string;
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
  
  // Volume Metrics
  total_executions: number;
  unique_users: number;
  success_rate: number;
  
  // Performance Metrics
  avg_execution_time_ms: number;
  p95_execution_time_ms: number;
  avg_installation_time_ms: number;
  cache_hit_rate: number;
  
  // Quality Metrics
  avg_quality_score: number;
  avg_user_experience_score: number;
  error_rate: number;
  
  // Geographic Distribution
  top_countries: string[];
  top_cities: string[];
  
  // User Intelligence
  new_user_percentage: number;
  repeat_user_percentage: number;
  enterprise_usage_percentage: number;
  
  // Business Intelligence
  revenue_potential_score: number;
  trending_score: number;
  competitive_rank?: number;
}

export class ComprehensiveAnalyticsCollector {
  private sessionMetrics: Map<string, Partial<MCPExecutionAnalytics>> = new Map();
  
  /**
   * Start tracking an MCP execution session
   */
  async startExecutionTracking(
    sessionId: string,
    mcpSlug: string,
    mcpId: string,
    userContext: any,
    discoveryContext?: any
  ): Promise<string> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const baseAnalytics: Partial<MCPExecutionAnalytics> = {
      session_id: sessionId,
      execution_id: executionId,
      mcp_id: mcpId,
      mcp_slug: mcpSlug,
      
      // User Intelligence
      user_id: userContext.userId,
      user_tier: userContext.tier || 'anonymous',
      user_agent: userContext.userAgent,
      ip_address: userContext.ipAddress,
      country_code: await this.getCountryFromIP(userContext.ipAddress),
      timezone: userContext.timezone,
      
      // Discovery Context
      discovery_session_id: discoveryContext?.sessionId,
      discovery_query: discoveryContext?.query,
      discovery_rank: discoveryContext?.rank,
      time_from_discovery_to_execution: discoveryContext?.timeSinceDiscovery,
      referrer_source: userContext.source,
      
      // Timing
      execution_start_time: new Date().toISOString(),
      time_of_day: new Date().toTimeString().split(' ')[0],
      day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      is_business_hours: this.isBusinessHours(),
      
      // Technical Environment
      operating_system: userContext.os || process.platform,
      architecture: userContext.arch || process.arch,
      node_version: process.version,
      
      // Initialize tracking
      repeat_user: await this.isRepeatUser(userContext.userId || userContext.ipAddress),
      billing_category: this.getBillingCategory(userContext.tier),
    };
    
    this.sessionMetrics.set(executionId, baseAnalytics);
    
    // Log the session start
    performanceLogger.info({
      event: 'mcp_execution_started',
      execution_id: executionId,
      mcp_slug: mcpSlug,
      user_tier: baseAnalytics.user_tier,
    }, `Started tracking MCP execution: ${mcpSlug}`);
    
    return executionId;
  }
  
  /**
   * Track installation phase
   */
  async trackInstallation(
    executionId: string,
    installationData: {
      method: string;
      success: boolean;
      duration: number;
      cacheHit: boolean;
      dependencies?: string[];
      error?: string;
    }
  ) {
    const analytics = this.sessionMetrics.get(executionId);
    if (!analytics) return;
    
    Object.assign(analytics, {
      installation_method: installationData.method,
      installation_success: installationData.success,
      installation_duration_ms: installationData.duration,
      cache_hit: installationData.cacheHit,
      dependencies_installed: installationData.dependencies,
      installation_error: installationData.error,
    });
    
    this.sessionMetrics.set(executionId, analytics);
  }
  
  /**
   * Track execution performance and resource usage
   */
  async trackExecution(
    executionId: string,
    executionData: {
      success: boolean;
      duration: number;
      error?: string;
      errorType?: string;
      resourceUsage?: {
        peakMemoryMB: number;
        cpuPercent: number;
        networkRequests: number;
        fileOperations: number;
      };
      toolsUsed?: string[];
      outputSize?: number;
      outputType?: string;
    }
  ) {
    const analytics = this.sessionMetrics.get(executionId);
    if (!analytics) return;
    
    Object.assign(analytics, {
      execution_end_time: new Date().toISOString(),
      execution_duration_ms: executionData.duration,
      execution_success: executionData.success,
      execution_error: executionData.error,
      execution_error_type: executionData.errorType,
      
      // Resource usage
      peak_memory_usage_mb: executionData.resourceUsage?.peakMemoryMB,
      cpu_usage_percent: executionData.resourceUsage?.cpuPercent,
      network_requests_count: executionData.resourceUsage?.networkRequests,
      file_operations_count: executionData.resourceUsage?.fileOperations,
      
      // Tool usage
      tools_used: executionData.toolsUsed,
      tool_call_count: executionData.toolsUsed?.length || 0,
      most_used_tool: this.getMostUsedTool(executionData.toolsUsed),
      
      // Output analysis
      output_size_bytes: executionData.outputSize,
      output_type: executionData.outputType,
      output_contains_errors: executionData.error ? true : false,
      
      // Quality scoring
      execution_quality_score: this.calculateQualityScore(executionData),
      user_experience_score: this.calculateUserExperienceScore(executionData),
    });
    
    this.sessionMetrics.set(executionId, analytics);
  }
  
  /**
   * Complete the execution tracking and persist to database
   */
  async completeExecutionTracking(executionId: string): Promise<void> {
    const analytics = this.sessionMetrics.get(executionId);
    if (!analytics) return;
    
    // Calculate final metrics
    const finalAnalytics: MCPExecutionAnalytics = {
      ...analytics,
      complexity_score: this.calculateComplexityScore(analytics),
      user_satisfaction_inferred: this.inferUserSatisfaction(analytics),
    } as MCPExecutionAnalytics;
    
    try {
      // Store detailed analytics
      await supabase.from('mcp_execution_analytics').insert(finalAnalytics);
      
      // Update aggregated metrics
      await this.updateAggregatedMetrics(finalAnalytics);
      
      // Store business intelligence insights
      await this.updateBusinessIntelligence(finalAnalytics);
      
      performanceLogger.info({
        event: 'mcp_execution_completed',
        execution_id: executionId,
        mcp_slug: analytics.mcp_slug,
        success: analytics.execution_success,
        duration: analytics.execution_duration_ms,
        quality_score: finalAnalytics.execution_quality_score,
      }, `Completed tracking MCP execution: ${analytics.mcp_slug}`);
      
    } catch (error) {
      performanceLogger.error({
        event: 'analytics_storage_failed',
        execution_id: executionId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to store execution analytics');
    } finally {
      // Clean up memory
      this.sessionMetrics.delete(executionId);
    }
  }
  
  /**
   * Get comprehensive analytics for an MCP (for developer dashboard)
   */
  async getMCPAnalytics(
    mcpId: string, 
    timeframe: '24h' | '7d' | '30d' | '90d' = '7d',
    userTier: string = 'community'
  ) {
    const hoursBack = this.getHoursBack(timeframe);
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    
    // Base analytics available to all developers
    const baseQuery = supabase
      .from('mcp_execution_analytics')
      .select('*')
      .eq('mcp_id', mcpId)
      .gte('execution_start_time', cutoffTime);
    
    const { data: executions, error } = await baseQuery;
    if (error || !executions) return null;
    
    const analytics = {
      // Basic metrics (free tier)
      summary: {
        total_executions: executions.length,
        unique_users: new Set(executions.map(e => e.user_id || e.ip_address)).size,
        success_rate: executions.filter(e => e.execution_success).length / executions.length,
        avg_execution_time: executions.reduce((sum, e) => sum + (e.execution_duration_ms || 0), 0) / executions.length,
      },
      
      // Time series data (community tier+)
      ...(userTier !== 'anonymous' && {
        time_series: this.generateTimeSeries(executions, timeframe),
        geographic_distribution: this.getGeographicDistribution(executions),
      }),
      
      // Detailed insights (verified tier+)
      ...((['verified', 'enterprise'].includes(userTier)) && {
        user_intelligence: this.getUserIntelligence(executions),
        performance_breakdown: this.getPerformanceBreakdown(executions),
        error_analysis: this.getErrorAnalysis(executions),
        tool_usage_stats: this.getToolUsageStats(executions),
      }),
      
      // Enterprise analytics (enterprise tier only)
      ...(userTier === 'enterprise' && {
        competitive_intelligence: await this.getCompetitiveIntelligence(mcpId),
        revenue_optimization: this.getRevenueOptimization(executions),
        custom_segments: this.getCustomSegments(executions),
        real_time_alerts: await this.getRealTimeAlerts(mcpId),
      }),
    };
    
    return analytics;
  }
  
  // Helper methods
  private async getCountryFromIP(ip: string): Promise<string | undefined> {
    // Implement IP geolocation lookup
    // Could use MaxMind, IPinfo, or similar service
    return undefined; // Placeholder
  }
  
  private isBusinessHours(): boolean {
    const hour = new Date().getHours();
    return hour >= 9 && hour <= 17;
  }
  
  private async isRepeatUser(identifier: string): Promise<boolean> {
    const { data } = await supabase
      .from('mcp_execution_analytics')
      .select('execution_id')
      .or(`user_id.eq.${identifier},ip_address.eq.${identifier}`)
      .limit(1);
    
    return (data?.length || 0) > 0;
  }
  
  private getBillingCategory(tier?: string): 'community' | 'verified' | 'enterprise' | 'free' {
    // Map any incoming tier string to valid billing categories
    switch (tier?.toLowerCase()) {
      case 'community':
        return 'community';
      case 'verified':
        return 'verified';
      case 'enterprise':
        return 'enterprise';
      case 'free':
        return 'free';
      default:
        return 'free'; // Default to free for any unrecognized tier
    }
  }
  
  private getMostUsedTool(tools?: string[]): string | undefined {
    if (!tools || tools.length === 0) return undefined;
    
    const counts = tools.reduce((acc, tool) => {
      acc[tool] = (acc[tool] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts).sort(([,a], [,b]) => b - a)[0][0];
  }
  
  private calculateQualityScore(executionData: any): number {
    let score = 100;
    
    // Deduct for errors
    if (!executionData.success) score -= 30;
    
    // Deduct for slow execution
    if (executionData.duration > 10000) score -= 20;
    if (executionData.duration > 30000) score -= 30;
    
    // Deduct for high resource usage
    if (executionData.resourceUsage?.peakMemoryMB > 500) score -= 10;
    if (executionData.resourceUsage?.cpuPercent > 80) score -= 10;
    
    return Math.max(0, score);
  }
  
  private calculateUserExperienceScore(executionData: any): number {
    let score = 100;
    
    // Factor in speed
    if (executionData.duration > 5000) score -= 20;
    if (executionData.duration > 15000) score -= 40;
    
    // Factor in success
    if (!executionData.success) score -= 50;
    
    // Factor in output quality
    if (executionData.outputSize && executionData.outputSize > 0) score += 10;
    
    return Math.max(0, score);
  }
  
  private calculateComplexityScore(analytics: Partial<MCPExecutionAnalytics>): number {
    let score = 1;
    
    // Factor in execution time
    if ((analytics.execution_duration_ms || 0) > 10000) score += 2;
    if ((analytics.execution_duration_ms || 0) > 30000) score += 3;
    
    // Factor in tool usage
    score += (analytics.tool_call_count || 0) * 0.5;
    
    // Factor in resource usage
    if ((analytics.peak_memory_usage_mb || 0) > 100) score += 2;
    if ((analytics.network_requests_count || 0) > 10) score += 1;
    
    return Math.min(10, score);
  }
  
  private inferUserSatisfaction(analytics: Partial<MCPExecutionAnalytics>): number {
    if (!analytics.execution_success) return 2;
    if ((analytics.execution_duration_ms || 0) > 30000) return 6;
    if ((analytics.execution_duration_ms || 0) > 10000) return 7;
    return 9;
  }
  
  private async updateAggregatedMetrics(analytics: MCPExecutionAnalytics): Promise<void> {
    // Update hourly aggregates for faster dashboard queries
    const date = analytics.execution_start_time.split('T')[0];
    const hour = new Date(analytics.execution_start_time).getHours();
    
    // This would update aggregated metrics tables for fast dashboard queries
    // Implementation would use upsert operations to maintain running totals
  }
  
  private async updateBusinessIntelligence(analytics: MCPExecutionAnalytics): Promise<void> {
    // Update business intelligence tables for trending, competitive analysis, etc.
    // This is where we'd calculate trending scores, market position, etc.
  }
  
  private getHoursBack(timeframe: string): number {
    switch (timeframe) {
      case '24h': return 24;
      case '7d': return 24 * 7;
      case '30d': return 24 * 30;
      case '90d': return 24 * 90;
      default: return 24 * 7;
    }
  }
  
  private generateTimeSeries(executions: any[], timeframe: string): any {
    // Generate time series data for charts
    return {};
  }
  
  private getGeographicDistribution(executions: any[]): any {
    // Generate geographic distribution data
    return {};
  }
  
  private getUserIntelligence(executions: any[]): any {
    // Generate user intelligence insights
    return {};
  }
  
  private getPerformanceBreakdown(executions: any[]): any {
    // Generate performance breakdown analysis
    return {};
  }
  
  private getErrorAnalysis(executions: any[]): any {
    // Generate error analysis and patterns
    return {};
  }
  
  private getToolUsageStats(executions: any[]): any {
    // Generate tool usage statistics
    return {};
  }
  
  private async getCompetitiveIntelligence(mcpId: string): Promise<any> {
    // Generate competitive intelligence (enterprise only)
    return {};
  }
  
  private getRevenueOptimization(executions: any[]): any {
    // Generate revenue optimization insights
    return {};
  }
  
  private getCustomSegments(executions: any[]): any {
    // Generate custom user segments
    return {};
  }
  
  private async getRealTimeAlerts(mcpId: string): Promise<any> {
    // Generate real-time alert configurations
    return {};
  }
}

export const analyticsCollector = new ComprehensiveAnalyticsCollector();