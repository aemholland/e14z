/**
 * Database Performance Monitoring for E14Z
 * Advanced metrics collection for Supabase/PostgreSQL operations
 */

import { supabase } from '@/lib/supabase/client'
import { telemetry } from './telemetry'
import { logger, performanceLogger } from '@/lib/logging/config'

interface DatabaseMetrics {
  // Connection Pool Metrics
  activeConnections: number
  idleConnections: number
  totalConnections: number
  connectionWaitTime: number

  // Query Performance
  slowQueries: QueryPerformanceMetric[]
  avgQueryTime: number
  queryCount: number
  queryErrorRate: number

  // Table Statistics
  tableStats: TableMetric[]
  indexUsage: IndexMetric[]

  // Cache Performance
  cacheHitRatio: number
  bufferCacheHits: number
  bufferCacheMisses: number

  // Replication & WAL
  replicationLag?: number
  walSize?: number
  walSegments?: number
}

interface QueryPerformanceMetric {
  query: string
  avgTime: number
  calls: number
  totalTime: number
  rows: number
  hitRatio: number
}

interface TableMetric {
  schemaName: string
  tableName: string
  totalSize: number
  tableSize: number
  indexSize: number
  rowCount: number
  deadTuples: number
  liveTuples: number
  lastVacuum?: string
  lastAnalyze?: string
}

interface IndexMetric {
  schemaName: string
  tableName: string
  indexName: string
  indexSize: number
  indexScans: number
  tuplesRead: number
  tuplesFetched: number
}

class DatabaseMetricsCollector {
  private metricsInterval: NodeJS.Timeout | null = null
  private readonly COLLECTION_INTERVAL = 60000 // 1 minute
  private isCollecting = false

  /**
   * Start continuous database metrics collection
   */
  start() {
    if (this.metricsInterval) {
      this.stop()
    }

    logger.info({ event: 'db_metrics_collection_started' }, 'Database metrics collection started')

    this.metricsInterval = setInterval(async () => {
      if (!this.isCollecting) {
        await this.collectMetrics()
      }
    }, this.COLLECTION_INTERVAL)

    // Collect initial metrics
    this.collectMetrics()
  }

