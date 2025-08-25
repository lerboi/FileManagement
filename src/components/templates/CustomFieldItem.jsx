// src/components/templates/CustomFieldItem.jsx
'use client'

import { useState, useEffect } from 'react'
import FieldTypeSelector from './FieldTypeSelector'

export default function CustomFieldItem({ 
  field = {}, 
  index, 
  onUpdate, 
  onDelete, 
  onMoveUp, 
  onMoveDown, 
  isFirst = false, 
  isLast = false 
}) {
  const [localField, setLocalField] = useState({
    id: '',
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
    checkboxLabel: '',
    ...field
  })

  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    setLocalField(prev => ({ ...prev, ...field }))
  }, [field])

  const generateFieldName = (label) => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  }

  const handleFieldChange = (key, value) => {
    const updatedField = { ...localField, [key]: value }
    
    // Auto-generate field name from label
    if (key === 'label') {
      updatedField.name = generateFieldName(value)
    }
    
    setLocalField(updatedField)
    onUpdate(index, updatedField)
  }

  const handleValidationChange = (key, value) => {
    const updatedValidation = { ...localField.validation, [key]: value }
    const updatedField = { ...localField, validation: updatedValidation }
    setLocalField(updatedField)
    onUpdate(index, updatedField)
  }

  const handleOptionChange = (optionIndex, key, value) => {
    const updatedOptions = [...(localField.options || [])]
    updatedOptions[optionIndex] = { ...updatedOptions[optionIndex], [key]: value }
    const updatedField = { ...localField, options: updatedOptions }
    setLocalField(updatedField)
    onUpdate(index, updatedField)
  }

  const addOption = () => {
    const updatedOptions = [...(localField.options || []), { label: '', value: '' }]
    const updatedField = { ...localField, options: updatedOptions }
    setLocalField(updatedField)
    onUpdate(index, updatedField)
  }

  const removeOption = (optionIndex) => {
    const updatedOptions = (localField.options || []).filter((_, i) => i !== optionIndex)
    const updatedField = { ...localField, options: updatedOptions }
    setLocalField(updatedField)
    onUpdate(index, updatedField)
  }

  const categories = [
    { value: '', label: 'No Category' },
    { value: 'trust_details', label: 'Trust Details' },
    { value: 'beneficiary_info', label: 'Beneficiary Information' },
    { value: 'financial_data', label: 'Financial Data' },
    { value: 'legal_requirements', label: 'Legal Requirements' },
    { value: 'distribution_terms', label: 'Distribution Terms' },
    { value: 'other', label: 'Other' }
  ]

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">
      {/* Header with reorder buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
          <h4 className="font-medium text-gray-900">
            {localField.label || 'New Custom Field'}
          </h4>
        </div>
        
        <div className="flex items-center space-x-1">
          {!isFirst && (
            <button
              onClick={() => onMoveUp(index)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="Move up"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          )}
          
          {!isLast && (
            <button
              onClick={() => onMoveDown(index)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="Move down"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          
          <button
            onClick={() => onDelete(index)}
            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Delete field"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Settings */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Label *
            </label>
            <input
              type="text"
              value={localField.label}
              onChange={(e) => handleFieldChange('label', e.target.value)}
              placeholder="e.g., Trust Amount"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Name
            </label>
            <input
              type="text"
              value={localField.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="auto-generated from label"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">Used as placeholder: {`{{${localField.name}}}`}</p>
          </div>

          <FieldTypeSelector
            value={localField.type}
            onChange={(value) => handleFieldChange('type', value)}
          />
        </div>

        {/* Additional Settings */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={localField.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Help text for users filling out this field"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={localField.category}
              onChange={(e) => handleFieldChange('category', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`required-${index}`}
              checked={localField.required}
              onChange={(e) => handleFieldChange('required', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor={`required-${index}`} className="text-sm text-gray-700">
              Required field
            </label>
          </div>
        </div>
      </div>

      {/* Dropdown Options */}
      {localField.type === 'dropdown' && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">
              Dropdown Options
            </label>
            <button
              onClick={addOption}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Add Option
            </button>
          </div>
          
          <div className="space-y-2">
            {(localField.options || []).map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Option label"
                  value={option.label || ''}
                  onChange={(e) => handleOptionChange(optionIndex, 'label', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={option.value || option.label || ''}
                  onChange={(e) => handleOptionChange(optionIndex, 'value', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => removeOption(optionIndex)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Settings */}
      <div className="border-t pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg 
            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} 
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span>Advanced Settings</span>
        </button>

        {showAdvanced && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Placeholder Text
              </label>
              <input
                type="text"
                value={localField.placeholder}
                onChange={(e) => handleFieldChange('placeholder', e.target.value)}
                placeholder="Placeholder text for input field"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Value
              </label>
              <input
                type="text"
                value={localField.defaultValue}
                onChange={(e) => handleFieldChange('defaultValue', e.target.value)}
                placeholder="Default value"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Validation Settings for Number/Currency/Percentage */}
            {['number', 'currency', 'percentage'].includes(localField.type) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Value
                  </label>
                  <input
                    type="number"
                    value={localField.validation?.min || ''}
                    onChange={(e) => handleValidationChange('min', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum Value
                  </label>
                  <input
                    type="number"
                    value={localField.validation?.max || ''}
                    onChange={(e) => handleValidationChange('max', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {/* Character limits for text fields */}
            {['text', 'textarea'].includes(localField.type) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Length
                  </label>
                  <input
                    type="number"
                    value={localField.validation?.minLength || ''}
                    onChange={(e) => handleValidationChange('minLength', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Length
                  </label>
                  <input
                    type="number"
                    value={localField.validation?.maxLength || ''}
                    onChange={(e) => handleValidationChange('maxLength', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {/* Checkbox label */}
            {localField.type === 'checkbox' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Checkbox Label
                </label>
                <input
                  type="text"
                  value={localField.checkboxLabel}
                  onChange={(e) => handleFieldChange('checkboxLabel', e.target.value)}
                  placeholder="Text to display next to checkbox"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}