// src/components/crm/ClientDetailsModal.js
'use client'

import { useState, useEffect } from 'react'
import ClientForm from './ClientForm'

export default function ClientDetailsModal({ 
  isOpen, 
  onClose, 
  clientId = null, 
  mode = 'view' // 'view', 'edit', 'create'
}) {
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(false)
  const [currentMode, setCurrentMode] = useState(mode)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && clientId && (mode === 'view' || mode === 'edit')) {
      fetchClient()
    } else if (isOpen && mode === 'create') {
      setClient(null)
      setCurrentMode('create')
    }
  }, [isOpen, clientId, mode])

  const fetchClient = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`/api/clients/${clientId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch client details')
      }
      
      const clientData = await response.json()
      setClient(clientData)
      setCurrentMode(mode)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (formData) => {
    setLoading(true)
    setError('')
    
    try {
      const url = currentMode === 'create' ? '/api/clients' : `/api/clients/${clientId}`
      const method = currentMode === 'create' ? 'POST' : 'PUT'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save client')
      }
      
      const savedClient = await response.json()
      setClient(savedClient)
      setCurrentMode('view')
      
      // Refresh the parent component (clients list)
      window.location.reload()
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete client')
      }
      
      onClose()
      window.location.reload()
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {currentMode === 'create' && 'Create New Client'}
            {currentMode === 'view' && 'Client Details'}
            {currentMode === 'edit' && 'Edit Client'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading && currentMode === 'view' ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-2">Loading client details...</span>
            </div>
          ) : (
            <>
              {currentMode === 'view' && client && (
                <div className="space-y-6">
                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 mb-6">
                    <button
                      onClick={() => setCurrentMode('edit')}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={loading}
                    >
                      Edit Client
                    </button>
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                      disabled={loading}
                    >
                      Delete Client
                    </button>
                  </div>

                  {/* Client Information Display */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-gray-500">Name:</span>
                          <p className="text-gray-900">{client.first_name} {client.last_name}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Email:</span>
                          <p className="text-gray-900">{client.email || 'Not provided'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Phone:</span>
                          <p className="text-gray-900">{client.phone || 'Not provided'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Status:</span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            client.status === 'active' ? 'bg-green-100 text-green-800' :
                            client.status === 'inactive' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Client Type:</span>
                          <p className="text-gray-900">{client.client_type.charAt(0).toUpperCase() + client.client_type.slice(1)}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Address</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-gray-500">Address:</span>
                          <p className="text-gray-900">
                            {client.address_line_1 && (
                              <>
                                {client.address_line_1}<br />
                                {client.address_line_2 && <>{client.address_line_2}<br /></>}
                                {client.city && <>{client.city} </>}
                                {client.postal_code && <>{client.postal_code}<br /></>}
                                {client.country}
                              </>
                            )}
                            {!client.address_line_1 && 'Not provided'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Professional Information</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-gray-500">Occupation:</span>
                          <p className="text-gray-900">{client.occupation || 'Not provided'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Company:</span>
                          <p className="text-gray-900">{client.company || 'Not provided'}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-gray-500">Date of Birth:</span>
                          <p className="text-gray-900">
                            {client.date_of_birth ? new Date(client.date_of_birth).toLocaleDateString() : 'Not provided'}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Created:</span>
                          <p className="text-gray-900">{new Date(client.created_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Last Updated:</span>
                          <p className="text-gray-900">{new Date(client.updated_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {client.notes && (
                    <div className="mt-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Notes</h3>
                      <p className="text-gray-700 bg-gray-50 p-4 rounded-md">{client.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {(currentMode === 'edit' || currentMode === 'create') && (
                <ClientForm
                  client={client}
                  onSubmit={handleSubmit}
                  onCancel={() => currentMode === 'create' ? onClose() : setCurrentMode('view')}
                  loading={loading}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}