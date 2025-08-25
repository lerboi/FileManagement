// src/components/documents/CustomFieldsForm.jsx
'use client'

import { useState, useEffect } from 'react'

export default function CustomFieldsForm({ customFields = [], onFieldsChange, values = {} }) {
  const [formValues, setFormValues] = useState(values)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setFormValues(values)
  }, [values])

  const handleFieldChange = (fieldName, value) => {
    const updatedValues = {
      ...formValues,
      [fieldName]: value
    }
    setFormValues(updatedValues)
    onFieldsChange(updatedValues)

    // Clear error for this field if it was previously invalid
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }
  }

  const validateFields = () => {
    const newErrors = {}
    
    customFields.forEach(field => {
      if (field.required && (!formValues[field.name] || formValues[field.name].toString().trim() === '')) {
        newErrors[field.name] = `${field.label} is required`
      }
      
      // Additional validation based on field type
      if (formValues[field.name]) {
        switch (field.type) {
          case 'number':
          case 'currency':
          case 'percentage':
            const numValue = parseFloat(formValues[field.name])
            if (isNaN(numValue)) {
              newErrors[field.name] = `${field.label} must be a valid number`
            } else {
              if (field.validation?.min !== undefined && numValue < field.validation.min) {
                newErrors[field.name] = `${field.label} must be at least ${field.validation.min}`
              }
              if (field.validation?.max !== undefined && numValue > field.validation.max) {
                newErrors[field.name] = `${field.label} cannot exceed ${field.validation.max}`
              }
            }
            break
            
          case 'text':
          case 'textarea':
            const textValue = formValues[field.name].toString()
            if (field.validation?.minLength && textValue.length < field.validation.minLength) {
              newErrors[field.name] = `${field.label} must be at least ${field.validation.minLength} characters`
            }
            if (field.validation?.maxLength && textValue.length > field.validation.maxLength) {
              newErrors[field.name] = `${field.label} cannot exceed ${field.validation.maxLength} characters`
            }
            break
        }
      }
    })
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const renderField = (field) => {
    const fieldValue = formValues[field.name] || field.defaultValue || ''
    const hasError = errors[field.name]

    const baseClasses = `block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      hasError 
        ? 'border-red-300 focus:border-red-500' 
        : 'border-gray-300 focus:border-blue-500'
    }`

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={fieldValue}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={baseClasses}
          />
        )

      case 'textarea':
        return (
          <textarea
            rows={3}
            value={fieldValue}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={baseClasses}
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={fieldValue}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder || '0'}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.step || 1}
            className={baseClasses}
          />
        )

      case 'date':
        return (
          <input
            type="date"
            value={fieldValue}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={baseClasses}
          />
        )

      case 'dropdown':
        return (
          <select
            value={fieldValue}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={baseClasses}
          >
            <option value="">Select {field.label.toLowerCase()}...</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option.value || option.label}>
                {option.label}
              </option>
            ))}
          </select>
        )

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={fieldValue === true || fieldValue === 'true'}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">
              {field.checkboxLabel || field.label}
            </span>
          </div>
        )

      case 'currency':
        return (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              type="number"
              value={fieldValue}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder="0.00"
              step="0.01"
              className={`${baseClasses} pl-7`}
            />
          </div>
        )

      case 'percentage':
        return (
          <div className="relative">
            <input
              type="number"
              value={fieldValue}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder="0"
              min="0"
              max="100"
              step="0.01"
              className={`${baseClasses} pr-8`}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">%</span>
            </div>
          </div>
        )

      default:
        return (
          <div className="p-3 bg-gray-100 rounded border text-gray-500 text-sm">
            Unsupported field type: {field.type}
          </div>
        )
    }
  }

  // Group fields by category
  const fieldsByCategory = customFields.reduce((groups, field) => {
    const category = field.category || 'other'
    if (!groups[category]) groups[category] = []
    groups[category].push(field)
    return groups
  }, {})

  const getCategoryDisplayName = (category) => {
    const names = {
      trust_details: 'Trust Details',
      beneficiary_info: 'Beneficiary Information',
      financial_data: 'Financial Data',
      legal_requirements: 'Legal Requirements',
      distribution_terms: 'Distribution Terms',
      other: 'Other Information'
    }
    return names[category] || category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900">Custom Field Values</h3>
        <p className="text-sm text-gray-600 mt-1">
          Please provide values for the custom fields defined in this template
        </p>
      </div>

      {/* Fields by category */}
      {Object.entries(fieldsByCategory).map(([category, categoryFields]) => (
        <div key={category} className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-md font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
            {getCategoryDisplayName(category)}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoryFields.map((field) => (
              <div key={field.name} className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                
                {field.description && (
                  <p className="text-xs text-gray-500">{field.description}</p>
                )}
                
                {renderField(field)}
                
                {errors[field.name] && (
                  <p className="text-xs text-red-600">{errors[field.name]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium">
              {customFields.length} custom field{customFields.length !== 1 ? 's' : ''} • {customFields.filter(f => f.required).length} required
            </p>
            <p className="mt-1">
              These values will be used to populate the custom fields in your generated document.
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  // Expose validation function for parent component
  CustomFieldsForm.validate = validateFields
}