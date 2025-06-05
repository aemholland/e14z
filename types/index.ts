export interface InstallationMethod {
  type: 'npm' | 'pipx' | 'cargo' | 'go' | 'e14z'
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
  // Core Identity
  id: string
  slug: string
  name: string
  description?: string
  endpoint: string
  category: string
  
  // Enhanced Installation Data
  install_type?: 'npm' | 'pipx' | 'cargo' | 'go' | 'e14z'
  auto_install_command?: string
  installation_methods?: InstallationMethod[]
  
  // Real MCP Protocol Data (from actual connection)
  tools?: Tool[]
  available_resources?: any[]
  prompt_templates?: any[]
  mcp_protocol_data?: {
    version?: string
    connection_working?: boolean
    tools_count?: number
    resources_count?: number
    prompts_count?: number
    total_functionality?: number
    functionality_breakdown?: any
    server_info?: any
    capabilities?: any
    stderr_output?: string
    raw_error_data?: string
    additional_data?: any
  }
  
  // Connection & Protocol
  connection_type: 'stdio' | 'http' | 'websocket'
  protocol_version: string
  
  // Enhanced Authentication (from real MCP connection)
  auth_required?: boolean
  auth_method?: string
  required_env_vars?: string[]
  setup_complexity?: string
  
  // AI-Generated Intelligence Scores
  overall_intelligence_score?: number
  reliability_score?: number
  
  // Enhanced Search & Discovery
  tags: string[] // Enhanced with 20+ searchable terms
  use_cases: string[] // Minimum 3-5 specific use cases
  
  // Verification & Quality
  verified: boolean
  verified_at?: string
  verification_notes?: string
  quality_score?: number
  quality_breakdown?: {
    documentation_quality?: string
    setup_complexity?: string
    maintenance_level?: string
    business_value?: string
  }
  
  // URLs & Documentation
  github_url?: string
  documentation_url?: string
  website_url?: string
  
  // Business Information
  pricing_model: 'free' | 'usage' | 'subscription' | 'custom'
  pricing_details: Record<string, any>
  author?: string
  company?: string
  license?: string
  
  // Discovery Metadata
  auto_discovered: boolean
  discovery_source?: string
  discovery_confidence?: string
  intelligence_collection_date?: string
  
  // Health & Performance
  health_status: 'healthy' | 'degraded' | 'down' | 'unknown' | 'pending'
  last_health_check?: string
  connection_stability?: string
  
  // Legacy/Deprecated Fields
  rating?: number
  tool_endpoints?: string[]
  last_scraped_at?: string
  
  // System Fields
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
    noAuth?: boolean
    authRequired?: boolean
    executable?: boolean
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