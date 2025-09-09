// src/components/clients/DocumentPreviewModal.jsx
'use client'

import { useState, useEffect } from 'react'

export default function DocumentPreviewModal({ isOpen, onClose, document, documentType }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    if (isOpen && document) {
      loadPreview()
    } else {
      setPreviewUrl('')
      setError('')
    }
  }, [isOpen, document])

  const loadPreview = async () => {
    setLoading(true)
    setError('')

    try {
      if (documentType === 'generated' && document.templateId) {
        // For generated documents, we need the taskId which should be passed in the document object
        if (document.taskId) {
          const previewUrl = `/api/tasks/${document.taskId}/preview?templateId=${document.templateId}`
          setPreviewUrl(previewUrl)
        } else {
          // Fallback to download URL if taskId not available
          setPreviewUrl(document.downloadUrl)
        }
      } else if (documentType === 'client' && document.id) {
        // For client documents, get fresh signed URL
        const clientId = document.clientId || 'unknown'
        const response = await fetch(`/api/clients/${clientId}/documents/${document.id}`)
        const result = await response.json()
        
        if (result.success) {
          setPreviewUrl(result.downloadUrl)
        } else {
          throw new Error('Failed to get document URL')
        }
      } else {
        // For other document types, use the existing download URL
        setPreviewUrl(document.downloadUrl)
      }
    } catch (err) {
      setError('Failed to load document preview')
    } finally {
      setLoading(false)
    }
  }

  const openInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank')
    }
  }

  const getDocumentTitle = () => {
    switch (documentType) {
      case 'generated':
        return document.templateName || 'Generated Document'
      case 'signed':
        return document.originalName || 'Signed Document'
      case 'additional':
        return document.originalName || 'Additional Document'
      case 'client':
        return document.originalName || 'Client Document'
      default:
        return 'Document Preview'
    }
  }

  const canPreviewInline = () => {
    if (!document) return false
    
    // Generated documents can always be previewed via the preview endpoint
    if (documentType === 'generated') return true
    
    const fileType = document.fileType || document.type || ''
    return (
      fileType === 'text/html' ||
      fileType === 'application/pdf' ||
      fileType.startsWith('image/')
    )
  }

  const handleDownload = () => {
    if (previewUrl) {
      const link = document.createElement('a')
      link.href = previewUrl
      link.download = document.fileName || document.originalName || 'document'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {getDocumentTitle()}
            </h2>
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
              {document.uploadedAt && (
                <span>Uploaded: {new Date(document.uploadedAt).toLocaleDateString()}</span>
              )}
              {document.generatedAt && (
                <span>Generated: {new Date(document.generatedAt).toLocaleDateString()}</span>
              )}
              {document.fileSize && (
                <span>Size: {(document.fileSize / 1024).toFixed(1)} KB</span>
              )}
              {document.fileType && (
                <span>Type: {document.fileType}</span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={openInNewTab}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Open in New Tab
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Download
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-2">Loading preview...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Preview Error</h3>
              <p className="mt-1 text-sm text-gray-500">{error}</p>
              <button
                onClick={handleDownload}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Download Document Instead
              </button>
            </div>
          ) : !canPreviewInline() ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Preview Not Available</h3>
              <p className="mt-1 text-sm text-gray-500">
                This file type cannot be previewed inline. Click download to view the file.
              </p>
              <button
                onClick={handleDownload}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Download Document
              </button>
            </div>
          ) : (
            <div className="w-full h-full">
              {document.fileType?.startsWith('image/') ? (
                <div className="text-center">
                  <img
                    src={previewUrl}
                    alt={getDocumentTitle()}
                    className="max-w-full max-h-[60vh] mx-auto rounded-lg shadow"
                    onError={() => setError('Failed to load image')}
                  />
                </div>
              ) : (
                <iframe
                  src={previewUrl}
                  title={getDocumentTitle()}
                  className="w-full h-[60vh] border border-gray-300 rounded-lg"
                  onError={() => setError('Failed to load document preview')}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}