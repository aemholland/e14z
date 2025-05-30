import { notFound } from 'next/navigation'
import { getMCPBySlug } from '@/lib/search/engine'
import { MCPDetailPageClient } from './MCPDetailPageClient'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function MCPDetailPage({ params }: PageProps) {
  const { slug } = await params
  const mcp = await getMCPBySlug(slug)

  if (!mcp) {
    notFound()
  }

  return <MCPDetailPageClient mcp={mcp} />
}