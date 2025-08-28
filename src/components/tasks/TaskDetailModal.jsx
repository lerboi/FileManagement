// src/components/tasks/TaskDetailModal.jsx
'use client'

import { useState, useEffect } from 'react'
import TaskStatusBadge from './TaskStatusBadge'

export default function TaskDetailModal({ isOpen, onClose, task, onTaskUpdated }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [taskDetail, setTaskDetail] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (isOpen && task) {
      fetchTaskDetail()
      setActiveTab('overview')
      setError('')
    }
  }, [isOpen, task])

  const fetchTaskDetail = async () => {
    if (!task) return

    setLoading(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch task details')
      }
      const data = await response.json()
      if (data.success) {
        setTaskDetail(data.task)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleGenerateDocuments = async () => {
    if (!taskDetail) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/tasks/${taskDetail.id}/generate`, {
        method: 'POST'
      })

      const data = await response.json()

      if (data.success) {
        setTaskDetail(data.task)
        onTaskUpdated(data.task)
        showSuccessMessage(`Generated ${data.documentsGenerated} documents successfully`)
        
        // Show warnings if any
        if (data.warnings && data.warnings.length > 0) {
          console.warn('Document generation warnings:', data.warnings)
        }
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadDocument = async (templateId, action = 'preview') => {
    if (!taskDetail) return

    try {
      if (action === 'preview') {
        // Open preview in new tab
        const previewUrl = `/api/tasks/${taskDetail.id}/preview?templateId=${templateId}`
        window.open(previewUrl, '_blank')
      } else if (action === 'download') {
        // Download as file
        const response = await fetch(`/api/tasks/${taskDetail.id}/preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            templateId: templateId,
            format: 'html'
          })
        })

        if (!response.ok) {
          throw new Error('Failed to download document')
        }

        // Create download
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // Get document name from taskDetail
        const document = taskDetail.generated_documents?.find(doc => doc.templateId === templateId)
        const fileName = document ? `${document.fileName}.html` : `document_${templateId}.html`
        
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      setError(error.message)
    }
  }

  const handleDownloadAll = async () => {
    if (!taskDetail) return

    try {
      const generatedDocs = taskDetail.generated_documents?.filter(doc => doc.status === 'generated') || []
      
      // Open all documents in separate tabs for preview
      generatedDocs.forEach((doc, index) => {
        setTimeout(() => {
          const previewUrl = `/api/tasks/${taskDetail.id}/preview?templateId=${doc.templateId}`
          window.open(previewUrl, '_blank')
        }, index * 500) // Stagger the opening to avoid browser blocking
      })
    } catch (error) {
      setError(error.message)
    }
  }

  // UPDATE THE DOCUMENTS TAB JSX TO INCLUDE PREVIEW AND DOWNLOAD BUTTONS
  {activeTab === 'documents' && (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Documents</h3>
        <div className="flex space-x-2">
          {taskDetail.status === 'in_progress' && (
            <button
              onClick={handleGenerateDocuments}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              {loading ? 'Generating...' : 'Generate Documents'}
            </button>
          )}
          
          {(taskDetail.generated_documents?.length > 0) && (
            <button
              onClick={handleDownloadAll}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview All
            </button>
          )}
        </div>
      </div>

      {/* Generated Documents List */}
      <div className="space-y-4">
        {taskDetail.generated_documents && taskDetail.generated_documents.length > 0 ? (
          taskDetail.generated_documents.map((doc, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{doc.templateName}</h4>
                  <p className="text-xs text-gray-600">{doc.fileName}</p>
                  <p className="text-xs text-gray-500">
                    Status: <span className="capitalize">{doc.status}</span>
                    {doc.generatedAt && ` • Generated: ${formatDate(doc.generatedAt)}`}
                  </p>
                </div>
                {doc.status === 'generated' && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDownloadDocument(doc.templateId, 'preview')}
                      className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-md text-sm text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Preview
                    </button>
                    <button
                      onClick={() => handleDownloadDocument(doc.templateId, 'download')}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
                      </svg>
                      Download
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Documents Generated</h3>
            <p className="mt-1 text-sm text-gray-500">
              {taskDetail.status === 'in_progress' 
                ? 'Click "Generate Documents" to create documents from templates.'
                : 'Documents will appear here once generated.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )}

  const handleUploadSigned = () => {
    // This would open a file upload modal
    setActiveTab('upload')
  }

  const handleCompleteTask = async () => {
    if (!taskDetail) return

    const confirmed = window.confirm(
      'Are you sure you want to complete this task? This action cannot be undone.'
    )

    if (!confirmed) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/tasks/${taskDetail.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      const data = await response.json()

      if (data.success) {
        setTaskDetail(data.task)
        onTaskUpdated(data.task)
        showSuccessMessage('Task completed successfully!')
        
        if (data.warnings && data.warnings.length > 0) {
          console.warn('Task completion warnings:', data.warnings)
        }
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
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

  const getTabClass = (tabName) => {
    const baseClass = "px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors"
    const activeClass = "text-blue-600 border-blue-600 bg-blue-50"
    const inactiveClass = "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
    
    return `${baseClass} ${activeTab === tabName ? activeClass : inactiveClass}`
  }

  if (!isOpen || !task) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Task Details</h2>
              <p className="text-sm text-gray-600 mt-1">
                {taskDetail?.service_name} for {taskDetail?.client_name}
              </p>
            </div>
            {taskDetail && <TaskStatusBadge status={taskDetail.status} />}
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

        {/* Loading State */}
        {loading && !taskDetail && (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading task details...</span>
          </div>
        )}

        {/* Error State */}
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
        {taskDetail && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={getTabClass('overview')}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={getTabClass('documents')}
              >
                Documents ({taskDetail.template_ids?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={getTabClass('upload')}
              >
                Upload ({taskDetail.signed_documents?.length || 0})
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Task Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Task Information</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Service</label>
                          <p className="text-sm text-gray-900">{taskDetail.service_name}</p>
                          {taskDetail.service_description && (
                            <p className="text-xs text-gray-600">{taskDetail.service_description}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Priority</label>
                          <p className="text-sm text-gray-900 capitalize">{taskDetail.priority || 'normal'}</p>
                        </div>
                        {taskDetail.assigned_to && (
                          <div>
                            <label className="text-sm font-medium text-gray-500">Assigned To</label>
                            <p className="text-sm text-gray-900">{taskDetail.assigned_to}</p>
                          </div>
                        )}
                        <div>
                          <label className="text-sm font-medium text-gray-500">Created</label>
                          <p className="text-sm text-gray-900">{formatDate(taskDetail.created_at)}</p>
                        </div>
                        {taskDetail.completed_at && (
                          <div>
                            <label className="text-sm font-medium text-gray-500">Completed</label>
                            <p className="text-sm text-gray-900">{formatDate(taskDetail.completed_at)}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Client Information</h3>
                      <div className="space-y-3">
                        {taskDetail.clients && (
                          <>
                            <div>
                              <label className="text-sm font-medium text-gray-500">Name</label>
                              <p className="text-sm text-gray-900">
                                {taskDetail.clients.first_name} {taskDetail.clients.last_name}
                              </p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">Email</label>
                              <p className="text-sm text-gray-900">{taskDetail.clients.email || 'Not provided'}</p>
                            </div>
                            {taskDetail.clients.phone && (
                              <div>
                                <label className="text-sm font-medium text-gray-500">Phone</label>
                                <p className="text-sm text-gray-900">{taskDetail.clients.phone}</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Custom Fields */}
                  {taskDetail.custom_field_values && Object.keys(taskDetail.custom_field_values).length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Custom Field Values</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(taskDetail.custom_field_values).map(([key, value]) => (
                          <div key={key}>
                            <label className="text-sm font-medium text-gray-500 capitalize">
                              {key.replace(/_/g, ' ')}
                            </label>
                            <p className="text-sm text-gray-900">
                              {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value || 'Not provided'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {taskDetail.notes && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Notes</h3>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{taskDetail.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Documents</h3>
                    <div className="flex space-x-2">
                      {taskDetail.status === 'in_progress' && (
                        <button
                          onClick={handleGenerateDocuments}
                          disabled={loading}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                        >
                          {loading ? (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                          {loading ? 'Generating...' : 'Generate Documents'}
                        </button>
                      )}
                      
                      {(taskDetail.generated_documents?.length > 0) && (
                        <button
                          onClick={handleDownloadAll}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download All
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Generated Documents List */}
                  <div className="space-y-4">
                    {taskDetail.generated_documents && taskDetail.generated_documents.length > 0 ? (
                      taskDetail.generated_documents.map((doc, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">{doc.templateName}</h4>
                              <p className="text-xs text-gray-600">{doc.fileName}</p>
                              <p className="text-xs text-gray-500">
                                Status: <span className="capitalize">{doc.status}</span>
                                {doc.generatedAt && ` • Generated: ${formatDate(doc.generatedAt)}`}
                              </p>
                            </div>
                            {doc.status === 'generated' && (
                              <button
                                onClick={() => handleDownloadDocument(doc.templateId)}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
                                </svg>
                                Download
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No Documents Generated</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {taskDetail.status === 'in_progress' 
                            ? 'Click "Generate Documents" to create documents from templates.'
                            : 'Documents will appear here once generated.'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'upload' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Upload Signed Documents</h3>
                    {taskDetail.status === 'awaiting' && (
                      <button
                        onClick={handleUploadSigned}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload Files
                      </button>
                    )}
                  </div>

                  {/* Signed Documents List */}
                  <div className="space-y-4">
                    {taskDetail.signed_documents && taskDetail.signed_documents.length > 0 ? (
                      taskDetail.signed_documents.map((doc, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">{doc.originalName}</h4>
                              <p className="text-xs text-gray-600">
                                Uploaded: {formatDate(doc.uploadedAt)}
                              </p>
                              <p className="text-xs text-gray-500">
                                Size: {Math.round(doc.fileSize / 1024)} KB
                              </p>
                            </div>
                            <a
                              href={doc.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              View
                            </a>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No Signed Documents</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Upload signed documents to complete the task.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-600">
                Task ID: {taskDetail.id}
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                
                {taskDetail.status === 'awaiting' && taskDetail.signed_documents?.length > 0 && (
                  <button
                    onClick={handleCompleteTask}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {loading ? 'Completing...' : 'Complete Task'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}