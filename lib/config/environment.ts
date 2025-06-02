/**
 * Environment Configuration Manager for E14Z (2025)
 * Secure validation and management of environment variables
 */
import { z } from 'zod'
import { logger } from '@/lib/logging/config'

// Load environment variables from .env files
if (typeof window === 'undefined') {
  try {
    require('dotenv').config({ path: '.env.local' })
    require('dotenv').config({ path: '.env' })
  } catch (error) {
    // Dotenv not available or already loaded
  }
}

// Environment variable schemas with validation
const envSchema = z.object({
  // === Node.js Environment ===
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  
  // === Database Configuration ===
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key required'),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  DATABASE_TIMEOUT: z.coerce.number().int().min(1000).max(300000).default(30000),
  DATABASE_IDLE_TIMEOUT: z.coerce.number().int().min(1000).max(60000).default(10000),

  // === Security Configuration ===
  JWT_SECRET_KEY: z.string()
    .min(32, 'JWT secret key must be at least 32 characters')
    .refine(val => !val.includes('CHANGE_ME'), 'JWT secret key must be changed from default'),
  JWT_REFRESH_SECRET: z.string()
    .min(32, 'JWT refresh secret must be at least 32 characters')
    .refine(val => !val.includes('CHANGE_ME'), 'JWT refresh secret must be changed from default'),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
  JWT_ALGORITHM: z.enum(['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512']).default('RS256'),

  ENCRYPTION_KEY: z.string()
    .length(128, 'Encryption key must be exactly 128 characters (64 bytes hex)')
    .refine(val => /^[0-9a-f]{128}$/i.test(val), 'Encryption key must be valid hex')
    .refine(val => !val.includes('CHANGE_ME'), 'Encryption key must be changed from default'),
  IDOR_ENCRYPTION_KEY: z.string()
    .length(128, 'IDOR encryption key must be exactly 128 characters (64 bytes hex)')
    .refine(val => /^[0-9a-f]{128}$/i.test(val), 'IDOR encryption key must be valid hex')
    .refine(val => !val.includes('CHANGE_ME'), 'IDOR encryption key must be changed from default'),

  SESSION_SECRET: z.string()
    .min(32, 'Session secret must be at least 32 characters')
    .refine(val => !val.includes('CHANGE_ME'), 'Session secret must be changed from default'),
  COOKIE_SECRET: z.string()
    .min(32, 'Cookie secret must be at least 32 characters')
    .refine(val => !val.includes('CHANGE_ME'), 'Cookie secret must be changed from default'),
  CSRF_SECRET: z.string()
    .min(24, 'CSRF secret must be at least 24 characters')
    .refine(val => !val.includes('CHANGE_ME'), 'CSRF secret must be changed from default'),

  // === Rate Limiting ===
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  RATE_LIMIT_WINDOW: z.coerce.number().int().min(1000).max(3600000).default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(10000).default(100),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: z.coerce.boolean().default(false),

  // === AI Providers (at least one required) ===
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LOCAL_LLM_URL: z.string().url().optional(),
  LOCAL_LLM_MODEL: z.string().optional(),

  // === External APIs ===
  GITHUB_TOKEN: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),

  // === Monitoring & Observability ===
  OTEL_SERVICE_NAME: z.string().default('e14z-production'),
  OTEL_SERVICE_VERSION: z.string().default('1.0.0'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  OTEL_RESOURCE_ATTRIBUTES: z.string().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('warn'),
  PINO_LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('warn'),
  LOG_PRETTY: z.coerce.boolean().default(false),

  // === Security Monitoring ===
  SECURITY_ALERT_WEBHOOK: z.string().url().optional(),
  SECURITY_EMAIL_ALERTS: z.string().email().optional(),
  IDS_ENABLED: z.coerce.boolean().default(true),
  IDS_SENSITIVITY: z.enum(['low', 'medium', 'high']).default('medium'),
  THREAT_DETECTION_ENABLED: z.coerce.boolean().default(true),
  THREAT_DETECTION_LOG_ALL: z.coerce.boolean().default(false),
  SECURITY_AUDIT_ENABLED: z.coerce.boolean().default(true),
  SECURITY_AUDIT_INTERVAL: z.coerce.number().int().min(3600000).default(86400000), // Min 1 hour
  SECURITY_AUDIT_WEBHOOK: z.string().url().optional(),

  // === Application URLs ===
  NEXT_PUBLIC_APP_URL: z.string().url('Invalid app URL'),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().default(''),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),
  CORS_MAX_AGE: z.coerce.number().int().min(0).default(86400),

  // === Security Headers ===
  ENABLE_SECURITY_HEADERS: z.coerce.boolean().default(true),
  CONTENT_SECURITY_POLICY: z.enum(['strict', 'moderate', 'disabled']).default('strict'),
  X_FRAME_OPTIONS: z.enum(['DENY', 'SAMEORIGIN']).default('DENY'),
  REFERRER_POLICY: z.enum([
    'no-referrer', 'no-referrer-when-downgrade', 'origin',
    'origin-when-cross-origin', 'same-origin', 'strict-origin',
    'strict-origin-when-cross-origin', 'unsafe-url'
  ]).default('strict-origin-when-cross-origin'),

  // === Feature Flags ===
  ENABLE_ANALYTICS: z.coerce.boolean().default(true),
  ENABLE_CACHING: z.coerce.boolean().default(true),
  ENABLE_RBAC: z.coerce.boolean().default(true),
  ENABLE_IDOR_PROTECTION: z.coerce.boolean().default(true),
  ENABLE_XSS_PROTECTION: z.coerce.boolean().default(true),
  ENABLE_RATE_LIMITING: z.coerce.boolean().default(true),
  ENABLE_REQUEST_ID: z.coerce.boolean().default(true),

  // === SMTP Configuration ===
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_NAME: z.string().default('E14Z Security System'),

  // === Backup Configuration ===
  BACKUP_ENABLED: z.coerce.boolean().default(true),
  BACKUP_ENCRYPTION_KEY: z.string()
    .length(128, 'Backup encryption key must be exactly 128 characters')
    .refine(val => /^[0-9a-f]{128}$/i.test(val), 'Backup encryption key must be valid hex')
    .refine(val => !val.includes('CHANGE_ME'), 'Backup encryption key must be changed from default')
    .optional(),
  BACKUP_INTERVAL: z.coerce.number().int().min(3600000).default(86400000), // Min 1 hour
  BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  BACKUP_S3_BUCKET: z.string().optional(),
  BACKUP_S3_REGION: z.string().default('us-east-1'),
  BACKUP_S3_ACCESS_KEY: z.string().optional(),
  BACKUP_S3_SECRET_KEY: z.string().optional(),

  // === Development Overrides (should only be used in development) ===
  DEV_DISABLE_RATE_LIMITING: z.coerce.boolean().optional(),
  DEV_DISABLE_CSRF: z.coerce.boolean().optional(),
  DEV_DISABLE_SECURITY_HEADERS: z.coerce.boolean().optional(),
  DEV_LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).optional(),
  DEV_DISABLE_JWT_VERIFICATION: z.coerce.boolean().optional()
})

