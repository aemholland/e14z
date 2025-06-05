/**
 * 10/10 Review Scoring Algorithm for E14Z MCP Discovery
 * Aggregates user review data into single satisfaction score
 */

class ReviewScoreCalculator {
  constructor() {
    this.version = '1.0';
    
    // Scoring weights (total: 100%)
    this.weights = {
      rating: 0.40,        // 40% - Average user rating
      success: 0.25,       // 25% - Success rate of user experiences  
      volume: 0.15,        // 15% - Number of reviews (confidence)
      recency: 0.10,       // 10% - How recent are reviews
      quality: 0.10        // 10% - Quality of review content
    };
  }

  /**
   * Calculate comprehensive review score (0-100)
   */
  async calculateReviewScore(mcpId, reviews = null) {
    // If reviews not provided, fetch them
    if (!reviews) {
      reviews = await this.fetchMCPReviews(mcpId);
    }

    if (!reviews || reviews.length === 0) {
      return {
        total_score: null, // No reviews yet
        breakdown: {
          rating: 0,
          success: 0,
          volume: 0,
          recency: 0,
          quality: 0
        },
        review_count: 0,
        confidence: 'none',
        algorithm_version: this.version,
        calculated_at: new Date().toISOString()
      };
    }

    const scores = {
      rating: this.calculateRatingScore(reviews),
      success: this.calculateSuccessScore(reviews),
      volume: this.calculateVolumeScore(reviews),
      recency: this.calculateRecencyScore(reviews),
      quality: this.calculateQualityScore(reviews)
    };

    // Calculate weighted total
    const totalScore = Object.entries(scores).reduce((total, [category, score]) => {
      return total + (score * this.weights[category]);
    }, 0);

    return {
      total_score: Math.round(totalScore),
      breakdown: scores,
      weights: this.weights,
      review_count: reviews.length,
      confidence: this.getConfidenceLevel(reviews.length),
      algorithm_version: this.version,
      calculated_at: new Date().toISOString()
    };
  }

  /**
   * Rating Score (0-100): Average user ratings
   * Weight: 40% - Most direct measure of satisfaction
   */
  calculateRatingScore(reviews) {
    if (reviews.length === 0) return 0;

    // Calculate weighted average (recent reviews matter more)
    let totalWeightedRating = 0;
    let totalWeight = 0;

    reviews.forEach(review => {
      const daysAgo = (Date.now() - new Date(review.created_at).getTime()) / (1000 * 60 * 60 * 24);
      
      // Weight decay: recent reviews have more weight
      let weight = 1.0;
      if (daysAgo <= 7) weight = 1.5;      // Last week: 1.5x weight
      else if (daysAgo <= 30) weight = 1.2; // Last month: 1.2x weight
      else if (daysAgo <= 90) weight = 1.0; // Last 3 months: normal weight
      else weight = 0.7;                    // Older: 0.7x weight

      totalWeightedRating += (review.rating || 5) * weight;
      totalWeight += weight;
    });

    const avgRating = totalWeightedRating / totalWeight;
    
    // Convert 1-10 scale to 0-100 score
    return ((avgRating - 1) / 9) * 100;
  }

  /**
   * Success Score (0-100): How often users succeeded with the MCP
   * Weight: 25% - Practical effectiveness measure
   */
  calculateSuccessScore(reviews) {
    if (reviews.length === 0) return 0;

    const reviewsWithSuccessData = reviews.filter(r => r.success !== null);
    if (reviewsWithSuccessData.length === 0) return 50; // Neutral if no data

    // Calculate success rate
    const successCount = reviewsWithSuccessData.filter(r => r.success === true).length;
    const successRate = successCount / reviewsWithSuccessData.length;

    let score = successRate * 70; // Base score from success rate

    // Bonus for task completion data
    const taskReviews = reviews.filter(r => 
      r.tasks_completed !== null && r.tasks_failed !== null
    );

    if (taskReviews.length > 0) {
      const totalCompleted = taskReviews.reduce((sum, r) => sum + (r.tasks_completed || 0), 0);
      const totalFailed = taskReviews.reduce((sum, r) => sum + (r.tasks_failed || 0), 0);
      const totalTasks = totalCompleted + totalFailed;

      if (totalTasks > 0) {
        const taskSuccessRate = totalCompleted / totalTasks;
        score += taskSuccessRate * 20; // Up to 20 bonus points
      }
    }

    // Bonus for low error rates
    const errorReviews = reviews.filter(r => r.error_count !== null);
    if (errorReviews.length > 0) {
      const avgErrors = errorReviews.reduce((sum, r) => sum + (r.error_count || 0), 0) / errorReviews.length;
      
      if (avgErrors === 0) score += 10;       // Perfect
      else if (avgErrors < 1) score += 7;     // Very few errors
      else if (avgErrors < 3) score += 4;     // Some errors
      // Many errors = no bonus
    }

    return Math.min(score, 100);
  }

  /**
   * Volume Score (0-100): Number of reviews (confidence indicator)
   * Weight: 15% - More reviews = more reliable score
   */
  calculateVolumeScore(reviews) {
    const count = reviews.length;

    // Score based on review volume
    if (count >= 50) return 100;       // Excellent sample size
    else if (count >= 20) return 90;   // Very good sample
    else if (count >= 10) return 75;   // Good sample
    else if (count >= 5) return 60;    // Decent sample
    else if (count >= 3) return 45;    // Small sample
    else if (count >= 1) return 30;    // Very small sample
    else return 0;                     // No reviews
  }

