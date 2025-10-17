// src/app/clients/[id]/page.js
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Breadcrumbs from '@/components/common/Breadcrumbs'
import ClientInfoSection from '@/components/clients/ClientInfoSection'
import ClientTasksSection from '@/components/clients/ClientTasksSection'
import ClientDocumentsSection from '@/components/clients/ClientDocumentsSection'
import DocumentPreviewModal from '@/components/clients/DocumentPreviewModal'

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id

  // State
  const [client, setClient] = useState(null)
  const [tasks, setTasks] = useState({ ongoing: [], completed: [] })
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Preview modal state
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    document: null,
    documentType: null
  })

  useEffect(() => {
    // Safety check - redirect if "new" reaches this route
    if (clientId === 'new') {
      router.push('/clients/new')
      return
    }

    if (clientId) {
      fetchClientData()
    }
  }, [clientId, router]) // Added router to dependencies

  const fetchClientData = async () => {
    setLoading(true)
    setError('')

    try {
      // Fetch client info, tasks, and documents in parallel
      const [clientResponse, tasksResponse, documentsResponse] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/clients/${clientId}/tasks?includeCompleted=true`),
        fetch(`/api/clients/${clientId}/documents`)
      ])

      // Handle client response
      if (!clientResponse.ok) {
        console.error('Client API failed:', clientResponse.status, clientResponse.statusText)
        if (clientResponse.status === 404) {
          throw new Error('Client not found')
        }
        throw new Error('Failed to fetch client information')
      }
      const clientData = await clientResponse.json()
      setClient(clientData)

      // Handle tasks response
      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json()

        setTasks({
          ongoing: tasksData.ongoingTasks || [],
          completed: tasksData.completedTasks || []
        })
      } else {
        const errorText = await tasksResponse.text()
        console.error('Tasks API failed:', tasksResponse.status, errorText)
        console.warn('Failed to fetch tasks - continuing with empty arrays')
        setTasks({ ongoing: [], completed: [] })
      }

      // Handle documents response
      if (documentsResponse.ok) {
        const documentsData = await documentsResponse.json()

        setDocuments(documentsData.documents || [])
      } else {
        const errorText = await documentsResponse.text()
        setDocuments([])
      }

    } catch (err) {
      console.error('Error in fetchClientData:', err)
      setError(err.message)
      if (err.message === 'Client not found') {
        setTimeout(() => router.push('/clients'), 2000)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClientUpdate = (updatedClient) => {
    setClient(updatedClient)
  }

  const handleDocumentsUpdate = () => {
    fetchDocuments()
  }

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}/documents`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error refreshing documents:', error)
    }
  }

  const handleDocumentPreview = (document, documentType) => {
    setPreviewModal({
      isOpen: true,
      document,
      documentType
    })
  }

  const closePreviewModal = () => {
    setPreviewModal({
      isOpen: false,
      document: null,
      documentType: null
    })
  }

  // Breadcrumb items
  const breadcrumbItems = [
    {
      label: 'Clients',
      href: '/clients',
      icon: () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      label: client ? `${client.first_name} ${client.last_name}` : 'Loading...'
    }
  ]

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-2">Loading client details...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Error Loading Client</h3>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
            {error === 'Client not found' && (
              <p className="mt-2 text-sm text-gray-500">Redirecting to clients list...</p>
            )}
            <div className="mt-6">
              <button
                onClick={() => router.push('/clients')}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Back to Clients
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Breadcrumbs */}
          <Breadcrumbs items={breadcrumbItems} />

          {/* Client Statistics */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Tasks</div>
              <div className="text-2xl font-bold text-gray-900">
                {tasks.ongoing.length + tasks.completed.length}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Ongoing Tasks</div>
              <div className="text-2xl font-bold text-blue-600">
                {tasks.ongoing.length}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Completed Tasks</div>
              <div className="text-2xl font-bold text-green-600">
                {tasks.completed.length}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Documents</div>
              <div className="text-2xl font-bold text-purple-600">
                {documents.length}
              </div>
            </div>
          </div>

          {/* Main Content Sections */}
          <div className="space-y-6">
            {/* Client Information */}
            <ClientInfoSection
              client={client}
              onClientUpdate={handleClientUpdate}
            />

            {/* Tasks */}
            <ClientTasksSection
              ongoingTasks={tasks.ongoing}
              completedTasks={tasks.completed}
              onDocumentPreview={handleDocumentPreview}
            />

            {/* Client Documents */}
            <ClientDocumentsSection
              clientId={clientId}
              documents={documents}
              onDocumentsUpdate={handleDocumentsUpdate}
              onDocumentPreview={handleDocumentPreview}
            />
          </div>
        </div>
      </div>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewModal.isOpen}
        onClose={closePreviewModal}
        document={previewModal.document}
        documentType={previewModal.documentType}
      />
    </div>
  )
}