/**
 * Crawler Scheduler
 * 
 * Handles scheduling of the MCP crawler for automated daily runs
 * Supports multiple scheduling methods (cron, intervals, external)
 * 
 * INACTIVE BY DEFAULT - Requires manual activation
 */

import { mcpCrawler, type CrawlerResult } from './mcpCrawler'
import { supabase } from '@/lib/supabase/client'

interface SchedulerConfig {
  enabled: boolean
  schedule: string // cron format: "0 6 * * *" = daily at 6am
  timezone: string
  retryAttempts: number
  retryDelayMs: number
  webhookUrl?: string
  emailNotifications?: string[]
}

interface CrawlerRun {
  id: string
  started_at: string
  completed_at?: string
  status: 'running' | 'completed' | 'failed'
  result?: CrawlerResult
  error?: string
  duration_ms?: number
}

/**
 * Crawler Scheduler Class
 */
export class CrawlerScheduler {
  private config: SchedulerConfig
  private intervalId?: NodeJS.Timeout
  private isRunning = false

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = {
      enabled: false, // DISABLED BY DEFAULT
      schedule: '0 6 * * *', // Daily at 6 AM UTC
      timezone: 'UTC',
      retryAttempts: 3,
      retryDelayMs: 300000, // 5 minutes
      ...config
    }
  }

  /**
   * Check if scheduler is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && mcpCrawler.isEnabled()
  }

  /**
   * Enable/disable the scheduler
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
    
    if (enabled) {
      this.start()
    } else {
      this.stop()
    }
    
    console.log(`Crawler Scheduler ${enabled ? 'ENABLED' : 'DISABLED'}`)
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('⏸️ Scheduler disabled, not starting')
      return
    }

    if (this.intervalId) {
      console.log('⚠️ Scheduler already running')
      return
    }

    console.log(`⏰ Starting crawler scheduler with schedule: ${this.config.schedule}`)
    
    // Calculate next run time
    const nextRun = this.calculateNextRun()
    console.log(`📅 Next crawler run scheduled for: ${nextRun.toISOString()}`)

    // Set up interval for checking schedule
    this.intervalId = setInterval(() => {
      this.checkSchedule()
    }, 60000) // Check every minute

    console.log('✅ Crawler scheduler started')
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
      console.log('🛑 Crawler scheduler stopped')
    }
  }

  /**
   * Manually trigger a crawler run
   */
  async triggerCrawler(): Promise<CrawlerResult> {
    if (this.isRunning) {
      throw new Error('Crawler is already running')
    }

    console.log('🚀 Manually triggering crawler run...')
    return this.executeCrawlerRun()
  }

  /**
   * Get crawler run history
   */
  async getRunHistory(limit = 10): Promise<CrawlerRun[]> {
    const { data, error } = await supabase
      .from('crawler_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching crawler run history:', error)
      return []
    }

    return data || []
  }

  /**
   * Get last successful run
   */
  async getLastSuccessfulRun(): Promise<CrawlerRun | null> {
    const { data, error } = await supabase
      .from('crawler_runs')
      .select('*')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null
    return data
  }

  /**
   * Check if it's time to run based on schedule
   */
  private checkSchedule(): void {
    if (!this.config.enabled || this.isRunning) return

    const now = new Date()
    const shouldRun = this.shouldRunNow(now)

    if (shouldRun) {
      console.log('⏰ Scheduled crawler run triggered')
      this.executeCrawlerRun().catch(error => {
        console.error('Scheduled crawler run failed:', error)
      })
    }
  }

  /**
   * Execute a crawler run with error handling and logging
   */
  private async executeCrawlerRun(): Promise<CrawlerResult> {
    if (this.isRunning) {
      throw new Error('Crawler is already running')
    }

    this.isRunning = true
    const runId = crypto.randomUUID()
    const startTime = Date.now()

    // Log run start
    const runRecord: Omit<CrawlerRun, 'id'> = {
      id: runId,
      started_at: new Date().toISOString(),
      status: 'running'
    }

    await this.logCrawlerRun(runRecord)

    try {
      console.log(`🕷️ Starting crawler run ${runId}`)
      
      // Execute crawler with retries
      const result = await this.executeWithRetries()
      const duration = Date.now() - startTime

      // Log successful completion
      const completedRecord: CrawlerRun = {
        ...runRecord,
        status: 'completed',
        completed_at: new Date().toISOString(),
        result,
        duration_ms: duration
      }

      await this.logCrawlerRun(completedRecord)
      await this.sendNotification(completedRecord)

      console.log(`✅ Crawler run ${runId} completed successfully in ${duration}ms`)
      console.log(`📊 Results: ${result.processed} processed, ${result.failed} failed`)

      return result

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      // Log failed run
      const failedRecord: CrawlerRun = {
        ...runRecord,
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: errorMsg,
        duration_ms: duration
      }

      await this.logCrawlerRun(failedRecord)
      await this.sendNotification(failedRecord)

      console.error(`❌ Crawler run ${runId} failed after ${duration}ms:`, error)
      throw error

    } finally {
      this.isRunning = false
    }
  }

  /**
   * Execute crawler with retry logic
   */
  private async executeWithRetries(): Promise<CrawlerResult> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`🔄 Crawler attempt ${attempt}/${this.config.retryAttempts}`)
        return await mcpCrawler.run()

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        console.error(`❌ Crawler attempt ${attempt} failed:`, error)

        if (attempt < this.config.retryAttempts) {
          console.log(`⏳ Retrying in ${this.config.retryDelayMs}ms...`)
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs))
        }
      }
    }

    throw lastError
  }

  /**
   * Log crawler run to database
   */
  private async logCrawlerRun(run: Omit<CrawlerRun, 'id'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('crawler_runs')
        .upsert([run])

      if (error) {
        console.error('Error logging crawler run:', error)
      }
    } catch (error) {
      console.error('Error logging crawler run:', error)
    }
  }

  /**
   * Send notification about crawler run
   */
  private async sendNotification(run: CrawlerRun): Promise<void> {
    try {
      // Webhook notification
      if (this.config.webhookUrl) {
        await this.sendWebhookNotification(run)
      }

      // Email notifications (if configured)
      if (this.config.emailNotifications?.length) {
        await this.sendEmailNotification(run)
      }

    } catch (error) {
      console.error('Error sending notification:', error)
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(run: CrawlerRun): Promise<void> {
    if (!this.config.webhookUrl) return

    await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'crawler_run',
        run,
        timestamp: new Date().toISOString()
      })
    })
  }

  /**
   * Send email notification (placeholder - integrate with your email service)
   */
  private async sendEmailNotification(run: CrawlerRun): Promise<void> {
    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    console.log('📧 Email notification would be sent here:', {
      to: this.config.emailNotifications,
      subject: `MCP Crawler ${run.status}`,
      status: run.status,
      result: run.result
    })
  }

  /**
   * Calculate next run time based on cron schedule
   */
  private calculateNextRun(): Date {
    // Simple daily schedule calculation (6 AM UTC)
    const now = new Date()
    const nextRun = new Date(now)
    nextRun.setUTCHours(6, 0, 0, 0)
    
    if (nextRun <= now) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1)
    }
    
    return nextRun
  }

  /**
   * Check if should run now based on schedule
   */
  private shouldRunNow(now: Date): boolean {
    // Simple check for daily 6 AM UTC run
    const hour = now.getUTCHours()
    const minute = now.getUTCMinutes()
    
    // Run at 6:00 AM UTC (within 1-minute window)
    return hour === 6 && minute === 0
  }
}

/**
 * Singleton scheduler instance
 */
export const crawlerScheduler = new CrawlerScheduler()

/**
 * Manual functions for controlling scheduler
 */
export function enableScheduler(enabled: boolean): void {
  crawlerScheduler.setEnabled(enabled)
}

export function startScheduler(): void {
  crawlerScheduler.start()
}

export function stopScheduler(): void {
  crawlerScheduler.stop()
}

export function triggerCrawler(): Promise<CrawlerResult> {
  return crawlerScheduler.triggerCrawler()
}

export function isSchedulerEnabled(): boolean {
  return crawlerScheduler.isEnabled()
}