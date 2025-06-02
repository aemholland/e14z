/**
 * MCP Server APM (Application Performance Monitoring)
 * Specialized monitoring for E14Z MCP JSON-RPC server
 * 
 * This module provides comprehensive monitoring for the MCP server including:
 * - JSON-RPC request/response tracking
 * - Tool-specific performance metrics
 * - Security event monitoring
 * - Agent behavior analytics
 * - Resource utilization tracking
 */

const fs = require('fs');
const path = require('path');

class MCPServerAPM {
  constructor() {
    this.metrics = {
      // Request tracking
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      
      // Tool-specific metrics
      toolCalls: new Map(), // tool name -> { count, totalTime, errors, lastUsed }
      toolPerformance: new Map(), // tool name -> { avg, min, max, p95, p99 }
      
      // Security metrics
      securityEvents: new Map(), // event type -> count
      rateLimitViolations: 0,
      maliciousRequests: 0,
      
      // Agent analytics
      agentSessions: new Map(), // session id -> { agent, startTime, requestCount, tools }
      agentTypes: new Map(), // agent type -> usage stats
      
      // Performance tracking
      requestTimes: [], // circular buffer for response times
      requestSizes: [], // circular buffer for request sizes
      responseSizes: [], // circular buffer for response sizes
      
      // Resource monitoring
      memorySnapshots: [],
      cpuUsage: [],
      
      // Error tracking
      errorsByType: new Map(),
      errorsByTool: new Map()
    };
    
    this.config = {
      bufferSize: 1000, // Keep last 1000 requests in memory
      metricsInterval: 60000, // Collect system metrics every minute
      persistInterval: 300000, // Persist metrics every 5 minutes
      maxSessions: 1000, // Track up to 1000 concurrent sessions
      enableDetailedLogging: process.env.MCP_APM_DETAILED_LOGGING === 'true'
    };
    
    this.startTime = Date.now();
    this.lastMetricsCollection = Date.now();
    
    // Start background monitoring
    this.startSystemMonitoring();
    this.startMetricsPersistence();
  }

  /**
   * Record a JSON-RPC request start
   */
  startRequest(request) {
    const requestId = request.id || `notification_${Date.now()}`;
    const startTime = Date.now();
    
    // Extract session info
    const sessionId = this.extractSessionId(request);
    const agentInfo = this.detectAgent(request);
    
    // Track session
    this.updateSessionInfo(sessionId, agentInfo, request.method);
    
    // Request size tracking
    const requestSize = JSON.stringify(request).length;
    this.addToBuffer(this.metrics.requestSizes, requestSize);
    
    return {
      requestId,
      sessionId,
      startTime,
      method: request.method,
      agentInfo,
      requestSize
    };
  }

  /**
   * Record a successful JSON-RPC request completion
   */
  endRequest(context, response) {
    const endTime = Date.now();
    const duration = endTime - context.startTime;
    
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    
    // Track response time
    this.addToBuffer(this.metrics.requestTimes, duration);
    
    // Track response size
    const responseSize = JSON.stringify(response).length;
    this.addToBuffer(this.metrics.responseSizes, responseSize);
    
    // Track tool-specific metrics for tool calls
    if (context.method === 'tools/call' && response?.content) {
      const toolName = this.extractToolName(response);
      this.recordToolPerformance(toolName, duration, true);
    }
    
    // Track method performance
    this.recordMethodPerformance(context.method, duration, true);
    
    // Update agent analytics
    this.updateAgentMetrics(context.agentInfo, context.sessionId, duration, true);
    
    // Detailed logging if enabled
    if (this.config.enableDetailedLogging) {
      this.logRequestDetails(context, { duration, responseSize, success: true });
    }
  }

