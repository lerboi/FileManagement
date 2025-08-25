// src/components/documents/DocumentGeneratorModal.jsx
'use client'

import { useState, useEffect } from 'react'
import CustomFieldsForm from './CustomFieldsForm'

export default function DocumentGeneratorModal({ 
  isOpen, 
  onClose, 
  template 
}) {
  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [customFieldValues, setCustomFieldValues] = useState({})
  const [currentStep, setCurrentStep] = useState('clientSelection') // 'clientSelection', 'customFields', 'generating'
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const hasCustomFields = template?.custom_fields && template.custom_fields.length > 0

  useEffect(() => {
    if (isOpen) {
      fetchClients()
      setCurrentStep('clientSelection')
      setSelectedClientId('')
      setCustomFieldValues({})
      setError('')
    }
  }, [isOpen])

  const fetchClients = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/clients')
      if (!response.ok) {
        throw new Error('Failed to fetch clients')
      }
      const data = await response.json()
      setClients(data.clients || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
      setError('Failed to load clients')
    } finally {
      setLoading(false)
    }
  }

  const handleNextStep = () => {
    if (currentStep === 'clientSelection') {
      if (!selectedClientId) {
        setError('Please select a client')
        return
      }
      
      // If template has custom fields, go to custom fields step
      if (hasCustomFields) {
        setCurrentStep('customFields')
      } else {
        // No custom fields, proceed directly to generation
        handleGenerate()
      }
      setError('')
    } else if (currentStep === 'customFields') {
      // Validate custom fields
      const requiredFields = template.custom_fields.filter(f => f.required)
      const missingFields = requiredFields.filter(f => 
        !customFieldValues[f.name] || customFieldValues[f.name].toString().trim() === ''
      )
      
      if (missingFields.length > 0) {
        setError(`Please fill in required fields: ${missingFields.map(f => f.label).join(', ')}`)
        return
      }
      
      setError('')
      handleGenerate()
    }
  }

  const handlePrevStep = () => {
    if (currentStep === 'customFields') {
      setCurrentStep('clientSelection')
      setError('')
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setCurrentStep('generating')
    
    try {
      const response = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: template.id,
          clientId: selectedClientId,
          customFieldValues: customFieldValues // Pass custom field values
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate document')
      }

      const result = await response.json()
      
      // Success - show success message or close modal
      alert('Document generated successfully!')
      onClose()
      
      // Optional: Open generated document in new tab
      if (result.document?.generated_content) {
        const blob = new Blob([result.document.generated_content], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
      }

    } catch (error) {
      console.error('Error generating document:', error)
      setError('Failed to generate document: ' + error.message)
      setCurrentStep(hasCustomFields ? 'customFields' : 'clientSelection')
    } finally {
      setGenerating(false)
    }
  }

  const renderClientSelection = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900">Select Client</h3>
        <p className="text-sm text-gray-600 mt-1">
          Choose the client for whom you want to test the document generation
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3">Loading clients...</span>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          <div className="space-y-2">
            {clients.map((client) => (
              <div
                key={client.id}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                  selectedClientId === client.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedClientId(client.id)}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    checked={selectedClientId === client.id}
                    onChange={() => setSelectedClientId(client.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div className="ml-3 flex-1">
                    <div className="font-medium text-gray-900">
                      {client.first_name} {client.last_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {client.email}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {clients.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="mt-2">No clients found</p>
              <p className="text-sm">Add some clients first to test document generation</p>
            </div>
          )}
        </div>
      )}
    </div>
  )

  const renderCustomFields = () => (
    <CustomFieldsForm
      customFields={template.custom_fields}
      values={customFieldValues}
      onFieldsChange={setCustomFieldValues}
    />
  )

  const renderGenerating = () => (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <h3 className="text-lg font-medium text-gray-900 mt-4">Generating Document</h3>
      <p className="text-sm text-gray-600 mt-2">
        Please wait while we generate your document...
      </p>
    </div>
  )

  const getStepContent = () => {
    switch (currentStep) {
      case 'clientSelection':
        return renderClientSelection()
      case 'customFields':
        return renderCustomFields()
      case 'generating':
        return renderGenerating()
      default:
        return renderClientSelection()
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 'clientSelection':
        return 'Step 1: Select Client'
      case 'customFields':
        return 'Step 2: Custom Field Values'
      case 'generating':
        return 'Generating...'
      default:
        return 'Test Document Generation'
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 'clientSelection':
        return selectedClientId !== ''
      case 'customFields':
        const requiredFields = template.custom_fields.filter(f => f.required)
        return requiredFields.every(f => 
          customFieldValues[f.name] && customFieldValues[f.name].toString().trim() !== ''
        )
      default:
        return false
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{getStepTitle()}</h2>
            <p className="text-sm text-gray-600 mt-1">
              Template: {template?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={generating}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Indicator */}
        {!generating && (
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center ${
                currentStep === 'clientSelection' ? 'text-blue-600' : 'text-green-600'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === 'clientSelection' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'bg-green-100 text-green-600'
                }`}>
                  {currentStep === 'clientSelection' ? '1' : '✓'}
                </div>
                <span className="ml-2 text-sm">Select Client</span>
              </div>
              
              {hasCustomFields && (
                <>
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <div className={`flex items-center ${
                    currentStep === 'customFields' ? 'text-blue-600' : 
                    currentStep === 'generating' ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      currentStep === 'customFields' ? 'bg-blue-100 text-blue-600' :
                      currentStep === 'generating' ? 'bg-green-100 text-green-600' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {currentStep === 'generating' ? '✓' : '2'}
                    </div>
                    <span className="ml-2 text-sm">Custom Fields</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

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
          {getStepContent()}
        </div>

        {/* Footer */}
        {!generating && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              {hasCustomFields ? (
                currentStep === 'clientSelection' 
                  ? `Next: Custom field values (${template.custom_fields.length} fields)`
                  : 'All steps completed'
              ) : (
                'Ready to generate document'
              )}
            </div>
            
            <div className="flex space-x-3">
              {currentStep === 'customFields' && (
                <button
                  onClick={handlePrevStep}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
              )}
              
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              
              <button
                onClick={handleNextStep}
                disabled={!canProceed()}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {currentStep === 'clientSelection' && hasCustomFields ? 'Next' : 
                 currentStep === 'customFields' ? 'Generate Document' : 
                 'Generate Document'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}