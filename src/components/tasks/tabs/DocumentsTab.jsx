// src/components/tasks/tabs/DocumentsTab.jsx
'use client'

export default function DocumentsTab({
  taskDetail,
  canGenerateDocuments,
  hasGeneratedDocuments,
  hasSuccessfulDocuments,
  hasFailedDocuments,
  regenerating,
  handleGenerateDocuments,
  handleRetryGeneration,
  formatDate
}) {
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Documents</h3>
        <div className="flex space-x-2">
          {/* Generate/Regenerate Button */}
          {canGenerateDocuments() && (
            <button
              onClick={hasGeneratedDocuments() ? handleRetryGeneration : handleGenerateDocuments}
              disabled={regenerating}
              className={`inline-flex items-center px-4 py-2 rounded-md text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                hasGeneratedDocuments() 
                  ? 'bg-orange-600 hover:bg-orange-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {regenerating ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                    hasGeneratedDocuments() 
                      ? "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      : "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  } />
                </svg>
              )}
              {regenerating ? 'Generating...' : hasGeneratedDocuments() ? 'Regenerate Documents' : 'Generate Documents'}
            </button>
          )}
          
          {hasSuccessfulDocuments() && (
            <button
              onClick={() => {
                // Download all documents by opening each in a new tab
                const generatedDocs = taskDetail.generated_documents?.filter(doc => doc.status === 'generated') || []
                generatedDocs.forEach((doc, index) => {
                  setTimeout(() => {
                    const downloadUrl = `/api/tasks/${taskDetail.id}/preview?templateId=${doc.templateId}`
                    window.open(downloadUrl, '_blank')
                  }, index * 500) // Stagger downloads
                })
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
              </svg>
              Download All
            </button>
          )}
        </div>
      </div>

      {/* Generation Error */}
      {taskDetail.generation_error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-red-800 flex-1">
              <p className="font-medium">Generation Error</p>
              <p className="text-sm">{taskDetail.generation_error}</p>
              <p className="text-sm mt-2 text-red-700">
                Click "Regenerate Documents" above to try again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Partial Generation Warning */}
      {hasFailedDocuments() && hasSuccessfulDocuments() && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-yellow-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-yellow-800">
              <p className="font-medium">Partial Generation</p>
              <p className="text-sm">Some documents generated successfully, but others failed. Consider regenerating all documents.</p>
            </div>
          </div>
        </div>
      )}

      {/* Generated Documents List */}
      <div className="space-y-4">
        {hasGeneratedDocuments() ? (
          <>
            {taskDetail.generated_documents.map((doc, index) => (
              <div key={index} className={`border rounded-lg p-4 ${
                doc.status === 'failed' ? 'border-red-200 bg-red-50' : 
                doc.status === 'generated' ? 'border-gray-200' : 
                'border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{doc.templateName}</h4>
                    <p className="text-xs text-gray-600">{doc.fileName}</p>
                    <div className="flex items-center mt-1">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                        doc.status === 'generated' ? 'bg-green-100 text-green-800' :
                        doc.status === 'failed' ? 'bg-red-100 text-red-800' :
                        doc.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {doc.status}
                      </span>
                      {doc.generatedAt && (
                        <span className="ml-2 text-xs text-gray-500">
                          • Generated: {formatDate(doc.generatedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  {doc.status === 'generated' && (
                    <div className="flex space-x-2">
                      <a
                        href={`/api/tasks/${taskDetail.id}/preview?templateId=${doc.templateId}`}
                        className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-md text-sm text-blue-700 bg-blue-50 hover:bg-blue-100"
                        download
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
                        </svg>
                        Download DOCX
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Generated on date - bottom right */}
            {taskDetail.status === 'awaiting' && taskDetail.generation_completed_at && !taskDetail.generation_error && (
              <div className="flex justify-end">
                <p className="text-xs text-gray-500 opacity-60">
                  Generated on {formatDate(taskDetail.generation_completed_at)}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Documents Generated</h3>
            <p className="mt-1 text-sm text-gray-500">
              {canGenerateDocuments() 
                ? 'Click "Generate Documents" above to create documents from templates.'
                : 'Documents will appear here once generated.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}