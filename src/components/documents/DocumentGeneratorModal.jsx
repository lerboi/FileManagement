// src/components/documents/DocumentGeneratorModal.js
'use client'

import { useState, useEffect } from 'react'

export default function DocumentGeneratorModal({ 
  isOpen, 
  onClose, 
  template 
}) {
  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [generatedDocument, setGeneratedDocument] = useState(null)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchClients()
    }
  }, [isOpen])

  const fetchClients = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/clients?limit=100')
      if (!response.ok) {
        throw new Error('Failed to fetch clients')
      }
      const data = await response.json()
      setClients(data.clients || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
      alert('Failed to load clients: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedClientId) {
      alert('Please select a client')
      return
    }

    setGenerating(true)
    try {
      const response = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: template.id,
          clientId: selectedClientId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate document')
      }

      const result = await response.json()
      setGeneratedDocument(result)
      setShowPreview(true)

    } catch (error) {
      console.error('Error generating document:', error)
      alert('Failed to generate document: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!generatedDocument) return

    // Create a complete HTML document
    const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${template.name} - ${generatedDocument.document.client_name}</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.5;
            margin: 1in;
            color: #000;
        }
        h1, h2, h3, h4, h5, h6 {
            font-weight: bold;
            margin-top: 12pt;
            margin-bottom: 6pt;
        }
        h1 { font-size: 16pt; }
        h2 { font-size: 14pt; }
        h3 { font-size: 12pt; }
        p {
            margin-top: 0pt;
            margin-bottom: 6pt;
            text-align: justify;
        }
        strong { font-weight: bold; }
        em { font-style: italic; }
        u { text-decoration: underline; }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 6pt 0;
        }
        th, td {
            border: 1px solid #000;
            padding: 6pt;
            text-align: left;
        }
        th {
            background-color: #f0f0f0;
            font-weight: bold;
        }
        @media print {
            body { margin: 0; }
        }
    </style>
</head>
<body>
    ${generatedDocument.generatedHtml}
</body>
</html>`

    // Create blob and download
    const blob = new Blob([fullHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${template.name} - ${generatedDocument.document.client_name}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const filteredClients = clients.filter(client => 
    `${client.first_name} ${client.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedClient = clients.find(c => c.id === selectedClientId)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Generate Document: {template?.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {!showPreview ? (
            <div className="space-y-6">
              {/* Template Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="font-medium text-blue-900 mb-2">Template Information</h3>
                <div className="text-sm text-blue-800 space-y-1">
                  <p><strong>Name:</strong> {template.name}</p>
                  <p><strong>Type:</strong> {template.template_type}</p>
                  {template.description && <p><strong>Description:</strong> {template.description}</p>}
                  <p><strong>Fields:</strong> {Object.keys(template.field_mappings || {}).length} mapped fields</p>
                </div>
              </div>

              {/* Client Selection */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Select Client</h3>
                
                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search clients by name, email, or company..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Client List */}
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Loading clients...</span>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-md max-h-96 overflow-y-auto">
                    {filteredClients.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        {searchTerm ? 'No clients match your search.' : 'No clients found.'}
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {filteredClients.map((client) => (
                          <label
                            key={client.id}
                            className={`flex items-center p-4 hover:bg-gray-50 cursor-pointer ${
                              selectedClientId === client.id ? 'bg-blue-50 border-blue-200' : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="selectedClient"
                              value={client.id}
                              checked={selectedClientId === client.id}
                              onChange={(e) => setSelectedClientId(e.target.value)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <div className="ml-3 flex-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {client.first_name} {client.last_name}
                                  </p>
                                  <p className="text-sm text-gray-500">{client.email}</p>
                                </div>
                                <div className="text-right">
                                  {client.company && (
                                    <p className="text-sm text-gray-500">{client.company}</p>
                                  )}
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    client.status === 'active' ? 'bg-green-100 text-green-800' :
                                    client.status === 'inactive' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {client.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Client Info */}
              {selectedClient && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <h4 className="font-medium text-green-900 mb-2">Selected Client</h4>
                  <div className="text-sm text-green-800 grid grid-cols-2 gap-2">
                    <p><strong>Name:</strong> {selectedClient.first_name} {selectedClient.last_name}</p>
                    <p><strong>Email:</strong> {selectedClient.email || 'Not provided'}</p>
                    <p><strong>Phone:</strong> {selectedClient.phone || 'Not provided'}</p>
                    <p><strong>Company:</strong> {selectedClient.company || 'Not provided'}</p>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={generating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!selectedClientId || generating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                >
                  {generating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Generate Document
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Document Preview */
            <div className="space-y-6">
              {/* Success Message */}
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-green-800">
                    <p className="font-medium">Document Generated Successfully!</p>
                    <p>The document has been generated for {generatedDocument?.document.client_name}.</p>
                  </div>
                </div>
              </div>

              {/* Document Preview */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Document Preview</h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowPreview(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download HTML
                    </button>
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-md p-6 bg-white max-h-96 overflow-y-auto">
                  <div 
                    style={{ 
                      fontFamily: 'Times New Roman, serif',
                      fontSize: '12pt',
                      lineHeight: '1.5'
                    }}
                    dangerouslySetInnerHTML={{ __html: generatedDocument?.generatedHtml }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}