  /**
   * Stop metrics collection
   */
  stop() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
      this.metricsInterval = null
      logger.info({ event: 'db_metrics_collection_stopped' }, 'Database metrics collection stopped')
    }
  }

  /**
   * Collect comprehensive database metrics
   */
  async collectMetrics(): Promise<DatabaseMetrics | null> {
    if (this.isCollecting) return null

    this.isCollecting = true
    const startTime = Date.now()

    try {
      const metrics = await this.gatherAllMetrics()
      
      // Record telemetry
      telemetry.recordDbQuery('metrics_collection', 'pg_stat_database', Date.now() - startTime, true)
      
      // Log metrics summary
      performanceLogger.info({
        event: 'db_metrics_collected',
        collection_time_ms: Date.now() - startTime,
        active_connections: metrics.activeConnections,
        avg_query_time: metrics.avgQueryTime,
        slow_queries_count: metrics.slowQueries.length,
        cache_hit_ratio: metrics.cacheHitRatio
      }, 'Database metrics collected')

      // Store metrics in database for historical analysis
      await this.storeMetrics(metrics)

      return metrics

    } catch (error) {
      logger.error({
        event: 'db_metrics_collection_failed',
        error: error instanceof Error ? error.message : String(error),
        collection_time_ms: Date.now() - startTime
      }, 'Failed to collect database metrics')

      telemetry.recordDbQuery('metrics_collection', 'pg_stat_database', Date.now() - startTime, false)
      return null

    } finally {
      this.isCollecting = false
    }
  }

  /**
   * Gather all database metrics
   */
  private async gatherAllMetrics(): Promise<DatabaseMetrics> {
    const [
      connectionMetrics,
      queryMetrics,
      tableMetrics,
      indexMetrics,
      cacheMetrics,
      replicationMetrics
    ] = await Promise.all([
      this.getConnectionMetrics(),
      this.getQueryPerformanceMetrics(),
      this.getTableMetrics(),
      this.getIndexMetrics(),
      this.getCacheMetrics(),
      this.getReplicationMetrics()
    ])

    return {
      ...connectionMetrics,
      ...queryMetrics,
      tableStats: tableMetrics,
      indexUsage: indexMetrics,
      ...cacheMetrics,
      ...replicationMetrics
    }
  }

  /**
   * Get database connection metrics
   */
  private async getConnectionMetrics() {
    const { data: activity } = await supabase
      .rpc('get_pg_stat_activity')
      .select('*')

    const activeConnections = activity?.filter(conn => conn.state === 'active').length || 0
    const idleConnections = activity?.filter(conn => conn.state === 'idle').length || 0
    const totalConnections = activity?.length || 0

    // Log connection metrics for telemetry
    console.debug(`Database connections - Active: ${activeConnections}, Idle: ${idleConnections}, Total: ${totalConnections}`)

    return {
      activeConnections,
      idleConnections,
      totalConnections,
      connectionWaitTime: 0 // Would need custom tracking
    }
  }

  /**
   * Get query performance metrics
   */
  private async getQueryPerformanceMetrics() {
    // Get pg_stat_statements data for query performance
    const { data: statements } = await supabase
      .rpc('get_pg_stat_statements')
      .order('total_time', { ascending: false })
      .limit(50)

    const slowQueries: QueryPerformanceMetric[] = statements?.map((stmt: any) => ({
      query: stmt.query.substring(0, 200) + (stmt.query.length > 200 ? '...' : ''),
      avgTime: stmt.mean_time || 0,
      calls: stmt.calls || 0,
      totalTime: stmt.total_time || 0,
      rows: stmt.rows || 0,
      hitRatio: stmt.shared_blks_hit / Math.max(stmt.shared_blks_hit + stmt.shared_blks_read, 1)
    })) || []

    const avgQueryTime = slowQueries.length > 0 
      ? slowQueries.reduce((sum, q) => sum + q.avgTime, 0) / slowQueries.length 
      : 0

    const queryCount = slowQueries.reduce((sum, q) => sum + q.calls, 0)
    const queryErrorRate = 0 // Would need error tracking

    return {
      slowQueries: slowQueries.slice(0, 10), // Top 10 slow queries
      avgQueryTime,
      queryCount,
      queryErrorRate
    }
  }

  /**
   * Get table statistics
   */
  private async getTableMetrics(): Promise<TableMetric[]> {
    const { data: tables } = await supabase
      .rpc('get_table_stats')
      .order('total_bytes', { ascending: false })

    return tables?.map((table: any) => ({
      schemaName: table.schema_name,
      tableName: table.table_name,
      totalSize: table.total_bytes || 0,
      tableSize: table.table_bytes || 0,
      indexSize: table.index_bytes || 0,
      rowCount: table.row_estimate || 0,
      deadTuples: table.dead_tuples || 0,
      liveTuples: table.live_tuples || 0,
      lastVacuum: table.last_vacuum,
      lastAnalyze: table.last_analyze
    })) || []
  }

  /**
   * Get index usage metrics
   */
  private async getIndexMetrics(): Promise<IndexMetric[]> {
    const { data: indexes } = await supabase
      .rpc('get_index_usage')
      .order('idx_tup_read', { ascending: false })

    return indexes?.map((idx: any) => ({
      schemaName: idx.schema_name,
      tableName: idx.table_name,
      indexName: idx.index_name,
      indexSize: idx.index_bytes || 0,
      indexScans: idx.idx_scan || 0,
      tuplesRead: idx.idx_tup_read || 0,
      tuplesFetched: idx.idx_tup_fetch || 0
    })) || []
  }

  /**
   * Get cache performance metrics
   */
  private async getCacheMetrics() {
    const { data: cacheStats } = await supabase
      .rpc('get_cache_stats')
      .single()

    const bufferCacheHits = (cacheStats as any)?.heap_blks_hit || 0
    const bufferCacheMisses = (cacheStats as any)?.heap_blks_read || 0
    const cacheHitRatio = bufferCacheHits / Math.max(bufferCacheHits + bufferCacheMisses, 1)

    return {
      cacheHitRatio,
      bufferCacheHits,
      bufferCacheMisses
    }
  }

  /**
   * Get replication and WAL metrics
   */
  private async getReplicationMetrics() {
    try {
      const { data: walStats } = await supabase
        .rpc('get_wal_stats')
        .single()

      return {
        replicationLag: (walStats as any)?.replication_lag || 0,
        walSize: (walStats as any)?.wal_size || 0,
        walSegments: (walStats as any)?.wal_segments || 0
      }
    } catch (error) {
      // WAL stats might not be available in managed environments
      return {
        replicationLag: undefined,
        walSize: undefined,
        walSegments: undefined
      }
    }
  }

  /**
   * Store metrics in database for historical analysis
   */
  private async storeMetrics(metrics: DatabaseMetrics) {
    try {
      await supabase.from('database_metrics').insert({
        collected_at: new Date().toISOString(),
        active_connections: metrics.activeConnections,
        idle_connections: metrics.idleConnections,
        total_connections: metrics.totalConnections,
        avg_query_time_ms: metrics.avgQueryTime,
        query_count: metrics.queryCount,
        cache_hit_ratio: metrics.cacheHitRatio,
        slow_queries_count: metrics.slowQueries.length,
        total_table_size_bytes: metrics.tableStats.reduce((sum, t) => sum + t.totalSize, 0),
        replication_lag_ms: metrics.replicationLag,
        wal_size_bytes: metrics.walSize,
        metadata: {
          slow_queries: metrics.slowQueries.slice(0, 5), // Store top 5
          table_stats: metrics.tableStats.slice(0, 10), // Store top 10
          index_usage: metrics.indexUsage.slice(0, 10) // Store top 10
        }
      })
    } catch (error) {
      logger.error({
        event: 'db_metrics_storage_failed',
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to store database metrics')
    }
  }

  /**
   * Get database health score based on key metrics
   */
  async getDatabaseHealthScore(): Promise<number> {
    try {
      const metrics = await this.collectMetrics()
      if (!metrics) return 0

      let score = 100

      // Connection health (20% weight)
      const connectionRatio = metrics.activeConnections / Math.max(metrics.totalConnections, 1)
      if (connectionRatio > 0.8) score -= 15
      else if (connectionRatio > 0.6) score -= 5

      // Query performance (30% weight)
      if (metrics.avgQueryTime > 1000) score -= 20 // > 1 second average
      else if (metrics.avgQueryTime > 500) score -= 10 // > 500ms average

      // Cache performance (25% weight)
      if (metrics.cacheHitRatio < 0.8) score -= 20 // < 80% hit ratio
      else if (metrics.cacheHitRatio < 0.9) score -= 10 // < 90% hit ratio

      // Slow queries (25% weight)
      const slowQueriesRatio = metrics.slowQueries.filter(q => q.avgTime > 1000).length / Math.max(metrics.slowQueries.length, 1)
      if (slowQueriesRatio > 0.5) score -= 20
      else if (slowQueriesRatio > 0.25) score -= 10

      return Math.max(0, Math.min(100, score))

    } catch (error) {
      logger.error({
        event: 'db_health_score_failed',
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to calculate database health score')
      return 0
    }
  }

  /**
   * Get metrics for dashboard display
   */
  async getMetricsForDashboard() {
    try {
      // Get recent metrics from stored data
      const { data: recentMetrics } = await supabase
        .from('database_metrics')
        .select('*')
        .order('collected_at', { ascending: false })
        .limit(24) // Last 24 hours if collected hourly

      const current = await this.collectMetrics()

      return {
        current,
        historical: recentMetrics?.reverse() || [],
        healthScore: await this.getDatabaseHealthScore(),
        trends: this.calculateTrends(recentMetrics || [])
      }

    } catch (error) {
      logger.error({
        event: 'db_metrics_dashboard_failed',
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to get database metrics for dashboard')
      return null
    }
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(metrics: any[]) {
    if (metrics.length < 2) return {}

    const latest = metrics[metrics.length - 1]
    const previous = metrics[metrics.length - 2]

    return {
      connectionsTrend: this.calculateChange(latest.total_connections, previous.total_connections),
      queryTimeTrend: this.calculateChange(latest.avg_query_time_ms, previous.avg_query_time_ms),
      cacheHitRatioTrend: this.calculateChange(latest.cache_hit_ratio, previous.cache_hit_ratio),
      slowQueriesTrend: this.calculateChange(latest.slow_queries_count, previous.slow_queries_count)
    }
  }

  private calculateChange(current: number, previous: number): { value: number; direction: 'up' | 'down' | 'stable' } {
    if (!previous || previous === 0) return { value: 0, direction: 'stable' }
    
    const change = ((current - previous) / previous) * 100
    
    return {
      value: Math.abs(change),
      direction: change > 1 ? 'up' : change < -1 ? 'down' : 'stable'
    }
  }
}

// Export singleton instance
export const dbMetrics = new DatabaseMetricsCollector()

// Auto-start in production
if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  dbMetrics.start()
}