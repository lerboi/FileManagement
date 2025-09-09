// src/components/clients/DocumentUploadModal.jsx
'use client'

import { useState, useRef } from 'react'

export default function DocumentUploadModal({ isOpen, onClose, clientId, onUploadSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [description, setDescription] = useState('')
  const fileInputRef = useRef(null)

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files)
    if (files.length === 0) return

    setUploading(true)
    setUploadError('')

    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('files', file)
      })
      if (description.trim()) {
        formData.append('description', description.trim())
      }

      const response = await fetch(`/api/clients/${clientId}/documents`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload documents')
      }

      // Reset form
      setDescription('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Notify parent of successful upload
      if (onUploadSuccess) {
        onUploadSuccess()
      }

      // Show success message and close modal
      alert(`Successfully uploaded ${result.uploadedFiles} document(s)`)
      onClose()

    } catch (error) {
      setUploadError(error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    if (!uploading) {
      setDescription('')
      setUploadError('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Upload Documents</h2>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the documents..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={uploading}
              />
            </div>

            <div>
              <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-1">
                Select Files
              </label>
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                multiple
                onChange={handleFileUpload}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={uploading}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
              />
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT (max 25MB each, 10 files max)
              </p>
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {uploadError}
              </div>
            )}

            {uploading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-3"></div>
                <span className="text-indigo-600">Uploading documents...</span>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Upload Instructions</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• You can upload multiple files at once</li>
              <li>• Files will be stored securely and accessible only to authorized users</li>
              <li>• Adding a description helps identify the purpose of the documents</li>
              <li>• Upload will start automatically when you select files</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 flex justify-end">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}