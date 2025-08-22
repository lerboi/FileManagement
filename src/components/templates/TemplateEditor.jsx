// src/components/templates/TemplateEditor.js
'use client'

import { useState, useRef, useEffect } from 'react'

export default function TemplateEditor({ 
  template, 
  onSave, 
  onCancel 
}) {
  const [htmlContent, setHtmlContent] = useState(template?.html_content || '')
  const [loading, setLoading] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [clickPosition, setClickPosition] = useState(null)
  const [selectionMode, setSelectionMode] = useState('highlight') // 'highlight' or 'click'
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

  // Add styles for field placeholders and click indicators
  useEffect(() => {
    const styleElement = document.createElement('style')
    styleElement.textContent = `
      .field-placeholder {
        background-color: #fef3c7 !important;
        border: 1px solid #f59e0b !important;
        padding: 2px 4px !important;
        border-radius: 3px !important;
        font-weight: bold !important;
        color: #92400e !important;
        display: inline !important;
        cursor: pointer !important;
      }
      
      .field-placeholder:hover {
        background-color: #fde68a !important;
        border-color: #d97706 !important;
      }
      
      .click-indicator {
        position: absolute;
        width: 2px;
        height: 20px;
        background-color: #3b82f6;
        animation: blink 1s infinite;
        pointer-events: none;
        z-index: 1000;
      }
      
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
      
      .selection-highlight {
        background-color: #dbeafe !important;
        border: 1px dashed #3b82f6 !important;
      }
      
      .editor-content {
        position: relative;
      }
      
      .editor-content.click-mode {
        cursor: text !important;
      }
      
      .editor-content.click-mode * {
        cursor: text !important;
      }
    `
    document.head.appendChild(styleElement)
    
    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  // Update the HTML content in the editor when htmlContent changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== htmlContent) {
      // Only update if the content is actually different
      console.log('Updating editor content')
      editorRef.current.innerHTML = htmlContent
    }
  }, [htmlContent])

  // Sync HTML content with DOM changes
  const syncHtmlContent = () => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML
      if (newContent !== htmlContent) {
        console.log('Syncing HTML content from DOM')
        setHtmlContent(newContent)
      }
    }
  }

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
    if (selectionMode !== 'highlight') return

    const selection = window.getSelection()
    if (selection.rangeCount > 0 && selection.toString().trim()) {
      setSelectedText(selection.toString().trim())
      setClickPosition(null)
      setShowFieldSelector(true)
    }
  }

  const handleClick = (e) => {
    if (selectionMode !== 'click') return

    // Don't interfere with placeholder clicks
    if (e.target.classList.contains('field-placeholder')) {
      return
    }

    e.preventDefault()
    e.stopPropagation()

    // Clear any existing selection
    window.getSelection().removeAllRanges()
    setSelectedText('')

    // Get the click position and create a range
    let range
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(e.clientX, e.clientY)
    } else if (document.caretPositionFromPoint) {
      const caretPos = document.caretPositionFromPoint(e.clientX, e.clientY)
      range = document.createRange()
      range.setStart(caretPos.offsetNode, caretPos.offset)
      range.collapse(true)
    }

    if (range) {
      // Store the range for field insertion
      setClickPosition({
        range: range.cloneRange(),
        textNode: range.startContainer,
        offset: range.startOffset
      })
      setShowFieldSelector(true)

      // Set the cursor position visually
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  const handleFieldMapping = (fieldName) => {
    if (selectionMode === 'highlight' && selectedText) {
      handleHighlightFieldMapping(fieldName)
    } else if (selectionMode === 'click' && clickPosition) {
      handleClickFieldMapping(fieldName)
    }
  }

  const handleHighlightFieldMapping = (fieldName) => {
    if (!selectedText) return

    const selection = window.getSelection()
    if (selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    
    // Store the current selection details before we modify anything
    const startContainer = range.startContainer
    const startOffset = range.startOffset
    const endContainer = range.endContainer
    const endOffset = range.endOffset
    
    console.log('Highlight mapping:', {
      selectedText,
      fieldName,
      startContainer: startContainer.nodeType === Node.TEXT_NODE ? startContainer.textContent : startContainer.tagName,
      startOffset,
      endContainer: endContainer.nodeType === Node.TEXT_NODE ? endContainer.textContent : endContainer.tagName,
      endOffset
    })
    
    const placeholder = `<span class="field-placeholder" data-field="${fieldName}" title="Field: ${fieldName}">{{${fieldName}}}</span>`
    
    try {
      // Create the placeholder element
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = placeholder
      const placeholderNode = tempDiv.firstChild

      // Replace the selected content with the placeholder
      range.deleteContents()
      range.insertNode(placeholderNode)
      
      // Clear the selection
      selection.removeAllRanges()
      
      // Update our state
      setChanges(prev => [...prev, {
        field: fieldName,
        originalText: selectedText,
        placeholder,
        type: 'highlight'
      }])
      
      console.log('Highlight mapping completed successfully')
      
    } catch (error) {
      console.error('Error replacing selected text:', error)
    }
    
    setSelectedText('')
    setShowFieldSelector(false)
  }

  const handleClickFieldMapping = (fieldName) => {
    if (!clickPosition || !clickPosition.range) return

    const placeholder = `<span class="field-placeholder" data-field="${fieldName}" title="Field: ${fieldName}">{{${fieldName}}}</span>`
    
    console.log('Click mapping:', {
      fieldName,
      hasRange: !!clickPosition.range,
      textNode: clickPosition.textNode,
      offset: clickPosition.offset
    })
    
    try {
      // Get the current selection/cursor position
      const selection = window.getSelection()
      let range
      
      if (selection.rangeCount > 0) {
        range = selection.getRangeAt(0)
      } else {
        range = clickPosition.range
      }
      
      console.log('Using range:', {
        startContainer: range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.textContent : range.startContainer.tagName,
        startOffset: range.startOffset,
        collapsed: range.collapsed
      })
      
      // Create the placeholder element
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = placeholder
      const placeholderNode = tempDiv.firstChild

      // Ensure the range is collapsed (cursor position, not selection)
      range.collapse(true)
      
      // Insert the placeholder at the cursor position
      range.insertNode(placeholderNode)
      
      // Move the cursor after the inserted placeholder
      range.setStartAfter(placeholderNode)
      range.collapse(true)
      
      // Update the selection
      selection.removeAllRanges()
      selection.addRange(range)
      
      setChanges(prev => [...prev, {
        field: fieldName,
        originalText: `[Inserted at cursor position]`,
        placeholder,
        type: 'click'
      }])

      console.log('Click mapping completed successfully')

    } catch (error) {
      console.error('Error inserting field at click position:', error)
      
      // Fallback: try to insert at the end of the clicked element
      try {
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = placeholder
        const placeholderNode = tempDiv.firstChild
        
        if (clickPosition.textNode && clickPosition.textNode.parentNode) {
          clickPosition.textNode.parentNode.appendChild(placeholderNode)
        } else {
          editorRef.current.appendChild(placeholderNode)
        }
        
        console.log('Used fallback insertion method')
      } catch (fallbackError) {
        console.error('Fallback insertion also failed:', fallbackError)
      }
    }
    
    setClickPosition(null)
    setShowFieldSelector(false)
  }

  const removeFieldMapping = (fieldName) => {
    console.log('Removing field mapping for:', fieldName)
    
    // Find all placeholders with this field name
    const placeholders = editorRef.current.querySelectorAll(`[data-field="${fieldName}"]`)
    console.log('Found placeholders to remove:', placeholders.length)
    
    placeholders.forEach((placeholder, index) => {
      console.log(`Removing placeholder ${index + 1}:`, placeholder.outerHTML)
      
      // Simply remove the placeholder element entirely
      if (placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder)
      }
    })
    
    // Remove from changes list
    setChanges(prev => {
      const newChanges = prev.filter(change => change.field !== fieldName)
      console.log('Updated changes list:', newChanges.length, 'items')
      return newChanges
    })
    
    console.log('Field mapping removal completed')
  }

  const handleSave = async () => {
    setLoading(true)
    
    try {
      // Get the latest HTML from the editor
      const currentHtml = editorRef.current.innerHTML
      
      const templateData = {
        ...template,
        html_content: currentHtml,
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

  const toggleSelectionMode = () => {
    setSelectionMode(prev => prev === 'highlight' ? 'click' : 'highlight')
    setSelectedText('')
    setClickPosition(null)
    setShowFieldSelector(false)
  }

  const handlePlaceholderClick = (e, fieldName) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (confirm(`Remove field mapping for "${fieldName}"?`)) {
      removeFieldMapping(fieldName)
    }
  }

  // Add event listeners for placeholder clicks and content changes
  useEffect(() => {
    const handlePlaceholderClicks = (e) => {
      const target = e.target
      if (target.classList.contains('field-placeholder')) {
        const fieldName = target.getAttribute('data-field')
        if (fieldName) {
          handlePlaceholderClick(e, fieldName)
        }
      }
    }

    const handleInput = () => {
      // Sync content after any input changes
      setTimeout(syncHtmlContent, 0)
    }

    if (editorRef.current) {
      editorRef.current.addEventListener('click', handlePlaceholderClicks)
      editorRef.current.addEventListener('input', handleInput)
      
      return () => {
        if (editorRef.current) {
          editorRef.current.removeEventListener('click', handlePlaceholderClicks)
          editorRef.current.removeEventListener('input', handleInput)
        }
      }
    }
  }, [])

  // Trigger sync after field operations
  useEffect(() => {
    syncHtmlContent()
  }, [changes])

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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Document Preview</h3>
                <p className="text-xs text-gray-600">
                  {selectionMode === 'highlight' 
                    ? 'Select text and map to fields' 
                    : 'Click to position cursor and insert field placeholders'
                  }
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleSelectionMode}
                  className={`px-3 py-1 text-xs rounded border ${
                    selectionMode === 'highlight'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-green-50 text-green-700 border-green-200'
                  }`}
                >
                  {selectionMode === 'highlight' ? 'Highlight Mode' : 'Click Mode'}
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div
              ref={editorRef}
              className={`editor-content bg-white border rounded-lg p-6 shadow-sm min-h-full ${
                selectionMode === 'click' ? 'click-mode' : ''
              }`}
              style={{ 
                fontFamily: 'Times New Roman, serif',
                fontSize: '12pt',
                lineHeight: '1.5'
              }}
              contentEditable={selectionMode === 'click'}
              onMouseUp={handleTextSelection}
              onClick={handleClick}
              suppressContentEditableWarning={true}
            />
            
            {/* Click indicator */}
            {clickPosition && selectionMode === 'click' && (
              <div
                className="click-indicator"
                style={{
                  position: 'fixed',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 1001,
                  pointerEvents: 'none'
                }}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Field Mapping Controls */}
        <div className="w-80 bg-gray-50 border-l border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">Field Mapping</h3>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Mode Instructions */}
            <div className="bg-white border rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Current Mode:</h4>
              {selectionMode === 'highlight' ? (
                <div className="text-xs text-gray-600">
                  <p className="font-medium text-blue-600">Highlight Mode</p>
                  <p>• Select text by dragging</p>
                  <p>• Choose a field to replace the text</p>
                  <p>• Great for replacing existing content</p>
                </div>
              ) : (
                <div className="text-xs text-gray-600">
                  <p className="font-medium text-green-600">Click Mode</p>
                  <p>• Click anywhere to place cursor</p>
                  <p>• Choose a field to insert at that position</p>
                  <p>• Great for adding new fields</p>
                </div>
              )}
            </div>

            {/* Selected Text or Click Position */}
            {(selectedText || clickPosition) && (
              <div className="bg-white border rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  {selectedText ? 'Selected Text:' : 'Insert Position:'}
                </h4>
                {selectedText ? (
                  <p className="text-sm text-gray-600 bg-yellow-50 p-2 rounded border">
                    "{selectedText}"
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 bg-blue-50 p-2 rounded border">
                    Ready to insert field at cursor position
                  </p>
                )}
                <button
                  onClick={() => setShowFieldSelector(!showFieldSelector)}
                  className="mt-2 w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  {selectedText ? 'Replace with Field' : 'Insert Field'}
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
                      onClick={() => handleFieldMapping(field.name)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded border"
                    >
                      <div className="font-medium">{field.label}</div>
                      {field.computed && (
                        <div className="text-xs text-gray-500">(computed)</div>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowFieldSelector(false)}
                  className="mt-2 w-full px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
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
                        <div className="text-xs font-medium text-gray-900 flex items-center">
                          {change.field}
                          <span className={`ml-2 px-1 py-0.5 text-xs rounded ${
                            change.type === 'click' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {change.type || 'highlight'}
                          </span>
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
            <strong>Instructions:</strong> Use the mode toggle to switch between highlighting text (replace mode) and clicking positions (insert mode). 
            Yellow highlighted fields show mapped content. Click on any yellow field to remove it.
          </div>
        </div>
      </div>
    </div>
  )
}

// Utility function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}