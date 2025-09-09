// src/components/clients/ClientTasksSection.jsx
'use client'

import { useState } from 'react'

export default function ClientTasksSection({ ongoingTasks, completedTasks, onDocumentPreview }) {
  const [activeTab, setActiveTab] = useState('completed')

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-SG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status) => {
    const statusClasses = {
      'in_progress': 'bg-blue-100 text-blue-800',
      'awaiting': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800'
    }

    const statusLabels = {
      'in_progress': 'In Progress',
      'awaiting': 'Awaiting',
      'completed': 'Completed'
    }

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClasses[status] || 'bg-gray-100 text-gray-800'}`}>
        {statusLabels[status] || status}
      </span>
    )
  }

  const getPriorityBadge = (priority) => {
    const priorityClasses = {
      'low': 'bg-gray-100 text-gray-800',
      'normal': 'bg-blue-100 text-blue-800',
      'high': 'bg-orange-100 text-orange-800',
      'urgent': 'bg-red-100 text-red-800'
    }

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${priorityClasses[priority] || 'bg-gray-100 text-gray-800'}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    )
  }

  const handleDocumentDownload = async (taskId, templateId, fileName) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/download?templateId=${templateId}`)
      const result = await response.json()
      
      if (result.success && result.download) {
        // Create a temporary link to download the file
        const link = document.createElement('a')
        link.href = result.download.url
        link.download = result.download.fileName || fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        alert('Failed to download document: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Error downloading document: ' + error.message)
    }
  }

  const handleTaskDocumentPreview = async (taskId, templateId, fileName) => {
    try {
      // Open preview in new window using your existing preview endpoint
      const previewUrl = `/api/tasks/${taskId}/preview?templateId=${templateId}`
      window.open(previewUrl, '_blank')
    } catch (error) {
      alert('Error previewing document: ' + error.message)
    }
  }

  const renderTaskCard = (task) => (
    <div key={task.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="text-lg font-medium text-gray-900">{task.service_name}</h4>
          <p className="text-sm text-gray-600">{task.service_description}</p>
        </div>
        <div className="flex flex-col space-y-2">
          {getStatusBadge(task.status)}
          {getPriorityBadge(task.priority)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <span className="text-sm font-medium text-gray-500">Created:</span>
          <p className="text-sm text-gray-900">{formatDate(task.created_at)}</p>
        </div>
        <div>
          <span className="text-sm font-medium text-gray-500">Last Updated:</span>
          <p className="text-sm text-gray-900">{formatDate(task.updated_at)}</p>
        </div>
        {task.completed_at && (
          <div>
            <span className="text-sm font-medium text-gray-500">Completed:</span>
            <p className="text-sm text-gray-900">{formatDate(task.completed_at)}</p>
          </div>
        )}
        {task.assigned_to && (
          <div>
            <span className="text-sm font-medium text-gray-500">Assigned To:</span>
            <p className="text-sm text-gray-900">{task.assigned_to}</p>
          </div>
        )}
      </div>

      {task.notes && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-500">Notes:</span>
          <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded mt-1">{task.notes}</p>
        </div>
      )}

      {/* Custom Fields */}
      {task.custom_field_values && Object.keys(task.custom_field_values).length > 0 && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-500">Custom Fields:</span>
          <div className="mt-1 bg-gray-50 p-3 rounded">
            {Object.entries(task.custom_field_values).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center py-1">
                <span className="text-sm font-medium text-gray-700">{key}:</span>
                <span className="text-sm text-gray-900">{value || 'N/A'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents Section */}
      {task.status === 'completed' && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center mb-3">
            <h5 className="text-sm font-medium text-gray-900">Documents</h5>
            {(task.generated_documents?.some(doc => doc.status === 'generated') || 
              task.signed_documents?.length > 0 || 
              task.additional_files?.length > 0) && (
              <button
                onClick={() => handleDownloadAllDocuments(task.id)}
                className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200"
              >
                Download All
              </button>
            )}
          </div>
          
          {/* Generated Documents */}
          {task.generated_documents && task.generated_documents.length > 0 && (
            <div className="mb-3">
              <h6 className="text-xs font-medium text-gray-700 mb-2">Generated Documents</h6>
              <div className="space-y-2">
                {task.generated_documents
                  .filter(doc => doc.status === 'generated')
                  .map((doc) => (
                    <div key={doc.templateId} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{doc.templateName}</p>
                        <p className="text-xs text-gray-500">
                          Generated: {formatDate(doc.generatedAt)} • {doc.fileName}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleTaskDocumentPreview(task.id, doc.templateId, doc.fileName)}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => handleDocumentDownload(task.id, doc.templateId, doc.fileName)}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Signed Documents */}
          {task.signed_documents && task.signed_documents.length > 0 && (
            <div className="mb-3">
              <h6 className="text-xs font-medium text-gray-700 mb-2">Signed Documents</h6>
              <div className="space-y-2">
                {task.signed_documents.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{doc.originalName}</p>
                      <p className="text-xs text-gray-500">
                        Uploaded: {formatDate(doc.uploadedAt)} • {(doc.fileSize / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        const docWithTaskId = { ...doc, taskId: task.id }
                        onDocumentPreview && onDocumentPreview(docWithTaskId, 'generated')
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Preview
                    </button>
                      <button
                        onClick={() => window.open(doc.downloadUrl, '_blank')}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Files */}
          {task.additional_files && task.additional_files.length > 0 && (
            <div>
              <h6 className="text-xs font-medium text-gray-700 mb-2">Additional Files</h6>
              <div className="space-y-2">
                {task.additional_files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{file.originalName}</p>
                      <p className="text-xs text-gray-500">
                        Uploaded: {formatDate(file.uploadedAt)} • {(file.fileSize / 1024).toFixed(1)} KB
                        {file.description && ` • ${file.description}`}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onDocumentPreview && onDocumentPreview(file, 'additional')}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => window.open(file.downloadUrl, '_blank')}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  const handleDownloadAllDocuments = async (taskId) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/download`)
      const result = await response.json()
      
      if (result.success && result.downloads && result.downloads.length > 0) {
        // Download each document
        result.downloads.forEach((doc, index) => {
          setTimeout(() => {
            const link = document.createElement('a')
            link.href = doc.url
            link.download = doc.fileName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
          }, index * 500) // Stagger downloads by 500ms
        })
        
        alert(`Started download of ${result.downloads.length} documents`)
      } else {
        alert('No documents available for download: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Error downloading documents: ' + error.message)
    }
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Tasks</h2>
        
        {/* Tab Navigation */}
        <div className="mt-4">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'completed'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Completed Tasks ({completedTasks.length})
            </button>
            <button
              onClick={() => setActiveTab('ongoing')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'ongoing'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Ongoing Tasks ({ongoingTasks.length})
            </button>
          </nav>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'completed' ? (
          completedTasks.length > 0 ? (
            <div className="space-y-4">
              {completedTasks.map(renderTaskCard)}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No completed tasks</h3>
              <p className="mt-1 text-sm text-gray-500">This client has no completed tasks yet.</p>
            </div>
          )
        ) : (
          ongoingTasks.length > 0 ? (
            <div className="space-y-4">
              {ongoingTasks.map(renderTaskCard)}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No ongoing tasks</h3>
              <p className="mt-1 text-sm text-gray-500">This client has no active or pending tasks.</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}