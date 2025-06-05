/**
 * 10/10 Quality Scoring Algorithm for E14Z MCP Discovery
 * Based on pulse monitoring data - measures technical quality and reliability
 */

class QualityScoreCalculator {
  constructor() {
    this.version = '1.0';
    
    // Scoring weights (total: 100%)
    this.weights = {
      health: 0.35,        // 35% - Is it working?
      performance: 0.25,   // 25% - How fast?
      functionality: 0.20, // 20% - How many tools work?
      reliability: 0.15,   // 15% - Consistent over time?
      completeness: 0.05   // 5% - Technical completeness
    };
  }

  /**
   * Calculate comprehensive quality score (0-100)
   */
  calculateQualityScore(mcp, pulseData) {
    const scores = {
      health: this.calculateHealthScore(mcp, pulseData),
      performance: this.calculatePerformanceScore(pulseData),
      functionality: this.calculateFunctionalityScore(pulseData),
      reliability: this.calculateReliabilityScore(mcp, pulseData),
      completeness: this.calculateCompletenessScore(pulseData)
    };

    // Calculate weighted total
    const totalScore = Object.entries(scores).reduce((total, [category, score]) => {
      return total + (score * this.weights[category]);
    }, 0);

    return {
      total_score: Math.round(totalScore),
      breakdown: scores,
      weights: this.weights,
      algorithm_version: this.version,
      calculated_at: new Date().toISOString()
    };
  }

  /**
   * Health Score (0-100): Is the MCP available and working?
   * Weight: 35% - Most important factor
   */
  calculateHealthScore(mcp, pulseData) {
    let score = 0;

    // Base health status (0-70 points)
    switch (mcp.health_status) {
      case 'healthy':
        score += 70;
        break;
      case 'degraded':
        score += 40;
        break;
      case 'down':
        score += 0;
        break;
      default: // unknown
        score += 30;
    }

    // Connection success (0-15 points)
    if (pulseData?.connection_info?.last_successful_connection) {
      const lastSuccess = new Date(pulseData.connection_info.last_successful_connection);
      const hoursSinceSuccess = (Date.now() - lastSuccess.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceSuccess < 1) score += 15;      // Very recent
      else if (hoursSinceSuccess < 6) score += 12; // Recent
      else if (hoursSinceSuccess < 24) score += 8; // Today
      else if (hoursSinceSuccess < 72) score += 4; // This week
      // Older = 0 points
    }

    // Uptime percentage (0-15 points)
    const uptime = pulseData?.health?.uptime_percentage || 0;
    if (uptime >= 99) score += 15;
    else if (uptime >= 95) score += 12;
    else if (uptime >= 90) score += 8;
    else if (uptime >= 80) score += 4;
    // Lower = 0 points

    return Math.min(score, 100);
  }

  /**
   * Performance Score (0-100): How fast and efficient is the MCP?
   * Weight: 25% - Critical for user experience
   */
  calculatePerformanceScore(pulseData) {
    let score = 0;

    // Average response time (0-40 points)
    const avgResponseTime = pulseData?.performance?.avg_response_time_ms || 9999;
    if (avgResponseTime < 100) score += 40;        // Excellent
    else if (avgResponseTime < 300) score += 35;   // Very good
    else if (avgResponseTime < 500) score += 25;   // Good
    else if (avgResponseTime < 1000) score += 15;  // Acceptable
    else if (avgResponseTime < 2000) score += 5;   // Slow
    // Slower = 0 points

    // Connection startup time (0-20 points)
    const startupTime = pulseData?.connection?.startup_time_ms || 9999;
    if (startupTime < 500) score += 20;        // Fast startup
    else if (startupTime < 1000) score += 15;  // Good startup
    else if (startupTime < 2000) score += 10;  // Acceptable startup
    else if (startupTime < 5000) score += 5;   // Slow startup
    // Slower = 0 points

    // Error rate (0-25 points)
    const errorRate = pulseData?.performance?.error_rate || 1;
    if (errorRate === 0) score += 25;          // Perfect
    else if (errorRate < 0.01) score += 20;    // Excellent
    else if (errorRate < 0.05) score += 15;    // Very good
    else if (errorRate < 0.1) score += 10;     // Good
    else if (errorRate < 0.2) score += 5;      // Acceptable
    // Higher = 0 points

    // Connection success rate (0-15 points)
    const successRate = pulseData?.performance?.connection_success_rate || 0;
    if (successRate >= 0.99) score += 15;
    else if (successRate >= 0.95) score += 12;
    else if (successRate >= 0.90) score += 8;
    else if (successRate >= 0.80) score += 4;
    // Lower = 0 points

    return Math.min(score, 100);
  }

  /**
   * Functionality Score (0-100): How many tools work vs fail?
   * Weight: 20% - Measures actual utility
   */
  calculateFunctionalityScore(pulseData) {
    let score = 0;

    const workingTools = pulseData?.usage_patterns?.working_tools || [];
    const failingTools = pulseData?.usage_patterns?.failing_tools || [];
    const totalTools = workingTools.length + failingTools.length;

    // Special case: If MCP requires authentication, give high functionality score
    // because the tools are there, just need authentication
    if (totalTools === 0 && pulseData?.authentication?.required) {
      console.log('   📊 Auth-required MCP: giving high functionality score (tools available after auth)');
      return 85; // High score - functionality exists, just needs auth
    }

    if (totalTools === 0) {
      // No tools tested yet - neutral score
      return 50;
    }

    // Tool success ratio (0-60 points)
    const successRatio = workingTools.length / totalTools;
    score += successRatio * 60;

    // Absolute number of working tools (0-25 points)
    if (workingTools.length >= 10) score += 25;      // Many tools
    else if (workingTools.length >= 5) score += 20;  // Good number
    else if (workingTools.length >= 3) score += 15;  // Some tools
    else if (workingTools.length >= 1) score += 10;  // At least one
    // No working tools = 0 points

    // Tool schema completeness (0-15 points)
    const tools = pulseData?.tools || [];
    let schemaCompleteTools = 0;
    tools.forEach(tool => {
      if (tool.inputSchema && 
          tool.inputSchema.type === 'object' && 
          tool.inputSchema.properties) {
        schemaCompleteTools++;
      }
    });

    if (tools.length > 0) {
      const schemaRatio = schemaCompleteTools / tools.length;
      score += schemaRatio * 15;
    }

    return Math.min(score, 100);
  }

