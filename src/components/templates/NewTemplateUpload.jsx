// src/components/templates/NewTemplateUpload.jsx
'use client'

import { useState, useRef } from 'react'
import PlaceholderMapper from './PlaceholderMapper'
import PlaceholderLibrary from './PlaceholderLibrary'

export default function NewTemplateUpload({ onUploadComplete, onCancel }) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    file: null
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Placeholder mapping states
  const [uploadStep, setUploadStep] = useState('upload') // 'upload', 'mapping', 'complete'
  const [validationResult, setValidationResult] = useState(null)
  const [detectedPlaceholders, setDetectedPlaceholders] = useState([])
  const [showPlaceholderLibrary, setShowPlaceholderLibrary] = useState(false)
  const [pendingTemplateData, setPendingTemplateData] = useState(null)
  
  const fileInputRef = useRef(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }

  const handleFileSelect = (file) => {
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword' // .doc
    ]
    
    if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.docx') && !file.name.toLowerCase().endsWith('.doc')) {
      setError('Please select a Word document (.doc or .docx)')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setError('')
    setSuccess('')
    setFormData(prev => ({
      ...prev,
      file,
      name: prev.name || file.name.replace(/\.[^/.]+$/, '')
    }))
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleInitialUpload = async (e) => {
    e.preventDefault()
    
    if (!formData.file) {
      setError('Please select a file to upload')
      return
    }

    if (!formData.name.trim()) {
      setError('Please enter a template name')
      return
    }

    setUploading(true)
    setError('')

    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', formData.file)
      uploadFormData.append('name', formData.name)
      uploadFormData.append('description', formData.description)

      const response = await fetch('/api/templates/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const result = await response.json()

      if (!response.ok) {
        // Handle validation errors with placeholder mapping
        if (result.blockUpload && result.validation) {
          console.log('Invalid placeholders detected, showing mapper:', result.validation)
          setValidationResult(result.validation)
          setDetectedPlaceholders(result.validation.invalidPlaceholders.map(p => p.name))
          setUploadStep('mapping')
          setError('')
          return
        }
        
        throw new Error(result.error || 'Upload failed')
      }

      if (result.success) {
        setSuccess('Template uploaded successfully!')
        setUploadStep('complete')
        
        // Complete upload after brief delay
        setTimeout(() => {
          onUploadComplete(result.template)
        }, 1500)
      }

    } catch (error) {
      console.error('Upload error:', error)
      setError(error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleMappingComplete = async (mappings) => {
    setUploading(true)
    setError('')

    try {
      // Retry upload with corrected mappings
      const uploadFormData = new FormData()
      uploadFormData.append('file', formData.file)
      uploadFormData.append('name', formData.name)
      uploadFormData.append('description', formData.description)
      uploadFormData.append('placeholderMappings', JSON.stringify(mappings))

      const response = await fetch('/api/templates/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed after mapping')
      }

      if (result.success) {
        setSuccess('Template uploaded successfully with field mappings!')
        setUploadStep('complete')
        
        // Complete upload after brief delay
        setTimeout(() => {
          onUploadComplete(result.template)
        }, 1500)
      }

    } catch (error) {
      console.error('Upload error after mapping:', error)
      setError(error.message)
      setUploadStep('upload') // Go back to upload step
    } finally {
      setUploading(false)
    }
  }

  const handleMappingCancel = () => {
    setUploadStep('upload')
    setValidationResult(null)
    setDetectedPlaceholders([])
    setError('Upload cancelled. Please fix placeholders in your document or map them to valid fields.')
  }

  const removeFile = () => {
    setFormData(prev => ({
      ...prev,
      file: null
    }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setUploadStep('upload')
    setValidationResult(null)
    setDetectedPlaceholders([])
  }

  const resetUpload = () => {
    setFormData({
      name: '',
      description: '',
      file: null
    })
    setUploadStep('upload')
    setValidationResult(null)
    setDetectedPlaceholders([])
    setError('')
    setSuccess('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Render different steps
  if (uploadStep === 'mapping') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Fix Template Placeholders
          </h3>
          <p className="text-sm text-gray-600">
            Your template "{formData.name}" contains placeholders that don't match our database fields. 
            Please map them to valid fields to continue.
          </p>
        </div>

        <PlaceholderMapper
          detectedPlaceholders={detectedPlaceholders}
          validationResult={validationResult}
          onMappingComplete={handleMappingComplete}
          onCancel={handleMappingCancel}
        />
      </div>
    )
  }

  if (uploadStep === 'complete') {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="mb-6">
          <svg className="mx-auto h-16 w-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Template Uploaded Successfully!
        </h3>
        <p className="text-gray-600 mb-4">
          "{formData.name}" is now ready for document generation.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-green-800 text-sm">
            {success}
          </p>
        </div>
      </div>
    )
  }

  // Default upload step
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white">
        {/* Help Section */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">How to create templates:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Create your document in Microsoft Word with perfect formatting</li>
                <li>Use placeholders like <code className="bg-blue-100 px-1 rounded">{`{first_name}`}</code>, <code className="bg-blue-100 px-1 rounded">{`{company}`}</code></li>
                <li>
                  <button 
                    onClick={() => setShowPlaceholderLibrary(true)}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Browse available placeholders
                  </button>
                </li>
                <li>Upload your DOCX file - original formatting will be preserved!</li>
              </ul>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleInitialUpload} className="space-y-6">
          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              DOCX Template File
            </label>
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 ${
                dragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : formData.file
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".doc,.docx"
                onChange={handleFileInputChange}
                className="hidden"
              />
              
              <div className="text-center">
                {formData.file ? (
                  <div className="space-y-3">
                    <svg className="mx-auto h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formData.file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(formData.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="inline-flex items-center px-3 py-1 border border-red-300 rounded text-sm text-red-700 bg-red-50 hover:bg-red-100"
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div>
                      <p className="text-sm text-gray-600">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="font-medium text-blue-600 hover:text-blue-500"
                        >
                          Click to upload
                        </button>{' '}
                        or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">Word documents (.doc, .docx) up to 10MB</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Template Information */}
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Trust Distribution Agreement"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Brief description of this template..."
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={resetUpload}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={uploading}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !formData.file || !formData.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                'Upload Template'
              )}
            </button>
          </div>
        </form>

        {/* Placeholder Library Modal */}
        <PlaceholderLibrary
          isOpen={showPlaceholderLibrary}
          onClose={() => setShowPlaceholderLibrary(false)}
          onSelectPlaceholder={(field) => {
            console.log('Selected placeholder:', field)
            // Could copy to clipboard or show usage example
          }}
        />
      </div>
    </div>
  )
}