  /**
   * Recency Score (0-100): How recent are the reviews
   * Weight: 10% - Recent reviews are more relevant
   */
  calculateRecencyScore(reviews) {
    if (reviews.length === 0) return 0;

    const now = Date.now();
    let score = 0;

    // Score based on distribution of review ages
    const reviewAges = reviews.map(review => {
      const daysAgo = (now - new Date(review.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo;
    });

    // Recent reviews bonus
    const veryRecentCount = reviewAges.filter(days => days <= 7).length;
    const recentCount = reviewAges.filter(days => days <= 30).length;
    const moderateCount = reviewAges.filter(days => days <= 90).length;

    const total = reviews.length;

    // Weight by recency
    score += (veryRecentCount / total) * 40;  // Last week
    score += (recentCount / total) * 30;      // Last month
    score += (moderateCount / total) * 20;    // Last 3 months
    score += ((total - moderateCount) / total) * 10; // Older

    // Bonus for having any very recent reviews
    if (veryRecentCount > 0) score += 20;
    else if (recentCount > 0) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Quality Score (0-100): Quality of review content and data
   * Weight: 10% - Better data = more reliable
   */
  calculateQualityScore(reviews) {
    if (reviews.length === 0) return 0;

    let totalQuality = 0;
    let maxPossibleQuality = 0;

    reviews.forEach(review => {
      let reviewQuality = 0;
      let maxQuality = 0;

      // Has detailed rating breakdown
      if (review.rating_breakdown && Object.keys(review.rating_breakdown).length > 0) {
        reviewQuality += 20;
      }
      maxQuality += 20;

      // Has review text (qualitative feedback)
      if (review.review_text && review.review_text.trim().length > 10) {
        const textLength = review.review_text.length;
        if (textLength > 100) reviewQuality += 15;       // Detailed
        else if (textLength > 50) reviewQuality += 10;   // Moderate
        else reviewQuality += 5;                         // Brief
      }
      maxQuality += 15;

      // Has use case information
      if (review.use_case || review.use_case_category) {
        reviewQuality += 15;
      }
      maxQuality += 15;

      // Has performance data
      if (review.avg_latency_experienced !== null) {
        reviewQuality += 10;
      }
      maxQuality += 10;

      // Has task completion data
      if (review.tasks_completed !== null && review.tasks_failed !== null) {
        reviewQuality += 15;
      }
      maxQuality += 15;

      // Has error information
      if (review.error_count !== null) {
        reviewQuality += 10;
      }
      maxQuality += 10;

      // Has discovery effectiveness rating
      if (review.discovery_effectiveness) {
        reviewQuality += 10;
      }
      maxQuality += 10;

      // Has agent type information
      if (review.agent_type && review.agent_type !== 'unknown') {
        reviewQuality += 5;
      }
      maxQuality += 5;

      totalQuality += reviewQuality;
      maxPossibleQuality += maxQuality;
    });

    if (maxPossibleQuality === 0) return 0;

    return (totalQuality / maxPossibleQuality) * 100;
  }

  /**
   * Get confidence level based on review count
   */
  getConfidenceLevel(reviewCount) {
    if (reviewCount >= 20) return 'high';
    if (reviewCount >= 10) return 'medium';
    if (reviewCount >= 3) return 'low';
    if (reviewCount >= 1) return 'very-low';
    return 'none';
  }

  /**
   * Generate review summary for agents
   */
  generateReviewSummary(result, reviews) {
    const { total_score, review_count, confidence } = result;
    
    if (review_count === 0) {
      return {
        summary: 'No user reviews yet',
        confidence: 'none',
        recommendation: 'Be the first to review this MCP after using it'
      };
    }

    const tier = this.getReviewTier(total_score);
    const avgRating = this.calculateAverageRating(reviews);
    const successRate = this.calculateOverallSuccessRate(reviews);

    return {
      tier,
      score: total_score,
      avg_rating: avgRating,
      success_rate: successRate,
      review_count,
      confidence,
      recommendation: this.getReviewRecommendation(tier, confidence, successRate)
    };
  }

  getReviewTier(score) {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'very-good';
    if (score >= 70) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }

  calculateAverageRating(reviews) {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((total, review) => total + (review.rating || 5), 0);
    return Math.round((sum / reviews.length) * 10) / 10; // Round to 1 decimal
  }

  calculateOverallSuccessRate(reviews) {
    const successReviews = reviews.filter(r => r.success !== null);
    if (successReviews.length === 0) return null;
    
    const successCount = successReviews.filter(r => r.success === true).length;
    return Math.round((successCount / successReviews.length) * 100);
  }

  getReviewRecommendation(tier, confidence, successRate) {
    if (confidence === 'none') {
      return 'No user feedback available yet';
    }

    if (confidence === 'very-low' || confidence === 'low') {
      return `Limited user feedback (${tier} so far) - try with caution`;
    }

    switch (tier) {
      case 'excellent':
        return `Highly rated by users (${successRate}% success rate)`;
      case 'very-good':
        return `Very well rated by users with good success rate`;
      case 'good':
        return `Good user feedback with decent success rate`;
      case 'fair':
        return `Mixed user feedback - check use case compatibility`;
      case 'poor':
        return `Poor user feedback - consider alternatives`;
      case 'critical':
        return `Very poor user feedback - not recommended`;
      default:
        return 'User feedback assessment pending';
    }
  }

  /**
   * Fetch MCP reviews (placeholder - would connect to database)
   */
  async fetchMCPReviews(mcpId) {
    // This would be implemented to fetch from the reviews table
    // For now, return placeholder
    return [];
  }
}

module.exports = { ReviewScoreCalculator };