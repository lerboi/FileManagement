// src/components/services/ServiceCreationModal.jsx
'use client'

import { useState, useEffect } from 'react'
import TemplateSelectionInterface from './TemplateSelectionInterface'
import ServicePreview from './ServicePreview'

export default function ServiceCreationModal({ isOpen, onClose, onServiceCreated }) {
  const [currentStep, setCurrentStep] = useState(1) // 1: Basic Info, 2: Template Selection, 3: Preview
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template_ids: [],
    is_active: true
  })
  
  // Template data
  const [availableTemplates, setAvailableTemplates] = useState([])
  const [templateValidation, setTemplateValidation] = useState(null)
  const [customFieldsPreview, setCustomFieldsPreview] = useState(null)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setFormData({
        name: '',
        description: '',
        template_ids: [],
        is_active: true
      })
      setError('')
      setTemplateValidation(null)
      setCustomFieldsPreview(null)
      fetchAvailableTemplates()
    }
  }, [isOpen])

  const fetchAvailableTemplates = async () => {
    try {
      const response = await fetch('/api/templates/selection')
      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }
      const data = await response.json()
      setAvailableTemplates(data.templates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
      setError('Failed to load available templates')
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    setError('') // Clear error when user types
  }

  const handleTemplateSelection = async (selectedTemplateIds) => {
    setFormData(prev => ({
      ...prev,
      template_ids: selectedTemplateIds
    }))

    // Validate template selection and get preview
    if (selectedTemplateIds.length > 0) {
      try {
        const response = await fetch('/api/templates/selection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            template_ids: selectedTemplateIds,
            action: 'preview'
          })
        })

        if (response.ok) {
          const data = await response.json()
          setTemplateValidation(data.preview)
          
          // Get custom fields preview
          const customFieldsResponse = await fetch('/api/services/preview/custom-fields', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ template_ids: selectedTemplateIds })
          })

          if (customFieldsResponse.ok) {
            const customFieldsData = await customFieldsResponse.json()
            setCustomFieldsPreview(customFieldsData)
          }
        }
      } catch (error) {
        console.error('Error validating template selection:', error)
      }
    } else {
      setTemplateValidation(null)
      setCustomFieldsPreview(null)
    }
  }

  const handleNext = () => {
    if (currentStep === 1) {
      // Validate basic info
      if (!formData.name.trim()) {
        setError('Service name is required')
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      // Validate template selection
      if (formData.template_ids.length === 0) {
        setError('Please select at least one template')
        return
      }
      setCurrentStep(3)
    }
    setError('')
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(1, prev - 1))
    setError('')
  }

  const handleSubmit = async () => {
    if (formData.template_ids.length === 0) {
      setError('Please select at least one template')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create service')
      }

      const result = await response.json()
      
      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        console.warn('Service creation warnings:', result.warnings)
      }

      onServiceCreated(result.service)
      onClose()
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name.trim().length > 0
      case 2:
        return formData.template_ids.length > 0
      case 3:
        return true
      default:
        return false
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Basic Information'
      case 2: return 'Select Templates'
      case 3: return 'Review & Create'
      default: return 'Create Service'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Service</h2>
            <p className="text-sm text-gray-600 mt-1">Step {currentStep} of 3: {getStepTitle()}</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 1 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {currentStep > 1 ? '✓' : '1'}
              </div>
              <span className="ml-2 text-sm">Basic Info</span>
            </div>
            
            <div className="flex-1 h-px bg-gray-300"></div>
            
            <div className={`flex items-center ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 2 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {currentStep > 2 ? '✓' : '2'}
              </div>
              <span className="ml-2 text-sm">Templates</span>
            </div>
            
            <div className="flex-1 h-px bg-gray-300"></div>
            
            <div className={`flex items-center ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 3 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>
                3
              </div>
              <span className="ml-2 text-sm">Review</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="ml-3 text-sm text-red-800">{error}</div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Service Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Trust Setup Package"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Brief description of this service bundle..."
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                  Make this service active immediately
                </label>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <TemplateSelectionInterface
              templates={availableTemplates}
              selectedTemplateIds={formData.template_ids}
              onSelectionChange={handleTemplateSelection}
              validationResult={templateValidation}
            />
          )}

          {currentStep === 3 && (
            <ServicePreview
              serviceData={formData}
              templateValidation={templateValidation}
              customFieldsPreview={customFieldsPreview}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {currentStep === 1 && 'Enter basic service information'}
            {currentStep === 2 && `${formData.template_ids.length} template${formData.template_ids.length !== 1 ? 's' : ''} selected`}
            {currentStep === 3 && 'Review your service configuration'}
          </div>
          
          <div className="flex space-x-3">
            {currentStep > 1 && (
              <button
                onClick={handlePrevious}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
            )}
            
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            
            {currentStep < 3 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed() || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              >
                {loading && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {loading ? 'Creating...' : 'Create Service'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}