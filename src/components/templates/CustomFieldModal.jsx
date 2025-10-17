// src/components/templates/CustomFieldModal.jsx
'use client'

import { useState, useEffect } from 'react'

export default function CustomFieldModal({ isOpen, onClose, field, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    description: ''
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditMode = !!field

  useEffect(() => {
    if (isOpen) {
      if (field) {
        // Edit mode - populate form
        setFormData({
          name: field.name,
          label: field.label,
          description: field.description || ''
        })
      } else {
        // Create mode - reset form
        setFormData({
          name: '',
          label: '',
          description: ''
        })
      }
      setErrors({})
    }
  }, [isOpen, field])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, isSubmitting, onClose])

  const validateName = (name) => {
    if (!name) return 'Name is required'
    if (!/^[a-z]/.test(name)) return 'Name must start with a lowercase letter'
    if (!/^[a-z][a-z0-9_]*$/.test(name)) return 'Name can only contain lowercase letters, numbers, and underscores'
    return null
  }

  const validateForm = () => {
    const newErrors = {}

    if (!isEditMode) {
      // Only validate name in create mode
      const nameError = validateName(formData.name)
      if (nameError) newErrors.name = nameError
    }

    if (!formData.label.trim()) {
      newErrors.label = 'Label is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }

    // Real-time validation for name field
    if (name === 'name' && !isEditMode) {
      const nameError = validateName(value)
      if (nameError) {
        setErrors(prev => ({ ...prev, name: nameError }))
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      if (isEditMode) {
        // Update existing field
        const response = await fetch(`/api/placeholders/${field.placeholder_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: formData.label.trim(),
            description: formData.description.trim()
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to update custom field')
        }

        const result = await response.json()
        onSuccess('updated', result.placeholder)
      } else {
        // Create new field
        const response = await fetch('/api/placeholders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name.trim(),
            label: formData.label.trim(),
            description: formData.description.trim(),
            field_type: 'text'
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create custom field')
        }

        const result = await response.json()
        onSuccess('created', result.placeholder)
      }

      onClose()
    } catch (error) {
      setErrors({ submit: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={handleBackdropClick}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
        <div 
          className="relative bg-white rounded-lg shadow-2xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditMode ? 'Edit Custom Field' : 'New Custom Field'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {isEditMode ? 'Update the custom field details' : 'Create a new placeholder for your templates'}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={isEditMode || isSubmitting}
                placeholder="e.g., company_name"
                className={`block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:border-blue-500'
                } ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
              {!isEditMode && (
                <p className="mt-1 text-xs text-gray-500">
                  Lowercase letters, numbers, and underscores only. Must start with a letter.
                </p>
              )}
              {isEditMode && (
                <p className="mt-1 text-xs text-gray-500">
                  Name cannot be changed after creation.
                </p>
              )}
            </div>

            {/* Label Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Label <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="label"
                value={formData.label}
                onChange={handleInputChange}
                disabled={isSubmitting}
                placeholder="e.g., Company Name"
                className={`block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.label 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:border-blue-500'
                }`}
              />
              {errors.label && (
                <p className="mt-1 text-sm text-red-600">{errors.label}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Display name shown in the placeholder library.
              </p>
            </div>

            {/* Description Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                disabled={isSubmitting}
                rows={3}
                placeholder="Optional description of what this field represents..."
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Help others understand what this placeholder is for.
              </p>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {isEditMode ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  isEditMode ? 'Save Changes' : 'Create Field'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}