// src/components/templates/PlaceholderCreator.jsx
'use client'

import { useState } from 'react'
import FieldTypeSelector from './FieldTypeSelector'

export default function PlaceholderCreator({ onPlaceholderCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    description: '',
    field_type: 'text'
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const generateName = (label) => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  }

  const handleInputChange = (field, value) => {
    const updates = { [field]: value }
    
    // Auto-generate name from label
    if (field === 'label') {
      updates.name = generateName(value)
    }
    
    setFormData(prev => ({ ...prev, ...updates }))
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name || !formData.label) {
      setError('Name and label are required')
      return
    }
    
    setCreating(true)
    setError('')
    
    try {
      const response = await fetch('/api/placeholders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create placeholder')
      }
      
      const result = await response.json()
      
      setSuccess(`Placeholder "${result.placeholder.label}" created successfully!`)
      
      // Reset form
      setFormData({
        name: '',
        label: '',
        description: '',
        field_type: 'text'
      })
      
      // Notify parent component
      if (onPlaceholderCreated) {
        onPlaceholderCreated(result.placeholder)
      }
      
    } catch (error) {
      console.error('Error creating placeholder:', error)
      setError(error.message)
    } finally {
      setCreating(false)
    }
  }

  const handleReset = () => {
    setFormData({
      name: '',
      label: '',
      description: '',
      field_type: 'text'
    })
    setError('')
    setSuccess('')
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 p-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Create New Placeholder</h3>
          <p className="text-sm text-gray-600 mt-1">
            Create a reusable placeholder that can be used across all templates
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl">
          {/* Status Messages */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {success}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Placeholder Label *
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => handleInputChange('label', e.target.value)}
                    placeholder="e.g., Trust Establishment Date"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Human-readable name for this placeholder</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Placeholder Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="auto-generated from label"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                    readOnly
                  />
                  <p className="text-xs text-gray-500 mt-1">Used in templates as: {`{{${formData.name}}}`}</p>
                </div>

                <FieldTypeSelector
                  value={formData.field_type}
                  onChange={(value) => handleInputChange('field_type', value)}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe what this placeholder represents and when to use it..."
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Help text for users selecting this placeholder</p>
                </div>

                {/* Preview */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Preview</h4>
                  <div className="text-sm text-blue-800">
                    <div><strong>Label:</strong> {formData.label || 'Placeholder Label'}</div>
                    <div><strong>Name:</strong> {formData.name || 'placeholder_name'}</div>
                    <div><strong>Type:</strong> {formData.field_type}</div>
                    <div><strong>Usage:</strong> <code className="bg-yellow-100 px-1 rounded">{`{{${formData.name || 'placeholder_name'}}}`}</code></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Guidelines */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Guidelines for Good Placeholders</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Use clear, descriptive labels that users will understand</li>
                <li>• Choose appropriate field types for the data being collected</li>
                <li>• Provide helpful descriptions to guide users</li>
                <li>• Placeholder names should be lowercase with underscores</li>
                <li>• Created placeholders will be available across all templates</li>
              </ul>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={creating}
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={creating || !formData.name || !formData.label}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              >
                {creating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Create Placeholder'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}