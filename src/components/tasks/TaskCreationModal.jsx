// src/components/tasks/TaskCreationModal.jsx
'use client'

import { useState, useEffect } from 'react'
import ServiceSelectionStep from './ServiceSelectionStep'
import CustomFieldsStep from './CustomFieldsStep'
import ClientSelectionStep from './ClientSelectionStep'
import TaskPreviewStep from './TaskPreviewStep'

export default function TaskCreationModal({ isOpen, onClose, onTaskCreated, editingDraft = null }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [existingDrafts, setExistingDrafts] = useState([])
  const [showDraftSelector, setShowDraftSelector] = useState(false)
  const [currentDraftId, setCurrentDraftId] = useState(null)
  
  // Form data
  const [formData, setFormData] = useState({
    service_id: null,
    client_id: null,
    custom_field_values: {},
    notes: '',
    priority: 'normal',
    assigned_to: null
  })

  // Step data
  const [selectedService, setSelectedService] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [availableServices, setAvailableServices] = useState([])
  const [availableClients, setAvailableClients] = useState([])
  const [serviceCustomFields, setServiceCustomFields] = useState([])

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (editingDraft) {
        // Load the specific draft
        loadExistingDraft(editingDraft)
      } else {
        // Check for other existing drafts
        checkExistingDrafts()
      }
    } else {
      // Reset state when modal closes
      setCurrentStep(1)
      setCurrentDraftId(null)
      setShowDraftSelector(false)
      setFormData({
        service_id: null,
        client_id: null,
        custom_field_values: {},
        notes: '',
        priority: 'normal',
        assigned_to: null
      })
      setSelectedService(null)
      setSelectedClient(null)
      setServiceCustomFields([])
      setError('')
    }
  }, [isOpen, editingDraft])

  const loadExistingDraft = async (draft) => {
    try {
      setCurrentDraftId(draft.id)
      setShowDraftSelector(false)
      
      // Load draft data
      setFormData({
        service_id: draft.service_id,
        client_id: draft.client_id,
        custom_field_values: draft.custom_field_values || {},
        notes: draft.notes || '',
        priority: draft.priority || 'normal',
        assigned_to: draft.assigned_to || null
      })

      // Fetch initial data first
      await fetchInitialData()
      
      // Wait for services and clients to load, then set selected items
      setTimeout(async () => {
        // Find and set the selected service and client from the draft
        if (availableServices.length > 0 && draft.service_id) {
          const service = availableServices.find(s => s.id === draft.service_id)
          if (service) {
            await handleServiceSelection(service)
          }
        }
        
        if (availableClients.length > 0 && draft.client_id) {
          const client = availableClients.find(c => c.id === draft.client_id)
          if (client) {
            setSelectedClient(client)
          }
        }

        // Always start at step 1 when continuing to edit
        setCurrentStep(1)
      }, 500)
      
    } catch (error) {
      console.error('Error loading existing draft:', error)
      setError('Failed to load draft')
      startNewTask()
    }
  }

  const checkExistingDrafts = async () => {
    // Skip checking for other drafts if we're already editing a specific draft
    if (editingDraft) {
      return
    }

    try {
      const response = await fetch('/api/tasks/draft')
      if (response.ok) {
        const data = await response.json()
        const drafts = data.drafts || []
        setExistingDrafts(drafts)
        
        if (drafts.length > 0) {
          setShowDraftSelector(true)
        } else {
          startNewTask()
        }
      } else {
        startNewTask()
      }
    } catch (error) {
      console.error('Error checking drafts:', error)
      startNewTask()
    }
  }

  const startNewTask = async () => {
    setShowDraftSelector(false)
    await fetchInitialData()
  }

  const resumeDraft = async (draft) => {
    try {
      setCurrentDraftId(draft.id)
      setShowDraftSelector(false)
      
      // Load draft data
      setFormData({
        service_id: draft.service_id,
        client_id: draft.client_id,
        custom_field_values: draft.custom_field_values || {},
        notes: draft.notes || '',
        priority: draft.priority || 'normal',
        assigned_to: draft.assigned_to || null
      })

      // Set selected items
      await fetchInitialData()
      
      // Find and set selected service and client
      const service = availableServices.find(s => s.id === draft.service_id)
      const client = availableClients.find(c => c.id === draft.client_id)
      
      if (service) {
        await handleServiceSelection(service)
      }
      if (client) {
        setSelectedClient(client)
      }

      // Determine which step to show based on completed data
      if (!draft.service_id) {
        setCurrentStep(1) // Service selection
      } else if (!draft.client_id) {
        setCurrentStep(2) // Client selection
      } else if (serviceCustomFields.length > 0) {
        // Check if custom fields are completed
        const requiredFields = serviceCustomFields.filter(field => field.required)
        const missingFields = requiredFields.filter(field => {
          const value = draft.custom_field_values[field.name] || draft.custom_field_values[field.label]
          return !value || (typeof value === 'string' && !value.trim())
        })
        
        if (missingFields.length > 0) {
          setCurrentStep(3) // Requirements
        } else {
          setCurrentStep(4) // Review
        }
      } else {
        setCurrentStep(4) // Review if no custom fields
      }
      
    } catch (error) {
      console.error('Error resuming draft:', error)
      setError('Failed to resume draft')
      startNewTask()
    }
  }

  const fetchInitialData = async () => {
    try {
      // Fetch available services
      const servicesResponse = await fetch('/api/services')
      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json()
        setAvailableServices(servicesData.services || [])
      }

      // Fetch available clients
      const clientsResponse = await fetch('/api/clients')
      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json()
        setAvailableClients(clientsData.clients || [])
      }
    } catch (error) {
      console.error('Error fetching initial data:', error)
      setError('Failed to load data. Please try again.')
    }
  }

  const handleServiceSelection = async (service) => {
    setSelectedService(service)
    setFormData(prev => ({ 
      ...prev, 
      service_id: service.id 
      // Don't reset custom_field_values here - preserve existing data
    }))
    setError('')

    // Fetch service custom fields
    try {
      const response = await fetch(`/api/services/${service.id}/custom-fields`)
      if (response.ok) {
        const data = await response.json()
        setServiceCustomFields(data.customFields || [])
      }
    } catch (error) {
      console.error('Error fetching service custom fields:', error)
      setError('Failed to load service requirements')
    }
  }

  const handleCustomFieldsUpdate = async (customFieldValues) => {
    const updatedFormData = { ...formData, custom_field_values: customFieldValues }
    setFormData(updatedFormData)
    setError('')

    // Auto-save custom fields if draft exists
    if (currentDraftId) {
      try {
        await fetch(`/api/tasks/${currentDraftId}/draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFormData)
        })
      } catch (error) {
        console.error('Error auto-saving custom fields:', error)
      }
    }
  }

  const handleClientSelection = async (client) => {
    setSelectedClient(client)
    const updatedFormData = { ...formData, client_id: client.id }
    setFormData(updatedFormData)
    setError('')

    // Auto-save client selection if draft exists
    if (currentDraftId) {
      try {
        await fetch(`/api/tasks/${currentDraftId}/draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFormData)
        })
      } catch (error) {
        console.error('Error auto-saving client selection:', error)
      }
    }
  }

  const handleFormDataUpdate = async (updates) => {
    const updatedFormData = { ...formData, ...updates }
    setFormData(updatedFormData)

    // Auto-save form updates if draft exists
    if (currentDraftId) {
      try {
        await fetch(`/api/tasks/${currentDraftId}/draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFormData)
        })
      } catch (error) {
        console.error('Error auto-saving form data:', error)
      }
    }
  }

  const handleSave = async () => {
    if (!currentDraftId) {
      // Create new draft if none exists
      if (!formData.service_id || !formData.client_id) {
        setError('Please select both service and client before saving')
        return
      }

      try {
        setSaving(true)
        const response = await fetch('/api/tasks/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: formData.client_id,
            service_id: formData.service_id
          })
        })

        if (response.ok) {
          const result = await response.json()
          setCurrentDraftId(result.task.id)
          showSuccessMessage('Draft task created and saved')
        } else {
          throw new Error('Failed to create draft')
        }
      } catch (error) {
        setError(error.message)
      } finally {
        setSaving(false)
      }
    } else {
      // Update existing draft
      try {
        setSaving(true)
        const response = await fetch(`/api/tasks/${currentDraftId}/draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })

        if (response.ok) {
          showSuccessMessage('Draft saved successfully')
        } else {
          throw new Error('Failed to save draft')
        }
      } catch (error) {
        setError(error.message)
      } finally {
        setSaving(false)
      }
    }
  }

  const handleNext = async () => {
    // Auto-save when moving to next step
    if (currentDraftId) {
      await handleSave()
    }

    if (currentStep === 1) {
      if (!selectedService) {
        setError('Please select a service')
        return
      }
      setCurrentStep(2) // Go to Client selection
    } else if (currentStep === 2) {
      if (!selectedClient) {
        setError('Please select a client')
        return
      }
      
      // Create draft if not exists
      if (!currentDraftId) {
        await createInitialDraft()
      }
      
      setCurrentStep(3) // Go to Requirements
    } else if (currentStep === 3) {
      // Validate required custom fields
      const requiredFields = serviceCustomFields.filter(field => field.required)
      const missingFields = requiredFields.filter(field => {
        const value = formData.custom_field_values[field.name] || formData.custom_field_values[field.label]
        return !value || (typeof value === 'string' && !value.trim())
      })

      if (missingFields.length > 0) {
        setError(`Please fill in required fields: ${missingFields.map(f => f.label || f.name).join(', ')}`)
        return
      }
      setCurrentStep(4) // Go to Review
    }
    setError('')
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(1, prev - 1))
    setError('')
  }

  const handleSubmit = async () => {
    if (!formData.service_id || !formData.client_id) {
      setError('Please complete all required steps')
      return
    }

    if (!currentDraftId) {
      setError('No draft task found. Please save your progress first.')
      return
    }

    setLoading(true)
    setError('')

    try {
      // First, save any pending changes
      await fetch(`/api/tasks/${currentDraftId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      // Then finalize the draft task
      const response = await fetch(`/api/tasks/${currentDraftId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to finalize task')
      }

      const result = await response.json()
      
      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        console.warn('Task finalization warnings:', result.warnings)
      }

      onTaskCreated(result.task)
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
        return !!selectedService
      case 2:
        return !!selectedClient
      case 3:
        const requiredFields = serviceCustomFields.filter(field => field.required)
        return requiredFields.every(field => {
          const value = formData.custom_field_values[field.name] || formData.custom_field_values[field.label]
          return value && (typeof value !== 'string' || value.trim())
        })
      case 4:
        return true
      default:
        return false
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Select Service'
      case 2: return 'Select Client'
      case 3: return 'Service Requirements'
      case 4: return 'Review & Create'
      default: return 'Create Task'
    }
  }

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return 'Choose the service bundle for this task'
      case 2: return 'Select the client this task is for'
      case 3: return 'Fill in the required information for document generation'
      case 4: return 'Review your task details before creating'
      default: return ''
    }
  }

  // Get step label for progress steps
  const getStepLabel = (step) => {
    switch (step) {
      case 1: return 'Service'
      case 2: return 'Client'
      case 3: return 'Requirements'
      case 4: return 'Review'
      default: return ''
    }
  }

  const createInitialDraft = async () => {
    if (!formData.service_id || !formData.client_id) return

    try {
      setSaving(true)
      const response = await fetch('/api/tasks/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: formData.client_id,
          service_id: formData.service_id
        })
      })

      if (response.ok) {
        const result = await response.json()
        setCurrentDraftId(result.task.id)
        
        // Immediately update with all current form data
        await fetch(`/api/tasks/${result.task.id}/draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
      }
    } catch (error) {
      console.error('Error creating initial draft:', error)
    } finally {
      setSaving(false)
    }
  }

  const showSuccessMessage = (message) => {
    const successDiv = document.createElement('div')
    successDiv.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50'
    successDiv.textContent = message
    document.body.appendChild(successDiv)
    
    setTimeout(() => {
      if (document.body.contains(successDiv)) {
        document.body.removeChild(successDiv)
      }
    }, 3000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Task</h2>
            <p className="text-sm text-gray-600 mt-1">
              Step {currentStep} of 4: {getStepTitle()}
            </p>
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
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    currentStep >= step 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {currentStep > step ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step
                    )}
                  </div>
                  <span className={`mt-1 text-xs font-medium ${
                    currentStep >= step ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {getStepLabel(step)}
                  </span>
                </div>
                {step < 4 && (
                  <div className={`w-16 h-0.5 mx-2 transition-colors ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-600">{getStepDescription()}</p>
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
        <div className="flex-1 overflow-y-auto">
          {currentStep === 1 && (
            <ServiceSelectionStep
              services={availableServices}
              selectedService={selectedService}
              onServiceSelect={handleServiceSelection}
            />
          )}

          {currentStep === 2 && (
            <ClientSelectionStep
              clients={availableClients}
              selectedClient={selectedClient}
              onClientSelect={handleClientSelection}
            />
          )}

          {currentStep === 3 && (
            <CustomFieldsStep
              customFields={serviceCustomFields}
              values={formData.custom_field_values}
              onValuesChange={handleCustomFieldsUpdate}
              selectedService={selectedService}
            />
          )}

          {currentStep === 4 && (
            <TaskPreviewStep
              formData={formData}
              selectedService={selectedService}
              selectedClient={selectedClient}
              customFields={serviceCustomFields}
              onFormDataUpdate={handleFormDataUpdate}
            />
          )}
        </div>

        {/* Footer */}
        {!showDraftSelector && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              {currentStep === 1 && `${availableServices.length} services available`}
              {currentStep === 2 && `${availableClients.length} clients available`}
              {currentStep === 3 && `${serviceCustomFields.length} field${serviceCustomFields.length !== 1 ? 's' : ''} to fill`}
              {currentStep === 4 && 'Ready to create task'}
              {currentDraftId && (
                <span className="ml-2 text-purple-600">• Draft ID: {currentDraftId.slice(0, 8)}...</span>
              )}
            </div>
            
            <div className="flex space-x-3">
              {currentStep > 1 && (
                <button
                  onClick={handlePrevious}
                  disabled={loading || saving}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
              )}
              
              <button
                onClick={onClose}
                disabled={loading || saving}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              {/* Save Button - show on all steps */}
              <button
                onClick={handleSave}
                disabled={saving || loading || (!formData.service_id && !currentDraftId)}
                className="px-4 py-2 border border-blue-300 rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {saving && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {saving ? 'Saving...' : 'Save'}
              </button>
              
              {currentStep < 4 ? (
                <button
                  onClick={handleNext}
                  disabled={!canProceed() || loading || saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canProceed() || loading || saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                >
                  {loading && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {loading ? 'Creating Task...' : 'Create Task'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Draft Selector Content */}
        {showDraftSelector && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Resume or Start New?</h3>
              <p className="text-gray-600">
                You have {existingDrafts.length} draft task{existingDrafts.length !== 1 ? 's' : ''} in progress. 
                Would you like to resume one or start a new task?
              </p>
            </div>

            <div className="space-y-4 mb-6">
              {existingDrafts.map((draft) => (
                <div
                  key={draft.id}
                  onClick={() => resumeDraft(draft)}
                  className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          {draft.service_name}
                        </h4>
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          Draft
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Client: {draft.client_name}
                      </p>
                      <div className="flex items-center mt-2 text-xs text-gray-500 space-x-4">
                        <span>
                          Created: {new Date(draft.created_at).toLocaleDateString()}
                        </span>
                        <span>
                          Updated: {new Date(draft.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-blue-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={startNewTask}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Start New Task Instead
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}