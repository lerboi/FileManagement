// src/components/clients/ClientDocumentsSection.jsx
'use client'

import { useState } from 'react'
import DocumentUploadModal from './DocumentUploadModal'

export default function ClientDocumentsSection({ clientId, documents, onDocumentsUpdate, onDocumentPreview }) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [deleting, setDeleting] = useState({})

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-SG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleDeleteDocument = async (documentId, fileName) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      return
    }

    setDeleting(prev => ({ ...prev, [documentId]: true }))

    try {
      const response = await fetch(`/api/clients/${clientId}/documents/${documentId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete document')
      }

      // Notify parent to refresh documents
      if (onDocumentsUpdate) {
        onDocumentsUpdate()
      }

      alert('Document deleted successfully')

    } catch (error) {
      alert('Error deleting document: ' + error.message)
    } finally {
      setDeleting(prev => ({ ...prev, [documentId]: false }))
    }
  }

  const handleDownloadDocument = async (documentId, fileName) => {
    try {
      const response = await fetch(`/api/clients/${clientId}/documents/${documentId}`)
      const result = await response.json()

      if (result.success) {
        // Create a temporary link to download the file
        const link = document.createElement('a')
        link.href = result.downloadUrl
        link.download = result.fileName || fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        alert('Failed to download document: ' + result.error)
      }
    } catch (error) {
      alert('Error downloading document: ' + error.message)
    }
  }

  const handlePreviewDocument = (document) => {
    // Add clientId to document object for preview modal
    const documentWithClientId = {
      ...document,
      clientId: clientId
    }
    onDocumentPreview && onDocumentPreview(documentWithClientId, 'client')
  }

  const handleUploadSuccess = () => {
    // Refresh documents after successful upload
    if (onDocumentsUpdate) {
      onDocumentsUpdate()
    }
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Additional Client Documents</h2>
          <p className="text-sm text-gray-600 mt-1">
            Additional documents for this client (separate from task-specific documents)
          </p>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload Documents
        </button>
      </div>

      <div className="p-6">
        {/* Documents List */}
        <div>
          <h3 className="text-md font-medium text-gray-900 mb-4">
            Uploaded Documents ({documents.length})
          </h3>

          {documents.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h4 className="mt-2 text-sm font-medium text-gray-900">No documents uploaded</h4>
              <p className="mt-1 text-sm text-gray-500">Click "Upload Documents" to add documents for this client.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">{doc.originalName}</h4>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-gray-500">
                          Uploaded: {formatDate(doc.uploadedAt)}
                        </span>
                        <span className="text-xs text-gray-500">
                          Size: {formatFileSize(doc.fileSize)}
                        </span>
                        {doc.fileType && (
                          <span className="text-xs text-gray-500">
                            Type: {doc.fileType}
                          </span>
                        )}
                      </div>
                      {doc.description && (
                        <p className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                          {doc.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handlePreviewDocument(doc)}
                        className="text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handleDownloadDocument(doc.id, doc.originalName)}
                        className="text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.originalName)}
                        disabled={deleting[doc.id]}
                        className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {deleting[doc.id] ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        clientId={clientId}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  )
}