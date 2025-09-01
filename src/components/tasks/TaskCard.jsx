// src/components/tasks/TaskCard.jsx
'use client'

import TaskStatusBadge from './TaskStatusBadge'

export default function TaskCard({ task, onView, onRetry, onDownload, onDelete, onEditDraft}) {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'awaiting':
        return (
          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'in_progress':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
    }
  }

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600 bg-red-100'
      case 'high':
        return 'text-yellow-600 bg-yellow-100'
      case 'normal':
        return 'text-blue-600 bg-blue-100'
      case 'low':
        return 'text-gray-600 bg-gray-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  // Count generated documents for status-specific actions
  const generatedDocsCount = task.generated_documents?.filter(doc => doc.status === 'generated').length || 0
  const signedDocsCount = task.signed_documents?.length || 0

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Task Header */}
          <div className="flex items-center space-x-3 mb-3">
            {getStatusIcon(task.status)}
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900 truncate">
                {task.service_name}
              </h3>
              <p className="text-sm text-gray-600">
                Client: {task.client_name}
              </p>
            </div>
          </div>
          
          {/* Task Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Service</p>
              <p className="text-sm text-gray-900">{task.service_name}</p>
              {task.service_description && (
                <p className="text-xs text-gray-600 line-clamp-1">{task.service_description}</p>
              )}
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <div className="flex items-center mt-1">
                <TaskStatusBadge status={task.status} isDraft={task.is_draft} />
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500">Priority</p>
              <div className="flex items-center mt-1">
                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${getPriorityColor(task.priority)}`}>
                  {task.priority || 'normal'}
                </span>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500">Created</p>
              <p className="text-sm text-gray-900">{formatDate(task.created_at)}</p>
            </div>
          </div>

          {/* Completion Time */}
          {task.completed_at && (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-500">Completed</p>
              <p className="text-sm text-gray-900">{formatDate(task.completed_at)}</p>
            </div>
          )}

          {/* Generation Info */}
          {task.status === 'awaiting' && task.generation_completed_at && (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-500">Documents Generated</p>
              <p className="text-sm text-gray-900">{formatDate(task.generation_completed_at)}</p>
              {signedDocsCount > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  {signedDocsCount} signed document{signedDocsCount !== 1 ? 's' : ''} uploaded
                </p>
              )}
            </div>
          )}

          {/* Error Message */}
          {task.generation_error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-red-800">
                  <p className="font-medium">Generation Error</p>
                  <p>{task.generation_error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Assignment and Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-3">
            {task.assigned_to && (
              <div>
                <p className="font-medium text-gray-500">Assigned To</p>
                <p className="text-gray-900">{task.assigned_to}</p>
              </div>
            )}
            
            {task.notes && (
              <div>
                <p className="font-medium text-gray-500">Notes</p>
                <p className="text-gray-900 line-clamp-2">{task.notes}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Delete Button - Top Right */}
        <div className="ml-4">
          <button
            onClick={() => onDelete?.(task)}
            className="inline-flex items-center p-2 text-red-600 hover:bg-red-50 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            title="Delete task"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Bottom Action Buttons - All Bottom Right */}
      <div className="flex justify-end">
        <div className="flex space-x-2">
          {/* Draft-specific actions */}
          {task.is_draft ? (
            <button
              onClick={() => onEditDraft(task)}
              className="inline-flex items-center px-3 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Continue Editing
            </button>
          ) : (
            <>
              {/* Status-specific actions for non-draft tasks */}
              {task.status === 'in_progress' && (
                <button
                  onClick={() => onView(task)}
                  className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate Docs
                </button>
              )}
              
              {task.generation_error && (
                <button
                  onClick={() => onRetry(task)}
                  className="inline-flex items-center px-3 py-2 border border-orange-300 rounded-md text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retry
                </button>
              )}

              {/* View Button - Always show for non-draft tasks */}
              <button
                onClick={() => onView(task)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 616 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}