'use client'
import { useState, useEffect } from 'react'

export default function TaskCompletionSection({
  taskDetail,
  onTaskUpdated,
  formatDate,
  showSuccessMessage,
  showErrorMessage,
  onClose
}) {
  const [signedStatus, setSignedStatus] = useState({})
  const [completionStatus, setCompletionStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    if (taskDetail?.id && taskDetail.status === 'awaiting') {
      fetchCompletionStatus()
    }
  }, [taskDetail?.id, taskDetail?.status])

  const fetchCompletionStatus = async () => {
    try {
      setLoading(true)
      
      // Fetch signed document status
      const signedResponse = await fetch(`/api/tasks/${taskDetail.id}/signed-status`)
      const signedData = await signedResponse.json()
      
      if (signedData.success) {
        setSignedStatus(signedData.signedStatus)
      }

      // Check completion eligibility
      const completionResponse = await fetch(`/api/tasks/${taskDetail.id}/complete`)
      const completionData = await completionResponse.json()
      
      if (completionData.success) {
        setCompletionStatus(completionData.completionCheck)
      }
    } catch (error) {
      console.error('Error fetching completion status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteTask = async () => {
    if (!completionStatus?.canComplete) return

    try {
      setCompleting(true)
      const response = await fetch(`/api/tasks/${taskDetail.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completionNotes: 'Task completed - all required documents uploaded and signed'
        })
      })

      const data = await response.json()

      if (data.success) {
        onTaskUpdated(data.task)
        showSuccessMessage('Task completed successfully!')
        
        // Close modal after completion
        setTimeout(() => {
          if (onClose) {
            onClose()
          }
        }, 1500)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      showErrorMessage(`Failed to complete task: ${error.message}`)
    } finally {
      setCompleting(false)
    }
  }

  // Don't show completion section if task is not in awaiting status
  if (taskDetail.status !== 'awaiting') {
    return null
  }

  const generatedDocs = taskDetail.generated_documents?.filter(doc => doc.status === 'generated') || []
  const additionalFiles = taskDetail.additional_files || []

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Complete Task</h3>
          <p className="text-sm text-gray-600 mt-1">
            Verify all required documents are uploaded before completing this task
          </p>
        </div>
        {!loading && (
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            completionStatus?.canComplete 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {completionStatus?.canComplete ? 'Ready to Complete' : 'Pending Documents'}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-600 mt-2">Checking completion status...</p>
        </div>
      ) : (
        <>
          {/* Required Signed Documents Checklist */}
          <div className="space-y-4 mb-6">
            <h4 className="text-sm font-medium text-gray-900">Required Signed Documents</h4>
            {generatedDocs.length > 0 ? (
              <div className="space-y-2">
                {generatedDocs.map((doc) => {
                  const signedDoc = signedStatus[doc.templateId]
                  const isUploaded = signedDoc?.exists

                  return (
                    <div key={doc.templateId} className={`flex items-center justify-between p-3 rounded-lg border ${
                      isUploaded ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                          isUploaded ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                          {isUploaded ? (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.templateName}</p>
                          <p className="text-xs text-gray-600">
                            {isUploaded ? (
                              <>Uploaded: {formatDate(signedDoc.uploadedAt)} • {signedDoc.fileName}</>
                            ) : (
                              'Not uploaded yet'
                            )}
                          </p>
                        </div>
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                        isUploaded 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {isUploaded ? 'Complete' : 'Required'}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No documents generated yet</p>
            )}
          </div>

          {/* Additional Documents */}
          {additionalFiles.length > 0 && (
            <div className="space-y-4 mb-6">
              <h4 className="text-sm font-medium text-gray-900">Additional Post-incorporation Documents</h4>
              <div className="space-y-2">
                {additionalFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.originalName}</p>
                        <p className="text-xs text-gray-600">
                          Uploaded: {formatDate(file.uploadedAt)} • {Math.round(file.fileSize / 1024)} KB
                        </p>
                        {file.description && (
                          <p className="text-xs text-gray-600 mt-1">Note: {file.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                      Additional
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation Error */}
          {completionStatus && !completionStatus.canComplete && completionStatus.validationError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <svg className="w-5 h-5 text-yellow-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-yellow-800">
                  <p className="font-medium">Cannot Complete Task</p>
                  <p className="text-sm mt-1">{completionStatus.validationError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Complete Task Button */}
          <div className="flex justify-end">
            <button
              onClick={handleCompleteTask}
              disabled={!completionStatus?.canComplete || completing}
              className={`inline-flex items-center px-6 py-3 rounded-md font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                completionStatus?.canComplete 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-400'
              }`}
            >
              {completing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Completing Task...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Complete Task
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}