  /**
   * Reliability Score (0-100): Consistent performance over time?
   * Weight: 15% - Long-term stability
   */
  calculateReliabilityScore(mcp, pulseData) {
    let score = 0;

    // Consecutive failures (0-30 points)
    const consecutiveFailures = pulseData?.health?.consecutive_failures || 0;
    if (consecutiveFailures === 0) score += 30;      // Perfect
    else if (consecutiveFailures <= 1) score += 25;  // Very good
    else if (consecutiveFailures <= 3) score += 15;  // Acceptable
    else if (consecutiveFailures <= 5) score += 5;   // Poor
    // More failures = 0 points

    // Time since last pulse check (0-25 points)
    if (mcp.last_pulse_check) {
      const hoursSinceCheck = (Date.now() - new Date(mcp.last_pulse_check).getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceCheck < 6) score += 25;      // Very recent
      else if (hoursSinceCheck < 24) score += 20; // Recent
      else if (hoursSinceCheck < 72) score += 10; // This week
      else if (hoursSinceCheck < 168) score += 5; // This month
      // Older = 0 points
    }

    // Stability indicators (0-25 points)
    const stabilityScore = pulseData?.performance?.stability_score || 0;
    score += (stabilityScore / 100) * 25;

    // Version stability (0-20 points)
    if (pulseData?.connection?.protocol_version === '2024-11-05') {
      score += 20; // Current protocol version
    } else if (pulseData?.connection?.protocol_version) {
      score += 10; // Has version, but older
    }
    // No version info = 0 points

    return Math.min(score, 100);
  }

  /**
   * Completeness Score (0-100): Technical implementation quality
   * Weight: 5% - Bonus for well-implemented MCPs
   */
  calculateCompletenessScore(pulseData) {
    let score = 0;

    // Server capabilities (0-25 points)
    const capabilities = pulseData?.server_capabilities || {};
    if (Object.keys(capabilities).length > 0) {
      score += 15; // Has capabilities
      if (capabilities.tools) score += 5;
      if (capabilities.resources) score += 3;
      if (capabilities.prompts) score += 2;
    }

    // Resources available (0-20 points)
    const resources = pulseData?.resources || [];
    if (resources.length > 0) {
      score += 10; // Has resources
      if (resources.length >= 3) score += 5;
      if (resources.some(r => r.mimeType)) score += 5; // Proper MIME types
    }

    // Prompts available (0-20 points)
    const prompts = pulseData?.prompts || [];
    if (prompts.length > 0) {
      score += 10; // Has prompts
      if (prompts.length >= 2) score += 5;
      if (prompts.some(p => p.arguments?.length > 0)) score += 5; // Proper arguments
    }

    // Authentication clarity (0-20 points)
    const auth = pulseData?.authentication || {};
    if (auth.setup_complexity) {
      if (auth.setup_complexity === 'simple' || auth.setup_complexity === 'none') {
        score += 20; // Easy to set up
      } else if (auth.setup_complexity === 'moderate') {
        score += 10; // Moderate setup
      } else {
        score += 5; // Complex but documented
      }
    }

    // Error handling (0-15 points)
    const errorPatterns = pulseData?.error_patterns || [];
    if (errorPatterns.length === 0) {
      score += 15; // No common errors
    } else if (errorPatterns.every(e => e.suggested_fixes)) {
      score += 10; // Errors but with fixes
    } else {
      score += 5; // Has errors
    }

    return Math.min(score, 100);
  }

  /**
   * Get quality tier based on score
   */
  getQualityTier(score) {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'very-good';
    if (score >= 70) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }

  /**
   * Generate quality summary for agents
   */
  generateQualitySummary(result) {
    const { total_score, breakdown } = result;
    const tier = this.getQualityTier(total_score);
    
    const strengths = [];
    const weaknesses = [];
    
    Object.entries(breakdown).forEach(([category, score]) => {
      if (score >= 80) strengths.push(category);
      else if (score < 50) weaknesses.push(category);
    });

    return {
      tier,
      score: total_score,
      strengths,
      weaknesses,
      recommendation: this.getRecommendation(tier, strengths, weaknesses)
    };
  }

  getRecommendation(tier, strengths, weaknesses) {
    switch (tier) {
      case 'excellent':
        return 'Highly recommended - excellent technical quality and reliability';
      case 'very-good':
        return 'Recommended - very good quality with minor issues';
      case 'good':
        return 'Good choice - solid quality for most use cases';
      case 'fair':
        return 'Acceptable - may have some limitations or performance issues';
      case 'poor':
        return 'Use with caution - significant quality or reliability issues';
      case 'critical':
        return 'Not recommended - major technical problems detected';
      default:
        return 'Quality assessment pending';
    }
  }
}

module.exports = { QualityScoreCalculator };