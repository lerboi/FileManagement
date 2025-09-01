// src/components/tasks/TaskStatusBadge.jsx
'use client'

export default function TaskStatusBadge({ status, isDraft, size = 'sm' }) {
  const getStatusConfig = () => {
    if (isDraft) {
      return {
        label: 'Draft',
        colors: 'bg-purple-100 text-purple-800 border-purple-200'
      }
    }

    switch (status) {
      case 'in_progress':
        return {
          label: 'In Progress',
          colors: 'bg-blue-100 text-blue-800 border-blue-200'
        }
      case 'awaiting':
        return {
          label: 'Awaiting',
          colors: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        }
      case 'completed':
        return {
          label: 'Completed',
          colors: 'bg-green-100 text-green-800 border-green-200'
        }
      default:
        return {
          label: status || 'Unknown',
          colors: 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }
  }

  const config = getStatusConfig()
  const sizeClasses = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${sizeClasses} ${config.colors}`}>
      {config.label}
    </span>
  )
}