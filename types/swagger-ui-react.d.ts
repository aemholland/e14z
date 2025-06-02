declare module 'swagger-ui-react' {
  import * as React from 'react'

  interface SwaggerUIProps {
    url?: string
    spec?: any
    onComplete?: (system: any) => void
    requestInterceptor?: (req: any) => any
    responseInterceptor?: (res: any) => any
    onFailure?: (err: any) => void
    docExpansion?: 'list' | 'full' | 'none'
    defaultModelsExpandDepth?: number
    defaultModelExpandDepth?: number
    displayOperationId?: boolean
    displayRequestDuration?: boolean
    filter?: boolean | string
    showExtensions?: boolean
    showCommonExtensions?: boolean
    tryItOutEnabled?: boolean
    plugins?: any[]
    layout?: string
    deepLinking?: boolean
    persistAuthorization?: boolean
    supportedSubmitMethods?: string[]
    validatorUrl?: string | null
    oauth2RedirectUrl?: string
    presets?: any[]
    [key: string]: any
  }

  const SwaggerUI: React.FC<SwaggerUIProps>
  export default SwaggerUI
}