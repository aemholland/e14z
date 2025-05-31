export interface InstallationMethod {
  type: 'npm' | 'pip' | 'git' | 'docker' | 'binary' | 'other'
  command: string
  description?: string
  priority: number
  confidence: number
}

export interface ToolParameter {
  name: string
  type: string
  required: boolean
  description?: string
}

export interface Tool {
  name: string
  description?: string
  category?: string
  parameters?: (string | ToolParameter)[]
}

export interface MCP {
  id: string
  slug: string
  name: string
  description?: string
  endpoint: string
  install_type?: 'npm' | 'pip' | 'git' | 'docker' | 'binary' | 'other'
  installation_methods?: InstallationMethod[]
  tools?: Tool[]
  connection_type: 'stdio' | 'http' | 'websocket'
  auth_method?: string
  protocol_version: string
  rating?: number
  tool_endpoints: string[]
  category: string
  tags: string[] // Keep in type but hide from UI
  use_cases: string[]
  verified: boolean
  verified_at?: string
  verification_notes?: string
  github_url?: string
  documentation_url?: string
  website_url?: string
  pricing_model: 'free' | 'usage' | 'subscription' | 'custom'
  pricing_details: Record<string, any>
  author?: string
  company?: string
  license?: string
  auto_discovered: boolean
  discovery_source?: string
  quality_score?: number
  last_scraped_at?: string
  health_status: 'healthy' | 'degraded' | 'down' | 'unknown'
  last_health_check?: string
  created_at: string
  updated_at: string
  search_vector?: string
}

export interface PerformanceLog {
  id: string
  mcp_id: string
  latency_ms?: number
  success: boolean
  error_type?: string
  error_message?: string
  agent_type?: string
  use_case?: string
  request_size?: number
  response_size?: number
  session_id?: string
  created_at: string
}

export interface Review {
  id: string
  mcp_id: string
  rating: number
  review_text?: string
  agent_type?: string
  agent_version?: string
  use_case?: string
  tasks_completed?: number
  tasks_failed?: number
  avg_latency_experienced?: number
  session_id: string
  discovery_session_id?: string
  created_at: string
}

export interface APICall {
  id: string
  endpoint: string
  method: string
  query?: string
  filters?: Record<string, any>
  results_count?: number
  results_mcp_ids?: string[]
  user_agent?: string
  agent_type?: string
  api_key_id?: string
  session_id?: string
  response_time_ms?: number
  created_at: string
}

export interface HealthCheck {
  id: string
  mcp_id: string
  is_reachable?: boolean
  response_time_ms?: number
  protocol_version?: string
  available_tools?: string[]
  status_code?: number
  ssl_valid?: boolean
  ssl_expiry?: string
  error_type?: string
  error_message?: string
  check_location?: string
  pulse_version?: string
  checked_at: string
}

export interface SearchOptions {
  query: string
  filters?: {
    pricing?: 'free' | 'paid'
    minRating?: number
    verified?: boolean
    hasReviews?: boolean
    healthStatus?: 'healthy' | 'degraded' | 'down'
  }
  limit?: number
  offset?: number
}

export interface RankedResult {
  mcp: MCP
  relevanceScore: number
  qualityScore: number
  healthScore: number
  totalScore: number
  highlights?: {
    name?: string
    description?: string
  }
}

export interface MCPStats {
  id: string
  slug: string
  name: string
  health_status: string
  total_reviews: number
  avg_rating: number
  total_calls_30d: number
  avg_latency_ms: number
  p95_latency_ms: number
  success_rate: number
  unique_sessions_30d: number
  unique_agent_types: number
  avg_health_check_response: number
  total_incidents_30d: number
  last_used?: string
  last_health_check?: string
  last_pulse_update?: string
}