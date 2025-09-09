// src/components/clients/ClientInfoSection.jsx
'use client'

import { useState } from 'react'
import ClientForm from '@/components/crm/ClientForm'

export default function ClientInfoSection({ client, onClientUpdate }) {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (formData) => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update client')
      }
      
      const updatedClient = await response.json()
      setIsEditing(false)
      
      // Call parent update function
      if (onClientUpdate) {
        onClientUpdate(updatedClient)
      }
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setError('')
  }

  if (isEditing) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Edit Client Information</h2>
        </div>
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          <ClientForm
            client={client}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Client Information</h2>
        <button
          onClick={() => setIsEditing(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Edit Client
        </button>
      </div>
      
      <div className="p-6">
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
                  {client.address_line_1 ? (
                    <>
                      {client.address_line_1}<br />
                      {client.address_line_2 && <>{client.address_line_2}<br /></>}
                      {client.city && <>{client.city} </>}
                      {client.postal_code && <>{client.postal_code}<br /></>}
                      {client.country}
                    </>
                  ) : (
                    'Not provided'
                  )}
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

        {/* Extended Information */}
        {client.client_info?.[0]?.additional_notes && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Additional Notes</h3>
            <p className="text-gray-700 bg-gray-50 p-4 rounded-md">
              {client.client_info[0].additional_notes}
            </p>
          </div>
        )}

        {/* General Notes */}
        {client.notes && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">General Notes</h3>
            <p className="text-gray-700 bg-gray-50 p-4 rounded-md">{client.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}