  /**
   * Record a failed JSON-RPC request
   */
  endRequestWithError(context, error) {
    const endTime = Date.now();
    const duration = endTime - context.startTime;
    
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
    
    // Track response time even for errors
    this.addToBuffer(this.metrics.requestTimes, duration);
    
    // Track error by type
    const errorType = this.categorizeError(error);
    this.metrics.errorsByType.set(errorType, (this.metrics.errorsByType.get(errorType) || 0) + 1);
    
    // Track tool-specific errors for tool calls
    if (context.method === 'tools/call') {
      const toolName = this.extractToolNameFromContext(context);
      this.recordToolPerformance(toolName, duration, false);
      this.metrics.errorsByTool.set(toolName, (this.metrics.errorsByTool.get(toolName) || 0) + 1);
    }
    
    // Track method performance
    this.recordMethodPerformance(context.method, duration, false);
    
    // Update agent analytics
    this.updateAgentMetrics(context.agentInfo, context.sessionId, duration, false);
    
    // Detailed logging if enabled
    if (this.config.enableDetailedLogging) {
      this.logRequestDetails(context, { duration, error: error.message, success: false });
    }
  }

  /**
   * Record a security event
   */
  recordSecurityEvent(eventType, details, severity = 'medium') {
    this.metrics.securityEvents.set(eventType, (this.metrics.securityEvents.get(eventType) || 0) + 1);
    
    if (eventType.includes('malicious') || eventType.includes('attack')) {
      this.metrics.maliciousRequests++;
    }
    
    if (eventType.includes('rate_limit')) {
      this.metrics.rateLimitViolations++;
    }
    
    // Log security events
    console.error(`MCP APM Security Event [${severity.toUpperCase()}]: ${eventType} - ${details}`);
    
    // Store detailed security event (in production, this would go to a security monitoring system)
    this.persistSecurityEvent(eventType, details, severity);
  }

  /**
   * Get current metrics snapshot
   */
  getMetricsSnapshot() {
    const uptime = Date.now() - this.startTime;
    const memUsage = process.memoryUsage();
    
    // Calculate percentiles for response times
    const sortedTimes = [...this.metrics.requestTimes].sort((a, b) => a - b);
    const p50 = this.percentile(sortedTimes, 0.5);
    const p95 = this.percentile(sortedTimes, 0.95);
    const p99 = this.percentile(sortedTimes, 0.99);
    
    // Calculate error rate
    const errorRate = this.metrics.totalRequests > 0 ? 
      (this.metrics.failedRequests / this.metrics.totalRequests) * 100 : 0;
    
    // Calculate requests per second
    const requestsPerSecond = this.metrics.totalRequests / (uptime / 1000);
    
    return {
      // Basic metrics
      uptime_ms: uptime,
      total_requests: this.metrics.totalRequests,
      successful_requests: this.metrics.successfulRequests,
      failed_requests: this.metrics.failedRequests,
      error_rate_percent: errorRate,
      requests_per_second: requestsPerSecond,
      
      // Performance metrics
      response_time_ms: {
        avg: this.average(this.metrics.requestTimes),
        p50,
        p95, 
        p99,
        min: Math.min(...this.metrics.requestTimes),
        max: Math.max(...this.metrics.requestTimes)
      },
      
      // Size metrics
      request_size_bytes: {
        avg: this.average(this.metrics.requestSizes),
        max: Math.max(...this.metrics.requestSizes),
        total: this.sum(this.metrics.requestSizes)
      },
      
      response_size_bytes: {
        avg: this.average(this.metrics.responseSizes),
        max: Math.max(...this.metrics.responseSizes),
        total: this.sum(this.metrics.responseSizes)
      },
      
      // Tool performance
      tool_performance: this.getToolPerformanceSnapshot(),
      
      // Security metrics
      security_events: Object.fromEntries(this.metrics.securityEvents),
      rate_limit_violations: this.metrics.rateLimitViolations,
      malicious_requests: this.metrics.maliciousRequests,
      
      // Agent analytics
      active_sessions: this.metrics.agentSessions.size,
      agent_types: Object.fromEntries(this.metrics.agentTypes),
      
      // System metrics
      memory_usage: {
        heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
        external_mb: Math.round(memUsage.external / 1024 / 1024),
        rss_mb: Math.round(memUsage.rss / 1024 / 1024)
      },
      
      // Error breakdown
      errors_by_type: Object.fromEntries(this.metrics.errorsByType),
      errors_by_tool: Object.fromEntries(this.metrics.errorsByTool),
      
      collected_at: new Date().toISOString()
    };
  }