// Add custom validation for AI providers
const envSchemaWithCustomValidation = envSchema.refine(
  (data) => {
    // At least one AI provider must be configured
    const hasOpenAI = !!data.OPENAI_API_KEY
    const hasAnthropic = !!data.ANTHROPIC_API_KEY
    const hasLocal = !!(data.LOCAL_LLM_URL && data.LOCAL_LLM_MODEL)
    
    return hasOpenAI || hasAnthropic || hasLocal
  },
  {
    message: 'At least one AI provider must be configured (OpenAI, Anthropic, or Local LLM)',
    path: ['OPENAI_API_KEY']
  }
).refine(
  (data) => {
    // In production, development overrides should not be used
    if (data.NODE_ENV === 'production') {
      const devOverrides = [
        data.DEV_DISABLE_RATE_LIMITING,
        data.DEV_DISABLE_CSRF,
        data.DEV_DISABLE_SECURITY_HEADERS,
        data.DEV_DISABLE_JWT_VERIFICATION
      ]
      return !devOverrides.some(override => override === true)
    }
    return true
  },
  {
    message: 'Development overrides should not be enabled in production',
    path: ['NODE_ENV']
  }
)

export type EnvConfig = z.infer<typeof envSchema>

class EnvironmentManager {
  private config: EnvConfig | null = null
  private validationErrors: string[] = []

  /**
   * Load and validate environment configuration
   */
  public loadConfig(): EnvConfig {
    if (this.config) return this.config

    try {
      // Parse and validate environment variables
      const result = envSchemaWithCustomValidation.safeParse(process.env)
      
      if (!result.success) {
        this.validationErrors = result.error.errors.map(
          err => `${err.path.join('.')}: ${err.message}`
        )
        
        logger.error('Environment validation failed', {
          errors: this.validationErrors,
          missingKeys: this.findMissingKeys()
        })
        
        throw new Error(`Environment validation failed:\n${this.validationErrors.join('\n')}`)
      }
      
      this.config = result.data
      
      // Log successful configuration (without sensitive data)
      logger.info('Environment configuration loaded successfully', {
        nodeEnv: this.config.NODE_ENV,
        featuresEnabled: {
          analytics: this.config.ENABLE_ANALYTICS,
          rbac: this.config.ENABLE_RBAC,
          idor: this.config.ENABLE_IDOR_PROTECTION,
          xss: this.config.ENABLE_XSS_PROTECTION,
          rateLimiting: this.config.ENABLE_RATE_LIMITING
        },
        aiProviders: this.getConfiguredAIProviders()
      })
      
      return this.config
    } catch (error) {
      logger.fatal('Failed to load environment configuration', { error })
      throw error
    }
  }

