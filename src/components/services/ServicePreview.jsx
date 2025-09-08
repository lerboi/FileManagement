// src/components/services/ServicePreview.jsx
'use client'

export default function ServicePreview({ 
  serviceData, 
  templateValidation, 
  customFieldsPreview 
}) {
  const formatType = (type) => {
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Review Service Configuration</h3>
        <p className="text-sm text-gray-600">
          Review your service details before creating. You can modify these settings later if needed.
        </p>
      </div>

      {/* Service Details */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-md font-medium text-gray-900 mb-3">Service Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <p className="text-sm text-gray-900 bg-white p-2 rounded border">
              {serviceData.name || 'Untitled Service'}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              serviceData.is_active 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {serviceData.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          {serviceData.description && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <p className="text-sm text-gray-900 bg-white p-2 rounded border">
                {serviceData.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Templates Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-md font-medium text-gray-900 mb-3">
          Selected Templates ({serviceData.template_ids?.length || 0})
        </h4>
        
        {templateValidation && templateValidation.templates ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {templateValidation.templates.map((template) => (
                <div key={template.id} className="bg-white p-3 rounded border">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="text-sm font-medium text-gray-900 truncate pr-2">
                      {template.name}
                    </h5>
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 flex-shrink-0">
                      {formatType(template.type)}
                    </span>
                  </div>
                  
                  {template.description && (
                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                      {template.description}
                    </p>
                  )}
                  
                  <div className="flex items-center text-xs text-gray-500">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Active Template
                  </div>
                </div>
              ))}
            </div>
            
            {/* Generation Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Generation Preview</p>
                  <p>
                    This service will generate <span className="font-semibold">{templateValidation.documentsToGenerate}</span> document{templateValidation.documentsToGenerate !== 1 ? 's' : ''} when used in a task.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            <p className="text-sm">No templates selected</p>
          </div>
        )}
      </div>

      {/* Custom Fields Summary */}
      {customFieldsPreview && customFieldsPreview.customFields && customFieldsPreview.customFields.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-md font-medium text-gray-900 mb-3">
            Custom Fields Required ({customFieldsPreview.customFields.length})
          </h4>
          
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Users will need to fill these custom fields when creating tasks with this service:
            </p>
            
            <div className="bg-white rounded border p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {customFieldsPreview.customFields.map((field, index) => (
                  <div key={index} className="flex items-start space-x-3 p-2 bg-gray-50 rounded">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {field.label || field.name}
                        </p>
                        {field.required && (
                          <span className="inline-flex px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-800">
                            Required
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-600">
                        Type: {field.type || 'text'}
                      </p>
                      
                      {field.sourceTemplates && field.sourceTemplates.length > 1 && (
                        <p className="text-xs text-blue-600 mt-1">
                          Used by {field.sourceTemplates.length} template{field.sourceTemplates.length !== 1 ? 's' : ''}
                        </p>
                      )}
                      
                      {field.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {field.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Fields Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded border text-center">
                <p className="text-2xl font-semibold text-gray-900">
                  {customFieldsPreview.stats?.totalFields || 0}
                </p>
                <p className="text-sm text-gray-600">Total Fields</p>
              </div>
              
              <div className="bg-white p-3 rounded border text-center">
                <p className="text-2xl font-semibold text-green-600">
                  {customFieldsPreview.customFields.filter(f => f.required).length}
                </p>
                <p className="text-sm text-gray-600">Required</p>
              </div>
              
              <div className="bg-white p-3 rounded border text-center">
                <p className="text-2xl font-semibold text-blue-600">
                  {customFieldsPreview.customFields.filter(f => !f.required).length}
                </p>
                <p className="text-sm text-gray-600">Optional</p>
              </div>
            </div>

            {/* Field Conflicts Warning */}
            {customFieldsPreview.conflicts && customFieldsPreview.conflicts.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <div className="flex">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Field Conflicts Detected</p>
                    <p className="mb-2">
                      {customFieldsPreview.conflicts.length} custom field{customFieldsPreview.conflicts.length !== 1 ? 's have' : ' has'} conflicting definitions across templates.
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {customFieldsPreview.conflicts.map((conflict, index) => (
                        <li key={index}>
                          <span className="font-medium">{conflict.fieldName}</span> - 
                          Different definitions in {conflict.definitions.length} templates
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {templateValidation && templateValidation.warnings && templateValidation.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-2">Warnings</p>
              <ul className="space-y-1">
                {templateValidation.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Success Summary */}
      {serviceData.template_ids && serviceData.template_ids.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-green-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-green-800">
              <p className="font-medium mb-1">Ready to Create</p>
              <p>
                Your service "<span className="font-semibold">{serviceData.name}</span>" is configured and ready to be created.
                {serviceData.is_active 
                  ? ' It will be immediately available for use in tasks.'
                  : ' You can activate it later when you\'re ready to use it.'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}