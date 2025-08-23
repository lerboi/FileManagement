// src/components/templates/TemplateEditor.js (Unified Interaction Mode)
'use client'

import { useState, useRef, useEffect } from 'react'
import DynamicFieldSelector from './DynamicFieldSelector'

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
  const [showFieldSelector, setShowFieldSelector] = useState(false)
  const [interactionMode, setInteractionMode] = useState(null) // 'highlight' or 'click' - auto-detected
  const [changes, setChanges] = useState([])
  const [fieldValidation, setFieldValidation] = useState(null)
  const [availableFields, setAvailableFields] = useState([])
  const editorRef = useRef(null)

  useEffect(() => {
    fetchAvailableFields()
    if (template?.field_mappings) {
      validateCurrentMappings()
    }
  }, [template])

  const fetchAvailableFields = async () => {
    try {
      const response = await fetch('/api/fields/schema')
      if (response.ok) {
        const data = await response.json()
        setAvailableFields(data.fields || [])
      }
    } catch (error) {
      console.error('Error fetching fields:', error)
    }
  }

  const validateCurrentMappings = async () => {
    try {
      const response = await fetch('/api/fields/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldMappings: template.field_mappings || {} })
      })
      
      if (response.ok) {
        const data = await response.json()
        setFieldValidation(data.validation)
      }
    } catch (error) {
      console.error('Error validating field mappings:', error)
    }
  }

  // Add styles for field placeholders and validation warnings
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
      
      .field-placeholder.invalid {
        background-color: #fee2e2 !important;
        border-color: #dc2626 !important;
        color: #dc2626 !important;
      }
      
      .field-placeholder:hover {
        background-color: #fde68a !important;
        border-color: #d97706 !important;
      }
      
      .field-placeholder.invalid:hover {
        background-color: #fecaca !important;
        border-color: #b91c1c !important;
      }
      
      .editor-content {
        position: relative;
        cursor: text;
      }
      
      .editor-content * {
        cursor: text;
      }
      
      .validation-warning {
        background-color: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 4px;
        padding: 8px;
        margin: 4px 0;
      }
      
      .validation-error {
        background-color: #fee2e2;
        border: 1px solid #dc2626;
        border-radius: 4px;
        padding: 8px;
        margin: 4px 0;
      }

      .field-selector-overlay {
        position: absolute;
        z-index: 1000;
        min-width: 320px;
        max-width: 400px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        border: 1px solid #e5e7eb;
      }
    `
    document.head.appendChild(styleElement)
    
    return () => {
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement)
      }
    }
  }, [])

  // Update the HTML content in the editor when htmlContent changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== htmlContent) {
      console.log('Updating editor content')
      editorRef.current.innerHTML = htmlContent
      highlightInvalidFields()
    }
  }, [htmlContent, fieldValidation])

  // Highlight invalid field placeholders
  const highlightInvalidFields = () => {
    if (!fieldValidation || !editorRef.current) return

    const placeholders = editorRef.current.querySelectorAll('.field-placeholder')
    placeholders.forEach(placeholder => {
      const fieldName = placeholder.getAttribute('data-field')
      const isInvalid = fieldValidation.invalidMappings.some(im => im.fieldName === fieldName)
      
      if (isInvalid) {
        placeholder.classList.add('invalid')
        placeholder.title = `Invalid field: ${fieldName} no longer exists in schema`
      } else {
        placeholder.classList.remove('invalid')
        placeholder.title = `Field: ${fieldName}`
      }
    })
  }

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
        
        // Re-validate mappings after AI enhancement
        await validateCurrentMappings()
        
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

  // Unified interaction handler that detects user intent
  const handleEditorInteraction = (e) => {
    // Don't interfere with placeholder clicks
    if (e.target.classList.contains('field-placeholder')) {
      return
    }

    // Check if user made a text selection
    const selection = window.getSelection()
    const hasTextSelection = selection.rangeCount > 0 && selection.toString().trim().length > 0

    if (hasTextSelection) {
      // User highlighted text - use highlight mode
      setInteractionMode('highlight')
      setSelectedText(selection.toString().trim())
      setClickPosition(null)
      setShowFieldSelector(true)
    } else if (e.type === 'click') {
      // User clicked without selection - use click mode
      setInteractionMode('click')
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
        setClickPosition({
          range: range.cloneRange(),
          textNode: range.startContainer,
          offset: range.startOffset,
          x: e.clientX,
          y: e.clientY
        })
        setShowFieldSelector(true)

        // Set the cursor position visually
        const newSelection = window.getSelection()
        newSelection.removeAllRanges()
        newSelection.addRange(range)
      }
    }
  }

  const handleFieldMapping = (fieldName) => {
    if (interactionMode === 'highlight' && selectedText) {
      handleHighlightFieldMapping(fieldName)
    } else if (interactionMode === 'click' && clickPosition) {
      handleClickFieldMapping(fieldName)
    }
  }

  const handleHighlightFieldMapping = (fieldName) => {
    if (!selectedText) return

    const selection = window.getSelection()
    if (selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const placeholder = `<span class="field-placeholder" data-field="${fieldName}" title="Field: ${fieldName}">{{${fieldName}}}</span>`
    
    try {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = placeholder
      const placeholderNode = tempDiv.firstChild

      range.deleteContents()
      range.insertNode(placeholderNode)
      
      selection.removeAllRanges()
      
      // Store the change for tracking purposes (field name only)
      setChanges(prev => [...prev, {
        field: fieldName,
        originalText: selectedText,
        placeholder: `{{${fieldName}}}`, // Store simple placeholder, not HTML
        type: 'highlight'
      }])
      
    } catch (error) {
      console.error('Error replacing selected text:', error)
    }
    
    closeFieldSelector()
  }

  const handleClickFieldMapping = (fieldName) => {
    if (!clickPosition || !clickPosition.range) return

    const placeholder = `<span class="field-placeholder" data-field="${fieldName}" title="Field: ${fieldName}">{{${fieldName}}}</span>`
    
    try {
      const selection = window.getSelection()
      let range = selection.rangeCount > 0 ? selection.getRangeAt(0) : clickPosition.range
      
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = placeholder
      const placeholderNode = tempDiv.firstChild

      range.collapse(true)
      range.insertNode(placeholderNode)
      
      range.setStartAfter(placeholderNode)
      range.collapse(true)
      
      selection.removeAllRanges()
      selection.addRange(range)
      
      // Store the change for tracking purposes (field name only)
      setChanges(prev => [...prev, {
        field: fieldName,
        originalText: `[Inserted at cursor position]`,
        placeholder: `{{${fieldName}}}`, // Store simple placeholder, not HTML
        type: 'click'
      }])

    } catch (error) {
      console.error('Error inserting field at click position:', error)
    }
    
    closeFieldSelector()
  }

  const closeFieldSelector = () => {
    setShowFieldSelector(false)
    setSelectedText('')
    setClickPosition(null)
    setInteractionMode(null)
  }

  const removeFieldMapping = (fieldName) => {
    const placeholders = editorRef.current.querySelectorAll(`[data-field="${fieldName}"]`)
    
    placeholders.forEach((placeholder) => {
      if (placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder)
      }
    })
    
    setChanges(prev => prev.filter(change => change.field !== fieldName))
  }

  const handleSave = async () => {
    setLoading(true)
    
    try {
      // Get the latest HTML from the editor
      const currentHtml = editorRef.current.innerHTML
      
      // Extract current field mappings from the actual HTML content
      const templateFieldMappings = {}
      const placeholderRegex = /\{\{([^}]+)\}\}/g
      let match

      while ((match = placeholderRegex.exec(currentHtml)) !== null) {
        const fieldName = match[1].trim()
        const placeholder = match[0] // This is "{{fieldName}}"
        templateFieldMappings[placeholder] = fieldName // ✅ placeholder as key, fieldName as value
      }
      
      console.log('Current field mappings for validation:', templateFieldMappings)
      
      // Validate current field mappings before saving
      if (Object.keys(templateFieldMappings).length > 0) {
        const validationResponse = await fetch('/api/fields/schema', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldMappings: templateFieldMappings })
        })
        
        if (validationResponse.ok) {
          const validationData = await validationResponse.json()
          console.log('Validation result:', validationData.validation)
          
          if (!validationData.validation.valid) {
            const invalidFields = validationData.validation.invalidMappings.map(im => im.fieldName).join(', ')
            if (!confirm(`Warning: The following fields are no longer valid: ${invalidFields}. Do you want to continue saving?`)) {
              return
            }
          }
        }
      }
      
      // Build the template data
      const templateData = {
        ...template,
        html_content: currentHtml,
        field_mappings: templateFieldMappings,
        status: 'active'
      }

      console.log('Saving template with field mappings:', templateFieldMappings)
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

  const handlePlaceholderClick = (e, fieldName) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Check if this is an invalid field
    const isInvalid = fieldValidation?.invalidMappings.some(im => im.fieldName === fieldName)
    
    if (isInvalid) {
      if (confirm(`The field "${fieldName}" no longer exists in the schema. Would you like to remove this mapping or replace it with a valid field?`)) {
        // Show field selector to replace with valid field
        setInteractionMode('replace')
        setSelectedText(`{{${fieldName}}}`)
        setClickPosition({ x: e.clientX, y: e.clientY })
        setShowFieldSelector(true)
      }
    } else {
      if (confirm(`Remove field mapping for "${fieldName}"?`)) {
        removeFieldMapping(fieldName)
      }
    }
  }

  // Calculate position for field selector overlay
  const getFieldSelectorPosition = () => {
    if (!showFieldSelector) return {}
    
    if (clickPosition && clickPosition.x && clickPosition.y) {
      // Position based on click coordinates
      return {
        position: 'fixed',
        left: `${Math.min(clickPosition.x, window.innerWidth - 350)}px`,
        top: `${Math.min(clickPosition.y + 10, window.innerHeight - 400)}px`,
      }
    }
    
    // Default position (center of viewport)
    return {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  // Add event listeners
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
      setTimeout(syncHtmlContent, 0)
    }

    const handleClickOutside = (e) => {
      // Close field selector if clicking outside
      if (showFieldSelector && !e.target.closest('.field-selector-overlay') && !e.target.closest('.editor-content')) {
        closeFieldSelector()
      }
    }

    const handleKeyDown = (e) => {
      // Close field selector on Escape key
      if (e.key === 'Escape' && showFieldSelector) {
        closeFieldSelector()
      }
    }

    const currentEditor = editorRef.current

    if (currentEditor) {
      currentEditor.addEventListener('click', handlePlaceholderClicks)
      currentEditor.addEventListener('input', handleInput)
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      
      return () => {
        currentEditor.removeEventListener('click', handlePlaceholderClicks)
        currentEditor.removeEventListener('input', handleInput)
        document.removeEventListener('click', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [fieldValidation, showFieldSelector])

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
            <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
              <span>{getFieldCount()} field placeholders</span>
              <span>•</span>
              <span>{changes.length} changes made</span>
              {fieldValidation && (
                <>
                  <span>•</span>
                  <span className={fieldValidation.valid ? 'text-green-600' : 'text-red-600'}>
                    {fieldValidation.validCount} valid, {fieldValidation.invalidCount} invalid
                  </span>
                </>
              )}
            </div>
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

        {/* Validation Warnings */}
        {fieldValidation && !fieldValidation.valid && (
          <div className="validation-error mt-3">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-red-800">Schema Validation Issues</p>
                <p className="text-red-700 text-sm">
                  {fieldValidation.invalidCount} field mappings are no longer valid. 
                  Click on red-highlighted fields to fix them.
                </p>
              </div>
            </div>
          </div>
        )}

        {fieldValidation?.warnings?.length > 0 && (
          <div className="validation-warning mt-2">
            <p className="font-medium text-yellow-800">Warnings:</p>
            <ul className="text-yellow-700 text-sm list-disc list-inside">
              {fieldValidation.warnings.map((warning, index) => (
                <li key={index}>{warning.message}</li>
              ))}
            </ul>
          </div>
        )}
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
                  Click anywhere to insert fields, or select text to replace with fields
                </p>
              </div>
              <div className="text-xs text-gray-500">
                {interactionMode && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {interactionMode === 'highlight' ? 'Replacing selected text' : 
                     interactionMode === 'click' ? 'Inserting at cursor' : 
                     'Replacing invalid field'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 relative">
            <div
              ref={editorRef}
              className="editor-content bg-white border rounded-lg p-6 shadow-sm min-h-full"
              style={{ 
                fontFamily: 'Times New Roman, serif',
                fontSize: '12pt',
                lineHeight: '1.5'
              }}
              contentEditable={true}
              onMouseUp={handleEditorInteraction}
              onClick={handleEditorInteraction}
              suppressContentEditableWarning={true}
            />

            {/* Field Selector Overlay */}
            {showFieldSelector && (
              <div 
                className="field-selector-overlay"
                style={getFieldSelectorPosition()}
              >
                <DynamicFieldSelector
                  selectedText={selectedText}
                  clickPosition={clickPosition}
                  onFieldSelect={handleFieldMapping}
                  onClose={closeFieldSelector}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Information and Current Mappings */}
        <div className="w-80 bg-gray-50 border-l border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">Field Mapping</h3>
            <p className="text-xs text-gray-600 mt-1">
              Unified interaction - just click or highlight naturally
            </p>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Instructions */}
            <div className="bg-white border rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">How it works:</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p>• <strong>Select text</strong> → Replace with field</p>
                <p>• <strong>Click position</strong> → Insert field</p>
                <p>• <strong>Click yellow fields</strong> → Remove/replace</p>
                <p>• Fields auto-update with schema changes</p>
              </div>
            </div>

            {/* Current Context */}
            {(selectedText || clickPosition) && !showFieldSelector && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Ready to Map:</h4>
                {selectedText ? (
                  <p className="text-sm text-blue-800 bg-white p-2 rounded border">
                    Selected: "{selectedText}"
                  </p>
                ) : (
                  <p className="text-sm text-blue-800">
                    Click position ready for field insertion
                  </p>
                )}
              </div>
            )}

            {/* Current Mappings */}
            {changes.length > 0 && (
              <div className="bg-white border rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Current Mappings ({changes.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {changes.map((change, index) => {
                    const isInvalid = fieldValidation?.invalidMappings.some(im => im.fieldName === change.field)
                    return (
                      <div key={index} className={`flex items-center justify-between p-2 rounded ${
                        isInvalid ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900 flex items-center">
                            {change.field}
                            {isInvalid && (
                              <span className="ml-2 px-1 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                                invalid
                              </span>
                            )}
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
                    )
                  })}
                </div>
              </div>
            )}

            {/* Field Stats */}
            <div className="bg-white border rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Schema Information</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p>• {availableFields.length} fields available</p>
                <p>• {availableFields.filter(f => f.computed).length} computed fields</p>
                <p>• Auto-updates when schema changes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Instructions */}
      <div className="flex-shrink-0 bg-blue-50 border-t border-blue-200 px-6 py-3">
        <div className="flex items-start text-sm text-blue-800">
          <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p><strong>Smart Interaction:</strong> The editor automatically detects your intent. 
            Highlight text to replace it with fields, or click anywhere to insert fields at that position. 
            Yellow highlighted fields show current mappings - click them to modify or remove.</p>
          </div>
        </div>
      </div>
    </div>
  )
}` `