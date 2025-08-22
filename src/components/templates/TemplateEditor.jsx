// src/components/templates/TemplateEditor.js
'use client'

import { useState, useRef } from 'react'

export default function TemplateEditor({ 
  template, 
  onSave, 
  onCancel 
}) {
  const [htmlContent, setHtmlContent] = useState(template?.html_content || '')
  const [loading, setLoading] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [showFieldSelector, setShowFieldSelector] = useState(false)
  const [changes, setChanges] = useState([])
  const editorRef = useRef(null)

  const availableFields = [
    { name: 'first_name', label: 'First Name' },
    { name: 'last_name', label: 'Last Name' },
    { name: 'full_name', label: 'Full Name', computed: true },
    { name: 'email', label: 'Email' },
    { name: 'phone', label: 'Phone' },
    { name: 'address_line_1', label: 'Address Line 1' },
    { name: 'address_line_2', label: 'Address Line 2' },
    { name: 'city', label: 'City' },
    { name: 'state', label: 'State' },
    { name: 'postal_code', label: 'Postal Code' },
    { name: 'country', label: 'Country' },
    { name: 'date_of_birth', label: 'Date of Birth' },
    { name: 'occupation', label: 'Occupation' },
    { name: 'company', label: 'Company' },
    { name: 'current_date', label: 'Current Date', computed: true },
    { name: 'current_year', label: 'Current Year', computed: true }
  ]

  const handleAISuggestions = async () => {
    setAiProcessing(true)
    
    try {
      const response = await fetch('/api/ai/suggest-field-mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          htmlContent,
          templateId: template?.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get AI suggestions')
      }

      const result = await response.json()
      
      if (result.success) {
        setHtmlContent(result.enhancedHtml)
        setChanges(result.changes)
        alert(`Mistral AI added ${result.fieldCount} field placeholders. Review the changes in the preview.`)
      } else {
        throw new Error(result.error)
      }

    } catch (error) {
      console.error('Error getting Mistral AI suggestions:', error)
      alert('Failed to get Mistral AI suggestions: ' + error.message)
    } finally {
      setAiProcessing(false)
    }
  }

  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (selection.rangeCount > 0 && selection.toString().trim()) {
      setSelectedText(selection.toString().trim())
      setShowFieldSelector(true)
    }
  }

  const handleManualFieldMapping = (fieldName) => {
    if (!selectedText) return

    const placeholder = `<span class="field-placeholder">{{${fieldName}}}</span>`
    const newHtml = htmlContent.replace(
      new RegExp(escapeRegExp(selectedText), 'g'),
      placeholder
    )
    
    setHtmlContent(newHtml)
    setChanges(prev => [...prev, {
      field: fieldName,
      originalText: selectedText,
      placeholder
    }])
    
    setSelectedText('')
    setShowFieldSelector(false)
    
    // Clear selection
    window.getSelection().removeAllRanges()
  }

  const removeFieldMapping = (fieldName) => {
    const placeholderRegex = new RegExp(
      `<span class="field-placeholder">\\{\\{${escapeRegExp(fieldName)}\\}\\}</span>`,
      'g'
    )
    
    const newHtml = htmlContent.replace(placeholderRegex, `[${fieldName.toUpperCase()}]`)
    setHtmlContent(newHtml)
    
    // Remove from changes list
    setChanges(prev => prev.filter(change => change.field !== fieldName))
  }

  const handleSave = async () => {
    setLoading(true)
    
    try {
      const templateData = {
        ...template,
        html_content: htmlContent,
        field_mappings: changes.reduce((acc, change) => {
          acc[change.field] = change.placeholder
          return acc
        }, {}),
        status: 'active'
      }

      await onSave(templateData)
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getFieldCount = () => {
    const matches = htmlContent.match(/\{\{([^}]+)\}\}/g)
    return matches ? matches.length : 0
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Template Editor: {template?.name}
            </h2>
            <p className="text-sm text-gray-600">
              {getFieldCount()} field placeholders • {changes.length} changes made
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleAISuggestions}
              disabled={aiProcessing}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400"
            >
              {aiProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Mistral Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Mistral Auto-Map Fields
                </>
              )}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Document Preview */}
        <div className="flex-1 flex flex-col">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h3 className="text-sm font-medium text-gray-900">Document Preview</h3>
            <p className="text-xs text-gray-600">
              Select text and click "Map Field" to assign database fields
            </p>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div
              ref={editorRef}
              className="bg-white border rounded-lg p-6 shadow-sm min-h-full"
              style={{ 
                fontFamily: 'Times New Roman, serif',
                fontSize: '12pt',
                lineHeight: '1.5'
              }}
              onMouseUp={handleTextSelection}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        </div>

        {/* Right Panel - Field Mapping Controls */}
        <div className="w-80 bg-gray-50 border-l border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">Field Mapping</h3>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Selected Text */}
            {selectedText && (
              <div className="bg-white border rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Selected Text:</h4>
                <p className="text-sm text-gray-600 bg-yellow-50 p-2 rounded border">
                  "{selectedText}"
                </p>
                <button
                  onClick={() => setShowFieldSelector(!showFieldSelector)}
                  className="mt-2 w-full px-3 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                >
                  Map to Field
                </button>
              </div>
            )}

            {/* Field Selector */}
            {showFieldSelector && (
              <div className="bg-white border rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Choose Field:</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {availableFields.map((field) => (
                    <button
                      key={field.name}
                      onClick={() => handleManualFieldMapping(field.name)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded border"
                    >
                      <div className="font-medium">{field.label}</div>
                      {field.computed && (
                        <div className="text-xs text-gray-500">(computed)</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Current Mappings */}
            {changes.length > 0 && (
              <div className="bg-white border rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Current Mappings ({changes.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {changes.map((change, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900">
                          {change.field}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          "{change.originalText}"
                        </div>
                      </div>
                      <button
                        onClick={() => removeFieldMapping(change.field)}
                        className="ml-2 text-red-600 hover:text-red-800"
                        title="Remove mapping"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Fields Reference */}
            <div className="bg-white border rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Available Fields:</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {availableFields.map((field) => (
                  <div key={field.name} className="text-xs">
                    <span className="font-medium">{field.label}</span>
                    {field.computed && <span className="text-gray-500"> (computed)</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions Footer */}
      <div className="flex-shrink-0 bg-blue-50 border-t border-blue-200 px-6 py-3">
        <div className="flex items-center text-sm text-blue-800">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <strong>Instructions:</strong> Use "Mistral Auto-Map Fields" for automatic mapping, or manually select text in the document and click "Map to Field" to assign database fields. Yellow highlighted areas show mapped fields.
          </div>
        </div>
      </div>
    </div>
  )
}

// Utility function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\  const removeFieldMapping = (fieldName) =>')
}