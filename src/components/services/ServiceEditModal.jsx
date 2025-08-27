// src/components/services/ServiceEditModal.jsx
'use client'

import { useState, useEffect } from 'react'
import TemplateSelectionInterface from './TemplateSelectionInterface'

export default function ServiceEditModal({ isOpen, onClose, service, onServiceUpdated }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('basic') // 'basic', 'templates'
  
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
  const [originalTemplateIds, setOriginalTemplateIds] = useState([])

  // Initialize form data when service changes
  useEffect(() => {
    if (service && isOpen) {
      setFormData({
        name: service.name || '',
        description: service.description || '',
        template_ids: service.template_ids || [],
        is_active: service.is_active !== undefined ? service.is_active : true
      })
      setOriginalTemplateIds(service.template_ids || [])
      setActiveTab('basic')
      setError('')
      setTemplateValidation(null)
      fetchAvailableTemplates()
    }
  }, [service, isOpen])

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

    // Validate template selection if templates are selected
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
        }
      } catch (error) {
        console.error('Error validating template selection:', error)
      }
    } else {
      setTemplateValidation(null)
    }
  }

  const handleSubmit = async () => {
    // Basic validation
    if (!formData.name.trim()) {
      setError('Service name is required')
      setActiveTab('basic')
      return
    }

    if (formData.template_ids.length === 0) {
      setError('Please select at least one template')
      setActiveTab('templates')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update service')
      }

      const result = await response.json()
      
      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        console.warn('Service update warnings:', result.warnings)
      }

      onServiceUpdated(result.service)
      onClose()
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = () => {
    if (!service) return false
    
    return (
      formData.name !== (service.name || '') ||
      formData.description !== (service.description || '') ||
      formData.is_active !== (service.is_active !== undefined ? service.is_active : true) ||
      JSON.stringify([...formData.template_ids].sort()) !== JSON.stringify([...originalTemplateIds].sort())
    )
  }

  const getTabClass = (tabName) => {
    const baseClass = "px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors"
    const activeClass = "text-blue-600 border-blue-600 bg-blue-50"
    const inactiveClass = "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
    
    return `${baseClass} ${activeTab === tabName ? activeClass : inactiveClass}`
  }

  if (!isOpen || !service) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Service</h2>
            <p className="text-sm text-gray-600 mt-1">Update service configuration</p>
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

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('basic')}
            className={getTabClass('basic')}
          >
            Basic Information
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={getTabClass('templates')}
          >
            Templates ({formData.template_ids.length})
          </button>
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
          {activeTab === 'basic' && (
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
                  Service is active and available for use
                </label>
              </div>

              {/* Original vs Current Comparison */}
              {hasChanges() && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Changes detected</p>
                      <ul className="space-y-1">
                        {formData.name !== (service.name || '') && (
                          <li>• Name: "{service.name || ''}" → "{formData.name}"</li>
                        )}
                        {formData.description !== (service.description || '') && (
                          <li>• Description updated</li>
                        )}
                        {formData.is_active !== (service.is_active !== undefined ? service.is_active : true) && (
                          <li>• Status: {service.is_active ? 'Active' : 'Inactive'} → {formData.is_active ? 'Active' : 'Inactive'}</li>
                        )}
                        {JSON.stringify([...formData.template_ids].sort()) !== JSON.stringify([...originalTemplateIds].sort()) && (
                          <li>• Templates: {originalTemplateIds.length} → {formData.template_ids.length} selected</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <TemplateSelectionInterface
              templates={availableTemplates}
              selectedTemplateIds={formData.template_ids}
              onSelectionChange={handleTemplateSelection}
              validationResult={templateValidation}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {activeTab === 'basic' && (
              <span>
                {hasChanges() ? 'You have unsaved changes' : 'No changes made'}
              </span>
            )}
            {activeTab === 'templates' && (
              <span>
                {formData.template_ids.length} template{formData.template_ids.length !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={loading || !hasChanges()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            >
              {loading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'Updating...' : 'Update Service'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}