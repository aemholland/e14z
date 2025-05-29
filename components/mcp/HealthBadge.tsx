interface HealthBadgeProps {
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
}

export function HealthBadge({ status }: HealthBadgeProps) {
  const config = {
    healthy: {
      color: 'bg-green-100 text-green-800',
      dot: 'bg-green-400',
      label: 'Healthy'
    },
    degraded: {
      color: 'bg-yellow-100 text-yellow-800',
      dot: 'bg-yellow-400',
      label: 'Degraded'
    },
    down: {
      color: 'bg-red-100 text-red-800',
      dot: 'bg-red-400',
      label: 'Down'
    },
    unknown: {
      color: 'bg-gray-100 text-gray-800',
      dot: 'bg-gray-400',
      label: 'Unknown'
    }
  }

  const { color, dot, label } = config[status]

  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${dot}`}></div>
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    </div>
  )
}