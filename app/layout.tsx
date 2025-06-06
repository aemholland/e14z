export const metadata = {
  title: 'E14Z MCP Registry',
  description: 'Universal MCP registry and execution platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}