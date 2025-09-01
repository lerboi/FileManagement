// src/components/tasks/TaskDetailModal.jsx
'use client'
import OverviewTab from './tabs/OverviewTab'
import DocumentsTab from './tabs/DocumentsTab'
import UploadTab from './tabs/UploadTab'
import { useState, useEffect } from 'react'
import TaskStatusBadge from './TaskStatusBadge'

export default function TaskDetailModal({ isOpen, onClose, task, onTaskUpdated }) {
  const [loading, setLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState('')
  const [taskDetail, setTaskDetail] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (isOpen && task) {
      fetchTaskDetail()
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

    setRegenerating(true)
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
      showErrorMessage(`Failed to generate documents: ${error.message}`)
    } finally {
      setRegenerating(false)
    }
  }

  const handleRetryGeneration = async () => {
    if (!taskDetail) return

    const confirmed = window.confirm(
      'Are you sure you want to retry document generation? This will replace any existing generated documents.'
    )

    if (!confirmed) return

    await handleGenerateDocuments()
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
      showErrorMessage(`Failed to ${action} document: ${error.message}`)
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
      showErrorMessage(`Failed to preview documents: ${error.message}`)
    }
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
      showErrorMessage(`Failed to complete task: ${error.message}`)
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
    }, 5000)
  }

  const showErrorMessage = (message) => {
    const errorDiv = document.createElement('div')
    errorDiv.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded shadow-lg z-50'
    errorDiv.textContent = message
    document.body.appendChild(errorDiv)
    
    setTimeout(() => {
      if (document.body.contains(errorDiv)) {
        document.body.removeChild(errorDiv)
      }
    }, 5000)
  }

  const getTabClass = (tabName) => {
    const baseClass = "px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors"
    const activeClass = "text-blue-600 border-blue-600 bg-blue-50"
    const inactiveClass = "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
    
    return `${baseClass} ${activeTab === tabName ? activeClass : inactiveClass}`
  }

  const canGenerateDocuments = () => {
    if (!taskDetail) return false
    return ['in_progress', 'awaiting'].includes(taskDetail.status)
  }

  const hasGeneratedDocuments = () => {
    return taskDetail?.generated_documents && taskDetail.generated_documents.length > 0
  }

  const hasSuccessfulDocuments = () => {
    return taskDetail?.generated_documents?.some(doc => doc.status === 'generated') || false
  }

  const hasFailedDocuments = () => {
    return taskDetail?.generated_documents?.some(doc => doc.status === 'failed') || false
  }

  const handleUploadSignedDocument = async (templateId, templateName) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.doc,.docx'
    input.multiple = false
    
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return

      const formData = new FormData()
      formData.append('file', file)
      formData.append('templateId', templateId)
      formData.append('templateName', templateName)
      
      try {
        setError('')
        const response = await fetch(`/api/tasks/${taskDetail.id}/upload-signed`, {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (data.success) {
          setTaskDetail(data.task)
          onTaskUpdated(data.task)
          showSuccessMessage(`Signed version of "${templateName}" uploaded successfully`)
        } else {
          throw new Error(data.error)
        }
      } catch (error) {
        setError(error.message)
        showErrorMessage(`Failed to upload signed document: ${error.message}`)
      }
    }
    
    input.click()
  }

  const handleUploadAdditionalDocuments = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png'
    
    input.onchange = async (e) => {
      const files = Array.from(e.target.files)
      if (files.length === 0) return

      const description = prompt('Enter a description for these additional documents (optional):') || ''
      
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('description', description)
      
      try {
        setError('')
        const response = await fetch(`/api/tasks/${taskDetail.id}/additional-files`, {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (data.success) {
          setTaskDetail(data.task)
          onTaskUpdated(data.task)
          showSuccessMessage(`${data.uploadedFiles} additional file${data.uploadedFiles !== 1 ? 's' : ''} uploaded successfully`)
        } else {
          throw new Error(data.error)
        }
      } catch (error) {
        setError(error.message)
        showErrorMessage(`Failed to upload additional files: ${error.message}`)
      }
    }
    
    input.click()
  }

  const handleDeleteAdditionalFile = async (filePath) => {
    const confirmed = window.confirm('Are you sure you want to delete this file?')
    if (!confirmed) return

    try {
      const response = await fetch(`/api/tasks/${taskDetail.id}/additional-files`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filePath })
      })

      const data = await response.json()

      if (data.success) {
        setTaskDetail(data.task)
        onTaskUpdated(data.task)
        showSuccessMessage('File deleted successfully')
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      setError(error.message)
      showErrorMessage(`Failed to delete file: ${error.message}`)
    }
  }

  if (!isOpen || !task) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
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
            {taskDetail && (
              <TaskStatusBadge 
                status={taskDetail.status} 
                isDraft={taskDetail.is_draft}
                size="lg" 
              />
            )}
          </div>
          <button
            onClick={onClose}
            disabled={loading || regenerating}
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
                Upload
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'overview' && (
                <OverviewTab
                  taskDetail={taskDetail}
                  formatDate={formatDate}
                  onTaskUpdated={(updatedTask) => {
                    setTaskDetail(updatedTask)
                    onTaskUpdated(updatedTask)
                    // If task is completed, refresh and close modal
                    if (updatedTask.status === 'completed') {
                      showSuccessMessage('Task completed successfully!')
                      setTimeout(() => {
                        onClose()
                      }, 1500)
                    }
                  }}
                  showSuccessMessage={showSuccessMessage}
                  showErrorMessage={showErrorMessage}
                  onClose={onClose}
                />
              )}

              {activeTab === 'documents' && (
                <DocumentsTab
                  taskDetail={taskDetail}
                  canGenerateDocuments={canGenerateDocuments}
                  hasGeneratedDocuments={hasGeneratedDocuments}
                  hasSuccessfulDocuments={hasSuccessfulDocuments}
                  hasFailedDocuments={hasFailedDocuments}
                  regenerating={regenerating}
                  handleGenerateDocuments={handleGenerateDocuments}
                  handleRetryGeneration={handleRetryGeneration}
                  handleDownloadDocument={handleDownloadDocument}
                  handleDownloadAll={handleDownloadAll}
                  formatDate={formatDate}
                />
              )}

              {activeTab === 'upload' && (
                <UploadTab
                  taskDetail={taskDetail}
                  hasGeneratedDocuments={hasGeneratedDocuments}
                  handleDownloadDocument={handleDownloadDocument}
                  handleUploadSignedDocument={handleUploadSignedDocument}
                  handleUploadAdditionalDocuments={handleUploadAdditionalDocuments}
                  handleDeleteAdditionalFile={handleDeleteAdditionalFile}
                  formatDate={formatDate}
                  setError={setError}
                  showSuccessMessage={showSuccessMessage}
                  showErrorMessage={showErrorMessage}
                  onTaskUpdated={onTaskUpdated}
                />
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