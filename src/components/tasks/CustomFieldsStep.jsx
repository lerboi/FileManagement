// src/components/tasks/CustomFieldsStep.jsx
'use client'

import { useState, useEffect } from 'react'

export default function CustomFieldsStep({ 
  customFields = [], 
  values = {}, 
  onValuesChange, 
  selectedService 
}) {
  const [fieldValues, setFieldValues] = useState(values)
  const [validationErrors, setValidationErrors] = useState({})

  useEffect(() => {
    setFieldValues(values)
  }, [values])

  const handleFieldChange = (fieldName, fieldValue) => {
    const newValues = { ...fieldValues, [fieldName]: fieldValue }
    setFieldValues(newValues)
    onValuesChange(newValues)

    // Clear validation error for this field
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const updated = { ...prev }
        delete updated[fieldName]
        return updated
      })
    }
  }

  const validateField = (field) => {
    const fieldKey = field.name || field.label
    const value = fieldValues[fieldKey]

    if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
      return `${field.label || field.name} is required`
    }

    // Type-specific validation
    if (value && field.type) {
      switch (field.type) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(value)) {
            return 'Please enter a valid email address'
          }
          break
        case 'number':
          if (isNaN(value) || value === '') {
            return 'Please enter a valid number'
          }
          break
        case 'date':
          if (value && isNaN(Date.parse(value))) {
            return 'Please enter a valid date'
          }
          break
      }
    }

    return null
  }

  const renderField = (field, index) => {
    const fieldKey = field.name || field.label
    const fieldValue = fieldValues[fieldKey] || ''
    const error = validationErrors[fieldKey]
    const validation = validateField(field)

    const baseClasses = `block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
      error || validation 
        ? 'border-red-300 focus:border-red-500' 
        : 'border-gray-300 focus:border-blue-500'
    }`

    const renderFieldInput = () => {
      switch (field.type) {
        case 'textarea':
        case 'long_text':
          return (
            <textarea
              id={fieldKey}
              rows={field.rows || 3}
              value={fieldValue}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
              className={baseClasses}
            />
          )

        case 'select':
        case 'dropdown':
          return (
            <select
              id={fieldKey}
              value={fieldValue}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              className={baseClasses}
            >
              <option value="">Choose an option...</option>
              {(field.options || []).map((option, optIndex) => (
                <option key={optIndex} value={typeof option === 'string' ? option : option.value}>
                  {typeof option === 'string' ? option : option.label}
                </option>
              ))}
            </select>
          )

        case 'checkbox':
          return (
            <div className="flex items-center">
              <input
                id={fieldKey}
                type="checkbox"
                checked={!!fieldValue}
                onChange={(e) => handleFieldChange(fieldKey, e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={fieldKey} className="ml-2 text-sm text-gray-700">
                {field.checkboxLabel || field.label || field.name}
              </label>
            </div>
          )

        case 'radio':
          return (
            <div className="space-y-2">
              {(field.options || []).map((option, optIndex) => {
                const optionValue = typeof option === 'string' ? option : option.value
                const optionLabel = typeof option === 'string' ? option : option.label
                return (
                  <div key={optIndex} className="flex items-center">
                    <input
                      id={`${fieldKey}_${optIndex}`}
                      name={fieldKey}
                      type="radio"
                      value={optionValue}
                      checked={fieldValue === optionValue}
                      onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <label htmlFor={`${fieldKey}_${optIndex}`} className="ml-2 text-sm text-gray-700">
                      {optionLabel}
                    </label>
                  </div>
                )
              })}
            </div>
          )

        case 'number':
          return (
            <input
              id={fieldKey}
              type="number"
              value={fieldValue}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
              min={field.min}
              max={field.max}
              step={field.step || 'any'}
              className={baseClasses}
            />
          )

        case 'date':
          return (
            <input
              id={fieldKey}
              type="date"
              value={fieldValue}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              min={field.min}
              max={field.max}
              className={baseClasses}
            />
          )

        case 'email':
          return (
            <input
              id={fieldKey}
              type="email"
              value={fieldValue}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              placeholder={field.placeholder || 'Enter email address...'}
              className={baseClasses}
            />
          )

        case 'tel':
        case 'phone':
          return (
            <input
              id={fieldKey}
              type="tel"
              value={fieldValue}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              placeholder={field.placeholder || 'Enter phone number...'}
              className={baseClasses}
            />
          )

        default:
          return (
            <input
              id={fieldKey}
              type="text"
              value={fieldValue}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
              className={baseClasses}
            />
          )
      }
    }

    return (
      <div key={index} className="space-y-2">
        <label htmlFor={fieldKey} className="block text-sm font-medium text-gray-700">
          {field.label || field.name}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        {field.description && (
          <p className="text-xs text-gray-600">{field.description}</p>
        )}
        
        {renderFieldInput()}
        
        {(error || validation) && (
          <p className="text-sm text-red-600">
            {error || validation}
          </p>
        )}
        
        {field.helpText && (
          <p className="text-xs text-gray-500">{field.helpText}</p>
        )}
      </div>
    )
  }

  const requiredFields = customFields.filter(field => field.required)
  const optionalFields = customFields.filter(field => !field.required)
  const completedRequiredFields = requiredFields.filter(field => {
    const value = fieldValues[field.name] || fieldValues[field.label]
    return value && (typeof value !== 'string' || value.trim())
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Service Requirements
        </h3>
        <p className="text-gray-600">
          Fill in the required information for <span className="font-medium">{selectedService?.name}</span>.
          This data will be used to populate the document templates.
        </p>
      </div>

      {customFields.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Custom Fields Required</h3>
          <p className="mt-1 text-sm text-gray-500">
            This service doesn't require any additional information. You can proceed to client selection.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Progress indicator */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-gray-900">Progress</span>
              <span className="text-gray-600">
                {completedRequiredFields.length} of {requiredFields.length} required fields completed
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: requiredFields.length > 0 
                    ? `${(completedRequiredFields.length / requiredFields.length) * 100}%` 
                    : '100%' 
                }}
              ></div>
            </div>
          </div>

          {/* Required Fields */}
          {requiredFields.length > 0 && (
            <div>
              <div className="flex items-center mb-4">
                <h4 className="text-md font-medium text-gray-900">
                  Required Fields
                </h4>
                <span className="ml-2 inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                  {requiredFields.length} required
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {requiredFields.map(renderField)}
              </div>
            </div>
          )}

          {/* Optional Fields */}
          {optionalFields.length > 0 && (
            <div>
              <div className="flex items-center mb-4">
                <h4 className="text-md font-medium text-gray-900">
                  Optional Fields
                </h4>
                <span className="ml-2 inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                  {optionalFields.length} optional
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {optionalFields.map(renderField)}
              </div>
            </div>
          )}

          {/* Field Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Field Information</p>
                <p>
                  These fields will be used to populate the document templates in this service.
                  {requiredFields.length > 0 && (
                    <span className="ml-1">
                      All required fields must be completed before proceeding.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}