  /**
   * Get current configuration (throws if not loaded)
   */
  public getConfig(): EnvConfig {
    if (!this.config) {
      throw new Error('Environment configuration not loaded. Call loadConfig() first.')
    }
    return this.config
  }

  /**
   * Check if running in production environment
   */
  public isProduction(): boolean {
    return this.getConfig().NODE_ENV === 'production'
  }

  /**
   * Check if running in development environment
   */
  public isDevelopment(): boolean {
    return this.getConfig().NODE_ENV === 'development'
  }

  /**
   * Get validation errors from last load attempt
   */
  public getValidationErrors(): string[] {
    return [...this.validationErrors]
  }

  /**
   * Validate that all required secrets are properly configured
   */
  public validateSecrets(): boolean {
    const config = this.getConfig()
    
    const requiredSecrets = [
      'JWT_SECRET_KEY',
      'JWT_REFRESH_SECRET',
      'ENCRYPTION_KEY',
      'IDOR_ENCRYPTION_KEY',
      'SESSION_SECRET',
      'COOKIE_SECRET',
      'CSRF_SECRET'
    ]
    
    const invalidSecrets = requiredSecrets.filter(key => {
      const value = config[key as keyof EnvConfig] as string
      return !value || value.includes('CHANGE_ME') || value.length < 32
    })
    
    if (invalidSecrets.length > 0) {
      logger.error('Invalid or default secrets detected', { invalidSecrets })
      return false
    }
    
    return true
  }

  /**
   * Get security configuration summary
   */
  public getSecurityConfig() {
    const config = this.getConfig()
    
    return {
      jwtAlgorithm: config.JWT_ALGORITHM,
      accessTokenExpiry: config.JWT_ACCESS_TOKEN_EXPIRY,
      refreshTokenExpiry: config.JWT_REFRESH_TOKEN_EXPIRY,
      idsEnabled: config.IDS_ENABLED,
      idsSensitivity: config.IDS_SENSITIVITY,
      threatDetectionEnabled: config.THREAT_DETECTION_ENABLED,
      securityHeadersEnabled: config.ENABLE_SECURITY_HEADERS,
      contentSecurityPolicy: config.CONTENT_SECURITY_POLICY,
      xFrameOptions: config.X_FRAME_OPTIONS,
      referrerPolicy: config.REFERRER_POLICY,
      rateLimitWindow: config.RATE_LIMIT_WINDOW,
      rateLimitMaxRequests: config.RATE_LIMIT_MAX_REQUESTS,
      corsCredentials: config.CORS_CREDENTIALS,
      corsMaxAge: config.CORS_MAX_AGE
    }
  }

  /**
   * Get allowed origins as array
   */
  public getAllowedOrigins(): string[] {
    const config = this.getConfig()
    return config.ALLOWED_ORIGINS.split(',').map((origin: string) => origin.trim()).filter(Boolean)
  }

  private findMissingKeys(): string[] {
    const required = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'JWT_SECRET_KEY',
      'JWT_REFRESH_SECRET',
      'ENCRYPTION_KEY',
      'IDOR_ENCRYPTION_KEY',
      'SESSION_SECRET',
      'COOKIE_SECRET',
      'CSRF_SECRET',
      'NEXT_PUBLIC_APP_URL'
    ]
    
    return required.filter(key => !process.env[key])
  }

  private getConfiguredAIProviders(): string[] {
    const config = this.getConfig()
    const providers: string[] = []
    
    if (config.OPENAI_API_KEY) providers.push('OpenAI')
    if (config.ANTHROPIC_API_KEY) providers.push('Anthropic')
    if (config.LOCAL_LLM_URL && config.LOCAL_LLM_MODEL) providers.push('Local LLM')
    
    return providers
  }

  /**
   * Hot reload configuration (for development)
   */
  public reloadConfig(): EnvConfig {
    this.config = null
    this.validationErrors = []
    return this.loadConfig()
  }
}

// Export singleton instance
export const env = new EnvironmentManager()

// Export for testing
export { EnvironmentManager }

// Initialize configuration on module load
try {
  env.loadConfig()
} catch (error) {
  // In production, fail fast on configuration errors
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: Environment configuration failed:', error)
    process.exit(1)
  } else {
    console.warn('Environment configuration failed (development mode):', error)
  }
}