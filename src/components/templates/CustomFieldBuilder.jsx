// src/components/templates/CustomFieldBuilder.jsx
'use client'

import { useState } from 'react'
import CustomFieldItem from './CustomFieldItem'
import CustomFieldPreview from './CustomFieldPreview'

export default function CustomFieldBuilder({ fields = [], onChange }) {
  const [activeFieldIndex, setActiveFieldIndex] = useState(null)
  const [previewField, setPreviewField] = useState(null)

  const generateId = () => {
    return 'field_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  const addField = () => {
    const newField = {
      id: generateId(),
      label: '',
      name: '',
      type: '',
      description: '',
      placeholder: '',
      required: false,
      category: '',
      defaultValue: '',
      validation: {},
      options: [],
      checkboxLabel: ''
    }
    
    const updatedFields = [...fields, newField]
    onChange(updatedFields)
    setActiveFieldIndex(updatedFields.length - 1)
    setPreviewField(newField)
  }

  const updateField = (index, updatedField) => {
    const updatedFields = [...fields]
    updatedFields[index] = updatedField
    onChange(updatedFields)
    
    if (activeFieldIndex === index) {
      setPreviewField(updatedField)
    }
  }

  const deleteField = (index) => {
    const updatedFields = fields.filter((_, i) => i !== index)
    onChange(updatedFields)
    
    if (activeFieldIndex === index) {
      setActiveFieldIndex(null)
      setPreviewField(null)
    } else if (activeFieldIndex > index) {
      setActiveFieldIndex(activeFieldIndex - 1)
    }
  }

  const moveField = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= fields.length) return
    
    const updatedFields = [...fields]
    const [movedField] = updatedFields.splice(fromIndex, 1)
    updatedFields.splice(toIndex, 0, movedField)
    onChange(updatedFields)
    
    if (activeFieldIndex === fromIndex) {
      setActiveFieldIndex(toIndex)
    }
  }

  const handleFieldClick = (index) => {
    setActiveFieldIndex(index)
    setPreviewField(fields[index])
  }

  const getFieldStats = () => {
    const stats = {
      total: fields.length,
      required: fields.filter(f => f.required).length,
      byType: {},
      byCategory: {}
    }

    fields.forEach(field => {
      stats.byType[field.type] = (stats.byType[field.type] || 0) + 1
      const category = field.category || 'uncategorized'
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1
    })

    return stats
  }

  const stats = getFieldStats()

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Custom Fields</h3>
            <p className="text-sm text-gray-600 mt-1">
              Define additional fields required for this trust template
            </p>
          </div>
          <button
            onClick={addField}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Field
          </button>
        </div>

        {/* Stats */}
        {fields.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <span>{stats.total} field{stats.total !== 1 ? 's' : ''}</span>
            {stats.required > 0 && (
              <span>{stats.required} required</span>
            )}
            {Object.keys(stats.byCategory).length > 1 && (
              <span>{Object.keys(stats.byCategory).length} categories</span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Fields List */}
        <div className="flex-1 overflow-y-auto p-4">
          {fields.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No custom fields</h3>
              <p className="mt-1 text-sm text-gray-500">
                Add custom fields to collect additional information specific to this trust type.
              </p>
              <div className="mt-6">
                <button
                  onClick={addField}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Your First Field
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id || index}
                  className={`cursor-pointer transition-all ${
                    activeFieldIndex === index 
                      ? 'ring-2 ring-blue-500 ring-opacity-50' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleFieldClick(index)}
                >
                  <CustomFieldItem
                    field={field}
                    index={index}
                    onUpdate={updateField}
                    onDelete={deleteField}
                    onMoveUp={(index) => moveField(index, index - 1)}
                    onMoveDown={(index) => moveField(index, index + 1)}
                    isFirst={index === 0}
                    isLast={index === fields.length - 1}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div className="w-80 border-l border-gray-200 bg-gray-50 overflow-y-auto">
          <div className="p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Field Preview</h4>
            
            {previewField ? (
              <CustomFieldPreview field={previewField} />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <p className="text-sm mt-2">Select a field to preview</p>
              </div>
            )}
          </div>

          {/* Field Summary */}
          {fields.length > 0 && (
            <div className="border-t border-gray-200 p-4">
              <h5 className="text-sm font-medium text-gray-900 mb-3">Field Summary</h5>
              
              <div className="space-y-3">
                <div>
                  <h6 className="text-xs font-medium text-gray-700 mb-1">By Type</h6>
                  <div className="space-y-1">
                    {Object.entries(stats.byType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 capitalize">{type.replace('_', ' ')}</span>
                        <span className="text-gray-500">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {Object.keys(stats.byCategory).length > 1 && (
                  <div>
                    <h6 className="text-xs font-medium text-gray-700 mb-1">By Category</h6>
                    <div className="space-y-1">
                      {Object.entries(stats.byCategory).map(([category, count]) => (
                        <div key={category} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 capitalize">
                            {category === 'uncategorized' ? 'No Category' : category.replace('_', ' ')}
                          </span>
                          <span className="text-gray-500">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-gray-200">
                  <div className="text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Total Fields:</span>
                      <span className="font-medium">{stats.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Required:</span>
                      <span className="font-medium">{stats.required}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Optional:</span>
                      <span className="font-medium">{stats.total - stats.required}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}