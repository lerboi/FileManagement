// src/components/tasks/TaskPreviewStep.jsx
'use client'

export default function TaskPreviewStep({ 
  formData, 
  selectedService, 
  selectedClient, 
  customFields = [],
  onFormDataUpdate 
}) {
  const handleNotesChange = (e) => {
    onFormDataUpdate({ notes: e.target.value })
  }

  const handlePriorityChange = (e) => {
    onFormDataUpdate({ priority: e.target.value })
  }

  const handleAssignedToChange = (e) => {
    onFormDataUpdate({ assigned_to: e.target.value || null })
  }

  const formatClientAddress = (client) => {
    const addressParts = [
      client.address_line_1,
      client.address_line_2,
      client.city,
      client.state,
      client.postal_code,
      client.country
    ].filter(Boolean)
    
    return addressParts.length > 0 ? addressParts.join(', ') : 'Not provided'
  }

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      normal: 'bg-blue-100 text-blue-800',
      high: 'bg-yellow-100 text-yellow-800',
      urgent: 'bg-red-100 text-red-800'
    }
    return colors[priority] || colors.normal
  }

  const completedRequiredFields = customFields
    .filter(field => field.required)
    .filter(field => {
      const value = formData.custom_field_values[field.name] || formData.custom_field_values[field.label]
      return value && (typeof value !== 'string' || value.trim())
    })

  const allRequiredFields = customFields.filter(field => field.required)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Review & Create Task
        </h3>
        <p className="text-gray-600">
          Review your task details before creating. You can modify settings and add notes below.
        </p>
      </div>

      <div className="space-y-6">
        {/* Task Overview */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Task Overview</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Service Information */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Service</label>
              <div className="bg-white p-3 rounded-md border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{selectedService?.name}</p>
                    {selectedService?.description && (
                      <p className="text-xs text-gray-600 mt-1">{selectedService.description}</p>
                    )}
                    <div className="flex items-center mt-2 text-xs text-gray-500">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {selectedService?.template_count} template{selectedService?.template_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Client Information */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
              <div className="bg-white p-3 rounded-md border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {selectedClient?.first_name} {selectedClient?.last_name}
                    </p>
                    {selectedClient?.email && (
                      <p className="text-xs text-gray-600 mt-1">{selectedClient.email}</p>
                    )}
                    <div className="flex items-center mt-2 text-xs text-gray-500">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                        selectedClient?.status === 'active' ? 'bg-green-100 text-green-800' :
                        selectedClient?.status === 'prospect' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedClient?.status || 'active'}
                      </span>
                      <span className="ml-2 capitalize">
                        {selectedClient?.client_type || 'individual'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Fields Summary */}
        {customFields.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">
              Custom Fields Summary
              <span className="ml-2 text-sm font-normal text-gray-600">
                ({completedRequiredFields.length}/{allRequiredFields.length} required completed)
              </span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customFields.map((field, index) => {
                const fieldKey = field.name || field.label
                const value = formData.custom_field_values[fieldKey]
                const hasValue = value && (typeof value !== 'string' || value.trim())
                
                return (
                  <div key={index} className="bg-white p-3 rounded-md border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-900">
                            {field.label || field.name}
                          </p>
                          {field.required && (
                            <span className="ml-1 text-red-500 text-xs">*</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {hasValue ? (
                            typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value
                          ) : (
                            <span className="italic text-gray-400">
                              {field.required ? 'Required - Not filled' : 'Not filled'}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 capitalize">
                          {field.type || 'text'} field
                        </p>
                      </div>
                      <div className="ml-2">
                        {hasValue ? (
                          <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : field.required ? (
                          <div className="w-4 h-4 bg-red-100 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-4 h-4 bg-gray-100 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Task Settings */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Task Settings</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                id="priority"
                value={formData.priority}
                onChange={handlePriorityChange}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <div className="mt-2">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(formData.priority)}`}>
                  {formData.priority} priority
                </span>
              </div>
            </div>

            {/* Assigned To */}
            <div>
              <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700 mb-2">
                Assigned To <span className="text-xs text-gray-500">(optional)</span>
              </label>
              <input
                id="assigned_to"
                type="text"
                value={formData.assigned_to || ''}
                onChange={handleAssignedToChange}
                placeholder="Enter assignee name or email..."
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="mt-6">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Notes <span className="text-xs text-gray-500">(optional)</span>
            </label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={handleNotesChange}
              placeholder="Add any additional notes or instructions for this task..."
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* What Happens Next */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="text-md font-medium text-blue-900 mb-3">What happens next?</h4>
          <div className="space-y-3 text-sm text-blue-800">
            <div className="flex items-start">
              <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-blue-900">1</span>
              </div>
              <div>
                <p className="font-medium">Task Created</p>
                <p className="text-blue-700">The task will be created with "In Progress" status</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-blue-900">2</span>
              </div>
              <div>
                <p className="font-medium">Generate Documents</p>
                <p className="text-blue-700">
                  You can then generate {selectedService?.template_count} document{selectedService?.template_count !== 1 ? 's' : ''} using the provided information
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-blue-900">3</span>
              </div>
              <div>
                <p className="font-medium">Download & Sign</p>
                <p className="text-blue-700">Download the generated documents, get them signed, and upload them back</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-blue-900">4</span>
              </div>
              <div>
                <p className="font-medium">Complete Task</p>
                <p className="text-blue-700">Mark the task as completed and update client records</p>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Summary */}
        {allRequiredFields.length > 0 && (
          <div className={`border rounded-lg p-4 ${
            completedRequiredFields.length === allRequiredFields.length
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex">
              <svg className={`w-5 h-5 mt-0.5 mr-3 ${
                completedRequiredFields.length === allRequiredFields.length
                  ? 'text-green-600'
                  : 'text-yellow-600'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                  completedRequiredFields.length === allRequiredFields.length
                    ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                } />
              </svg>
              <div className={`text-sm ${
                completedRequiredFields.length === allRequiredFields.length
                  ? 'text-green-800'
                  : 'text-yellow-800'
              }`}>
                <p className="font-medium mb-1">
                  {completedRequiredFields.length === allRequiredFields.length
                    ? 'Ready to Create'
                    : 'Missing Required Fields'
                  }
                </p>
                <p>
                  {completedRequiredFields.length === allRequiredFields.length
                    ? 'All required fields have been completed. Your task is ready to be created.'
                    : `${allRequiredFields.length - completedRequiredFields.length} required field${
                        allRequiredFields.length - completedRequiredFields.length !== 1 ? 's' : ''
                      } still need${allRequiredFields.length - completedRequiredFields.length === 1 ? 's' : ''} to be filled.`
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}