  /**
   * Helper methods
   */
  
  extractSessionId(request) {
    // Try to extract session ID from request
    return request.id?.toString() || 
           request.params?.session_id || 
           `anonymous_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  detectAgent(request) {
    // Try to detect agent type from request patterns
    // This could be enhanced based on actual agent identification methods
    
    if (request.method === 'initialize' && request.params?.clientInfo) {
      return {
        name: request.params.clientInfo.name || 'unknown',
        version: request.params.clientInfo.version || 'unknown'
      };
    }
    
    // Default detection based on common patterns
    return {
      name: 'unknown_agent',
      version: 'unknown'
    };
  }
  
  updateSessionInfo(sessionId, agentInfo, method) {
    if (!this.metrics.agentSessions.has(sessionId)) {
      this.metrics.agentSessions.set(sessionId, {
        agent: agentInfo,
        startTime: Date.now(),
        requestCount: 0,
        tools: new Set(),
        lastActivity: Date.now()
      });
    }
    
    const session = this.metrics.agentSessions.get(sessionId);
    session.requestCount++;
    session.lastActivity = Date.now();
    
    if (method === 'tools/call') {
      // We'll update tools when we know which tool was called
    }
    
    // Cleanup old sessions
    if (this.metrics.agentSessions.size > this.config.maxSessions) {
      this.cleanupOldSessions();
    }
  }
  
  extractToolName(response) {
    // Extract tool name from successful response
    // For MCP tool calls, this information isn't always in the response
    return 'tool_call';
  }
  
  extractToolNameFromContext(context) {
    // Extract tool name from request context
    // We can't easily get the tool name from context without parsing the request params
    // This will be handled by the tool call tracking in the MCP server
    return 'unknown_tool';
  }
  
  recordToolPerformance(toolName, duration, success) {
    if (!this.metrics.toolCalls.has(toolName)) {
      this.metrics.toolCalls.set(toolName, {
        count: 0,
        totalTime: 0,
        errors: 0,
        lastUsed: Date.now(),
        responseTimes: []
      });
    }
    
    const tool = this.metrics.toolCalls.get(toolName);
    tool.count++;
    tool.totalTime += duration;
    tool.lastUsed = Date.now();
    tool.responseTimes.push(duration);
    
    // Keep only last 100 response times per tool
    if (tool.responseTimes.length > 100) {
      tool.responseTimes = tool.responseTimes.slice(-100);
    }
    
    if (!success) {
      tool.errors++;
    }
  }
  
  recordMethodPerformance(method, duration, success) {
    // Similar to tool performance but for JSON-RPC methods
    const key = `method_${method}`;
    this.recordToolPerformance(key, duration, success);
  }
  
  updateAgentMetrics(agentInfo, sessionId, duration, success) {
    const agentKey = `${agentInfo.name}_${agentInfo.version}`;
    
    if (!this.metrics.agentTypes.has(agentKey)) {
      this.metrics.agentTypes.set(agentKey, {
        requestCount: 0,
        totalDuration: 0,
        errors: 0,
        lastSeen: Date.now()
      });
    }
    
    const agent = this.metrics.agentTypes.get(agentKey);
    agent.requestCount++;
    agent.totalDuration += duration;
    agent.lastSeen = Date.now();
    
    if (!success) {
      agent.errors++;
    }
  }
  
  categorizeError(error) {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('rate limit')) return 'rate_limit';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('dangerous') || message.includes('security')) return 'security';
    if (message.includes('not found') || message.includes('unknown')) return 'not_found';
    if (message.includes('invalid') || message.includes('parse')) return 'validation';
    if (message.includes('network') || message.includes('fetch')) return 'network';
    
    return 'internal_error';
  }
  
  getToolPerformanceSnapshot() {
    const toolPerf = {};
    
    for (const [toolName, metrics] of this.metrics.toolCalls.entries()) {
      const avgTime = metrics.count > 0 ? metrics.totalTime / metrics.count : 0;
      const errorRate = metrics.count > 0 ? (metrics.errors / metrics.count) * 100 : 0;
      const sortedTimes = [...metrics.responseTimes].sort((a, b) => a - b);
      
      toolPerf[toolName] = {
        call_count: metrics.count,
        avg_response_time_ms: avgTime,
        error_rate_percent: errorRate,
        p95_response_time_ms: this.percentile(sortedTimes, 0.95),
        last_used: new Date(metrics.lastUsed).toISOString()
      };
    }
    
    return toolPerf;
  }
  
  addToBuffer(buffer, value) {
    buffer.push(value);
    if (buffer.length > this.config.bufferSize) {
      buffer.shift();
    }
  }
  
  cleanupOldSessions() {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    
    for (const [sessionId, session] of this.metrics.agentSessions.entries()) {
      if (now - session.lastActivity > staleThreshold) {
        this.metrics.agentSessions.delete(sessionId);
      }
    }
  }
  
  // Statistical helper methods
  average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }
  
  sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
  }
  
  percentile(sortedArr, p) {
    if (sortedArr.length === 0) return 0;
    const index = Math.ceil(sortedArr.length * p) - 1;
    return sortedArr[Math.max(0, index)];
  }
  
  // Background monitoring
  startSystemMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.memorySnapshots.push({
        timestamp: Date.now(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      });
      
      // Keep only last 100 snapshots
      if (this.metrics.memorySnapshots.length > 100) {
        this.metrics.memorySnapshots.shift();
      }
      
    }, this.config.metricsInterval);
  }
  
  startMetricsPersistence() {
    setInterval(() => {
      this.persistMetrics();
    }, this.config.persistInterval);
  }
  
  async persistMetrics() {
    try {
      const snapshot = this.getMetricsSnapshot();
      
      // In a full implementation, this would send to the same database as the web app
      // For now, we'll use a simplified approach that logs to console/file
      
      if (process.env.NODE_ENV === 'production') {
        // Log abbreviated metrics
        console.error(`MCP APM: ${snapshot.total_requests} reqs, ${snapshot.error_rate_percent.toFixed(1)}% errors, ${snapshot.response_time_ms.avg.toFixed(0)}ms avg`);
      }
      
      // TODO: Send metrics to database using the same API as the web app
      // await this.sendMetricsToDatabase(snapshot);
      
    } catch (error) {
      console.error('MCP APM: Failed to persist metrics:', error.message);
    }
  }
  
  persistSecurityEvent(eventType, details, severity) {
    const event = {
      timestamp: new Date().toISOString(),
      type: eventType,
      details,
      severity,
      source: 'mcp_server'
    };
    
    // In production, this would go to a security monitoring system
    console.error(`MCP Security Event: ${JSON.stringify(event)}`);
  }
  
  logRequestDetails(context, result) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      request_id: context.requestId,
      session_id: context.sessionId,
      method: context.method,
      agent: context.agentInfo,
      duration_ms: result.duration,
      success: result.success,
      request_size: context.requestSize,
      response_size: result.responseSize,
      error: result.error
    };
    
    console.log(`MCP APM Request: ${JSON.stringify(logEntry)}`);
  }
}

// Export singleton instance
const mcpAPM = new MCPServerAPM();

module.exports = { MCPServerAPM, mcpAPM };