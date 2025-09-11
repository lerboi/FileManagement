// src/components/templates/SimpleTemplateEditor.jsx
'use client'

import { useState, useEffect } from 'react'
import PlaceholderLibrary from './PlaceholderLibrary'

export default function SimpleTemplateEditor({ 
  template, 
  onSave, 
  onCancel,
  isModal = false
}) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    status: template?.status || 'active'
  })
  const [loading, setLoading] = useState(false)
  const [showPlaceholderLibrary, setShowPlaceholderLibrary] = useState(false)
  const [templateStats, setTemplateStats] = useState(null)

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        description: template.description || '',
        status: template.status || 'active'
      })
      calculateTemplateStats()
    }
  }, [template])

  const calculateTemplateStats = () => {
    if (!template) return

    const stats = {
      placeholders: template.detected_placeholders?.length || 0,
      validPlaceholders: template.detected_placeholders?.filter(p => p.field)?.length || 0,
      fileSize: 'Unknown',
      lastModified: template.updated_at || template.created_at,
      originalFile: template.original_filename || 'Unknown'
    }

    setTemplateStats(stats)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Template name is required')
      return
    }

    setLoading(true)
    
    try {
      const templateData = {
        ...template,
        name: formData.name.trim(),
        description: formData.description.trim(),
        status: formData.status,
        updated_at: new Date().toISOString()
      }

      await onSave(templateData)
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadOriginalFile = async () => {
    if (!template?.docx_file_path) {
      alert('Original file not available')
      return
    }

    try {
      const response = await fetch(`/api/templates/${template.id}/download`)
      if (!response.ok) throw new Error('Download failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = template.original_filename || `${template.name}.docx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading file:', error)
      alert('Failed to download file')
    }
  }

  const handleReplaceFile = () => {
    // TODO: Implement file replacement
    alert('File replacement will be implemented in the next update')
  }

  return (
    <div className={isModal ? "h-full flex flex-col bg-white" : "h-screen flex flex-col bg-white"}>
      {/* Header */}
      {!isModal && (
        <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Template Settings: {template?.name}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Configure template metadata and view placeholder information
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact header for modal mode */}
      {isModal && (
        <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Template Settings</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={onCancel}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Template Settings */}
            <div className="space-y-6">
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Template Information</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={3}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* File Management */}
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">File Management</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {template?.original_filename || 'Template File'}
                      </p>
                      <p className="text-xs text-gray-500">
                        DOCX template with original formatting
                      </p>
                    </div>
                    <button
                      onClick={downloadOriginalFile}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      Download
                    </button>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={handleReplaceFile}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Replace File
                    </button>
                    <button
                      onClick={() => setShowPlaceholderLibrary(true)}
                      className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                    >
                      View Available Placeholders
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Template Statistics & Placeholders */}
            <div className="space-y-6">
              {/* Template Statistics */}
              {templateStats && (
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Template Statistics</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Placeholders:</span>
                      <span className="text-sm font-medium">{templateStats.placeholders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Valid mappings:</span>
                      <span className="text-sm font-medium text-green-600">{templateStats.validPlaceholders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Original file:</span>
                      <span className="text-sm font-medium">{templateStats.originalFile}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Last modified:</span>
                      <span className="text-sm font-medium">
                        {new Date(templateStats.lastModified).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Detected Placeholders */}
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Detected Placeholders ({template?.detected_placeholders?.length || 0})
                </h3>
                
                {template?.detected_placeholders?.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {template.detected_placeholders.map((placeholder, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <div>
                          <code className="text-sm font-mono text-blue-600">
                            {`{${placeholder.name}}`}
                          </code>
                          {placeholder.field && (
                            <p className="text-xs text-gray-500 mt-1">
                              → {placeholder.field.label} ({placeholder.field.name})
                            </p>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs rounded ${
                          placeholder.field 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {placeholder.field ? 'mapped' : 'unmapped'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No placeholders detected in this template
                  </p>
                )}
              </div>

              {/* Template Usage */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">How to Use This Template</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Original DOCX formatting is preserved perfectly</li>
                  <li>• Generate documents with client data automatically</li>
                  <li>• All placeholders are validated against database fields</li>
                  <li>• Download generated documents as DOCX files</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder Library Modal */}
      <PlaceholderLibrary
        isOpen={showPlaceholderLibrary}
        onClose={() => setShowPlaceholderLibrary(false)}
        onSelectPlaceholder={(field) => {
          // Copy placeholder to clipboard
          navigator.clipboard.writeText(`{${field.name}}`).then(() => {
            alert(`Placeholder {${field.name}} copied to clipboard!`)
          })
        }}
      />
    </div>
  )
}