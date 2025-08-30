// src/components/tasks/TaskCreationModal.jsx
'use client'

import { useState, useEffect } from 'react'
import ServiceSelectionStep from './ServiceSelectionStep'
import CustomFieldsStep from './CustomFieldsStep'
import ClientSelectionStep from './ClientSelectionStep'
import TaskPreviewStep from './TaskPreviewStep'

export default function TaskCreationModal({ isOpen, onClose, onTaskCreated }) {
  const [currentStep, setCurrentStep] = useState(1) // 1: Service, 2: Custom Fields, 3: Client, 4: Preview
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
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
      setCurrentStep(1)
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
      fetchInitialData()
    }
  }, [isOpen])

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
    setFormData(prev => ({ ...prev, service_id: service.id }))
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

  const handleCustomFieldsUpdate = (customFieldValues) => {
    setFormData(prev => ({ ...prev, custom_field_values: customFieldValues }))
    setError('')
  }

  const handleClientSelection = (client) => {
    setSelectedClient(client)
    setFormData(prev => ({ ...prev, client_id: client.id }))
    setError('')
  }

  const handleFormDataUpdate = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const handleNext = () => {
    if (currentStep === 1) {
      if (!selectedService) {
        setError('Please select a service')
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
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
      setCurrentStep(3)
    } else if (currentStep === 3) {
      if (!selectedClient) {
        setError('Please select a client')
        return
      }
      setCurrentStep(4)
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

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create task')
      }

      const result = await response.json()
      
      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        console.warn('Task creation warnings:', result.warnings)
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
        const requiredFields = serviceCustomFields.filter(field => field.required)
        return requiredFields.every(field => {
          const value = formData.custom_field_values[field.name] || formData.custom_field_values[field.label]
          return value && (typeof value !== 'string' || value.trim())
        })
      case 3:
        return !!selectedClient
      case 4:
        return true
      default:
        return false
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Select Service'
      case 2: return 'Service Requirements'
      case 3: return 'Select Client'
      case 4: return 'Review & Create'
      default: return 'Create Task'
    }
  }

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return 'Choose the service bundle for this task'
      case 2: return 'Fill in the required information for document generation'
      case 3: return 'Select the client this task is for'
      case 4: return 'Review your task details before creating'
      default: return ''
    }
  }

  // Get step label for progress steps
  const getStepLabel = (step) => {
    switch (step) {
      case 1: return 'Service'
      case 2: return 'Requirements'
      case 3: return 'Client'
      case 4: return 'Review'
      default: return ''
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
            <CustomFieldsStep
              customFields={serviceCustomFields}
              values={formData.custom_field_values}
              onValuesChange={handleCustomFieldsUpdate}
              selectedService={selectedService}
            />
          )}

          {currentStep === 3 && (
            <ClientSelectionStep
              clients={availableClients}
              selectedClient={selectedClient}
              onClientSelect={handleClientSelection}
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
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {currentStep === 1 && `${availableServices.length} services available`}
            {currentStep === 2 && `${serviceCustomFields.length} field${serviceCustomFields.length !== 1 ? 's' : ''} to fill`}
            {currentStep === 3 && `${availableClients.length} clients available`}
            {currentStep === 4 && 'Ready to create task'}
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
            
            {currentStep < 4 ? (
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
                {loading ? 'Creating Task...' : 'Create Task'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}