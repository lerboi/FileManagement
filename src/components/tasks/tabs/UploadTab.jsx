// src/components/tasks/tabs/UploadTab.jsx
'use client'

export default function UploadTab({
  taskDetail,
  hasGeneratedDocuments,
  handleDownloadDocument,
  handleUploadSignedDocument,
  handleUploadAdditionalDocuments,
  handleDeleteAdditionalFile,
  formatDate,
  setError,
  showSuccessMessage,
  showErrorMessage,
  onTaskUpdated
}) {
  
  const handleUploadSignedDocumentWrapper = async (templateId, templateName) => {
    console.log('Starting upload for:', { templateId, templateName })
    
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.doc,.docx'
    input.multiple = false
    
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return

      console.log('File selected:', file.name, file.size)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('templateId', templateId)
      formData.append('templateName', templateName)
      
      try {
        setError('')
        console.log('Uploading to:', `/api/tasks/${taskDetail.id}/upload-signed`)
        
        const response = await fetch(`/api/tasks/${taskDetail.id}/upload-signed`, {
          method: 'POST',
          body: formData
        })

        const data = await response.json()
        console.log('Upload response:', data)

        if (data.success) {
          console.log('Upload successful, updating task:', data.task)
          // Update the task detail immediately to reflect the new upload
          onTaskUpdated(data.task)
          showSuccessMessage(`Signed version of "${templateName}" uploaded successfully`)
        } else {
          throw new Error(data.error)
        }
      } catch (error) {
        console.error('Upload error:', error)
        setError(error.message)
        showErrorMessage(`Failed to upload signed document: ${error.message}`)
      }
    }
    
    input.click()
  }

  const handleReplaceSignedDocument = async (templateId, templateName) => {
    const confirmed = window.confirm(
      `Are you sure you want to replace the signed version of "${templateName}"? This will permanently delete the current signed document.`
    )
    
    if (!confirmed) return

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
      formData.append('replace', 'true') // Flag to indicate replacement
      
      try {
        setError('')
        const response = await fetch(`/api/tasks/${taskDetail.id}/upload-signed`, {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (data.success) {
          onTaskUpdated(data.task)
          showSuccessMessage(`Signed version of "${templateName}" replaced successfully`)
        } else {
          throw new Error(data.error)
        }
      } catch (error) {
        setError(error.message)
        showErrorMessage(`Failed to replace signed document: ${error.message}`)
      }
    }
    
    input.click()
  }

  const handleUploadAdditionalDocumentsWrapper = async () => {
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

  const handleDeleteAdditionalFileWrapper = async (filePath) => {
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

  // Debug logging to see actual data structure
  console.log('TaskDetail in UploadTab:', {
    generated_documents: taskDetail.generated_documents,
    signed_documents: taskDetail.signed_documents
  })

  return (
    <div className="space-y-6">
      {/* Generated Documents Upload Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Generated Documents</h3>
          <span className="text-sm text-gray-600">
            Upload signed versions of generated documents
          </span>
        </div>

        {hasGeneratedDocuments() ? (
          <div className="space-y-3">
            {taskDetail.generated_documents
              .filter(doc => doc.status === 'generated')
              .map((doc, index) => {
                // Try multiple methods to find matching signed document
                let signedDoc = null
                
                if (taskDetail.signed_documents && taskDetail.signed_documents.length > 0) {
                  // Method 1: Match by templateId
                  signedDoc = taskDetail.signed_documents.find(signed => signed.templateId === doc.templateId)
                  
                  // Method 2: Match by template name (fallback)
                  if (!signedDoc) {
                    signedDoc = taskDetail.signed_documents.find(signed => 
                      signed.templateName === doc.templateName || 
                      signed.originalName?.includes(doc.templateName) ||
                      signed.fileName?.includes(doc.templateName)
                    )
                  }
                  
                  // Method 3: Match by filename similarity (fallback)
                  if (!signedDoc) {
                    signedDoc = taskDetail.signed_documents.find(signed => 
                      signed.originalName?.toLowerCase().includes(doc.fileName?.toLowerCase()) ||
                      doc.fileName?.toLowerCase().includes(signed.originalName?.toLowerCase())
                    )
                  }
                }
                
                const isUploaded = !!signedDoc
                
                // Debug log for each document
                console.log(`Document ${doc.templateName}:`, {
                  templateId: doc.templateId,
                  signedDoc,
                  isUploaded,
                  allSignedDocs: taskDetail.signed_documents
                })
                
                return (
                  <div key={index} className={`border rounded-lg p-4 ${
                    isUploaded ? 'border-green-200 bg-green-50' : 'border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-sm font-medium text-gray-900">{doc.templateName}</h4>
                          {isUploaded ? (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              Uploaded
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                              Needs Upload
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Generated: {formatDate(doc.generatedAt)}
                        </p>
                        {isUploaded && (
                          <div className="text-xs text-gray-600 space-y-1">
                            <p>Signed version uploaded: {signedDoc.uploadedAt ? formatDate(signedDoc.uploadedAt) : formatDate(signedDoc.created_at)}</p>
                            {signedDoc.originalName && (
                              <p>File: {signedDoc.originalName} {signedDoc.fileSize && `(${Math.round(signedDoc.fileSize / 1024)} KB)`}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleDownloadDocument(doc.templateId, 'preview')}
                          className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-md text-sm text-blue-700 bg-blue-50 hover:bg-blue-100"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 616 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Preview
                        </button>
                        {isUploaded ? (
                          <div className="flex space-x-2">
                            <a
                              href={signedDoc.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-2 border border-green-300 rounded-md text-sm text-green-700 bg-green-50 hover:bg-green-100"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              View Signed
                            </a>
                            <button
                              onClick={() => handleReplaceSignedDocument(doc.templateId, doc.templateName)}
                              className="inline-flex items-center px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Replace
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleUploadSignedDocumentWrapper(doc.templateId, doc.templateName)}
                            className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Upload Signed
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Documents Generated</h3>
            <p className="mt-1 text-sm text-gray-500">
              Generate documents first to upload signed versions.
            </p>
          </div>
        )}
      </div>

      {/* Additional Documents Section */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Additional Post-incorporation Services</h3>
            <p className="text-sm text-gray-600 mt-1">Upload any additional documents related to this task</p>
          </div>
          <button
            onClick={handleUploadAdditionalDocumentsWrapper}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Additional Files
          </button>
        </div>

        {/* Additional Documents List */}
        <div className="space-y-3">
          {taskDetail.additional_files && taskDetail.additional_files.length > 0 ? (
            taskDetail.additional_files.map((doc, index) => (
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
                    {doc.description && (
                      <p className="text-xs text-gray-600 mt-1">
                        Note: {doc.description}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
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
                    <button
                      onClick={() => handleDeleteAdditionalFileWrapper(doc.storagePath)}
                      className="inline-flex items-center px-2 py-2 text-red-600 hover:bg-red-50 rounded-md"
                      title="Delete file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
              <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">No additional documents uploaded</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}