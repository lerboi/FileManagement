// src/components/services/TemplateSelectionInterface.jsx
'use client'

import { useState, useMemo } from 'react'

export default function TemplateSelectionInterface({ 
  templates = [], 
  selectedTemplateIds = [], 
  onSelectionChange,
  validationResult = null
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('all')

  // Get unique template types
  const templateTypes = useMemo(() => {
    const types = [...new Set(templates.map(t => t.template_type))].filter(Boolean).sort()
    return ['all', ...types]
  }, [templates])

  // Filter templates based on search and type
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           template.description?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = selectedType === 'all' || template.template_type === selectedType
      return matchesSearch && matchesType
    })
  }, [templates, searchTerm, selectedType])

  const handleTemplateToggle = (templateId) => {
    const newSelection = selectedTemplateIds.includes(templateId)
      ? selectedTemplateIds.filter(id => id !== templateId)
      : [...selectedTemplateIds, templateId]
    
    onSelectionChange(newSelection)
  }

  const handleSelectAll = () => {
    const allFilteredIds = filteredTemplates.map(t => t.id)
    const newSelection = [...new Set([...selectedTemplateIds, ...allFilteredIds])]
    onSelectionChange(newSelection)
  }

  const handleDeselectAll = () => {
    const filteredIds = new Set(filteredTemplates.map(t => t.id))
    const newSelection = selectedTemplateIds.filter(id => !filteredIds.has(id))
    onSelectionChange(newSelection)
  }

  const formatType = (type) => {
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  const isTemplateSelected = (templateId) => {
    return selectedTemplateIds.includes(templateId)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Select Templates</h3>
        <p className="text-sm text-gray-600">
          Choose the document templates that should be included in this service. Only active templates are shown.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="sm:w-48">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {templateTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : formatType(type)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {filteredTemplates.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            {selectedTemplateIds.length} of {templates.length} templates selected
            {filteredTemplates.length !== templates.length && (
              <span className="ml-1">({filteredTemplates.length} shown)</span>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleSelectAll}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Select All Shown
            </button>
            <span className="text-gray-400">|</span>
            <button
              onClick={handleDeselectAll}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Deselect All Shown
            </button>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="border border-gray-200 rounded-lg">
        {templates.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Active Templates</h3>
            <p className="mt-1 text-sm text-gray-500">
              You need to create and activate some document templates first.
            </p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">
              No templates match your search criteria.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  isTemplateSelected(template.id) ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
                onClick={() => handleTemplateToggle(template.id)}
              >
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={isTemplateSelected(template.id)}
                    onChange={() => handleTemplateToggle(template.id)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    onClick={(e) => e.stopPropagation()}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {template.name}
                      </h4>
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        {formatType(template.template_type)}
                      </span>
                      {template.has_custom_fields && (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {template.custom_field_count} custom field{template.custom_field_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    
                    {template.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    
                    <div className="flex items-center text-xs text-gray-500 space-x-4">
                      <span>Created {new Date(template.created_at).toLocaleDateString()}</span>
                      {template.updated_at !== template.created_at && (
                        <span>Updated {new Date(template.updated_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {selectedTemplateIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">
                {selectedTemplateIds.length} template{selectedTemplateIds.length !== 1 ? 's' : ''} selected
              </p>
              <p>
                This service will be able to generate {selectedTemplateIds.length} document{selectedTemplateIds.length !== 1 ? 's' : ''} when used in a task.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Validation Results */}
      {validationResult && (
        <div className="space-y-3">
          {validationResult.warnings && validationResult.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Warnings</p>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {validationResult.conflicts && validationResult.conflicts.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-orange-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-orange-800">
                  <p className="font-medium mb-1">Custom Field Conflicts</p>
                  <p className="mb-2">The following custom fields have different definitions across templates:</p>
                  <ul className="space-y-2">
                    {validationResult.conflicts.map((conflict, index) => (
                      <li key={index} className="bg-white p-2 rounded border">
                        <p className="font-medium">{conflict.fieldName}</p>
                        <div className="text-xs mt-1 space-y-1">
                          {conflict.definitions.map((def, defIndex) => (
                            <div key={defIndex}>
                              {def.templateName}: {def.type} {def.required ? '(required)' : '(optional)'}
                            </div>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {validationResult.customFieldsRequired > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-green-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-green-800">
                  <p className="font-medium">
                    Service will collect {validationResult.customFieldsRequired} custom field{validationResult.customFieldsRequired !== 1 ? 's' : ''}
                  </p>
                  <p className="mt-1">
                    Users will need to fill these fields when creating tasks with this service.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}