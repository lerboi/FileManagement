// src/components/tasks/tabs/OverviewTab.jsx
'use client'

export default function OverviewTab({ taskDetail, formatDate }) {
  return (
    <div className="space-y-6">
      {/* Task Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Task Information</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Service</label>
              <p className="text-sm text-gray-900">{taskDetail.service_name}</p>
              {taskDetail.service_description && (
                <p className="text-xs text-gray-600">{taskDetail.service_description}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Priority</label>
              <p className="text-sm text-gray-900 capitalize">{taskDetail.priority || 'normal'}</p>
            </div>
            {taskDetail.assigned_to && (
              <div>
                <label className="text-sm font-medium text-gray-500">Assigned To</label>
                <p className="text-sm text-gray-900">{taskDetail.assigned_to}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">Created</label>
              <p className="text-sm text-gray-900">{formatDate(taskDetail.created_at)}</p>
            </div>
            {taskDetail.completed_at && (
              <div>
                <label className="text-sm font-medium text-gray-500">Completed</label>
                <p className="text-sm text-gray-900">{formatDate(taskDetail.completed_at)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Client Information</h3>
          <div className="space-y-3">
            {taskDetail.clients && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <p className="text-sm text-gray-900">
                    {taskDetail.clients.first_name} {taskDetail.clients.last_name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-sm text-gray-900">{taskDetail.clients.email || 'Not provided'}</p>
                </div>
                {taskDetail.clients.phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <p className="text-sm text-gray-900">{taskDetail.clients.phone}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Custom Fields */}
      {taskDetail.custom_field_values && Object.keys(taskDetail.custom_field_values).length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Custom Field Values</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(taskDetail.custom_field_values).map(([key, value]) => (
              <div key={key}>
                <label className="text-sm font-medium text-gray-500 capitalize">
                  {key.replace(/_/g, ' ')}
                </label>
                <p className="text-sm text-gray-900">
                  {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value || 'Not provided'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {taskDetail.notes && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Notes</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{taskDetail.notes}</p>
        </div>
      )}
    </div>
  )
}