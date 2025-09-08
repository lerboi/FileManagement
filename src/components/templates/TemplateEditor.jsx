// src/components/templates/TemplateEditor.jsx
'use client'
import { useState, useRef, useEffect } from 'react'
import DynamicFieldSelector from './DynamicFieldSelector'
import TemplateEditorMainContent from './TemplateEditorMainContent'
import PlaceholderCreator from './PlaceholderCreator'

export default function TemplateEditor({ 
  template, 
  onSave, 
  onCancel,
  isModal = false
}) {
  // State management
  const [htmlContent, setHtmlContent] = useState(template?.html_content || '')
  const [loading, setLoading] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [clickPosition, setClickPosition] = useState(null)
  const [showFieldSelector, setShowFieldSelector] = useState(false)
  const [interactionMode, setInteractionMode] = useState(null)
  const [changes, setChanges] = useState([])
  const [fieldValidation, setFieldValidation] = useState(null)
  const [availableFields, setAvailableFields] = useState([])
  const [lastCursorPosition, setLastCursorPosition] = useState(null)
  
  // New state for custom fields and tabs
  const [activeTab, setActiveTab] = useState('content')
  
  // Refs
  const editorRef = useRef(null)

  // Initialize component
  useEffect(() => {
    const initializeEditor = async () => {
      await fetchAvailableFields()
      if (template?.field_mappings) {
        validateCurrentMappings()
      }
    }
    
    initializeEditor()
  }, [template])

  // Add CSS styles for field placeholders
  useEffect(() => {
    const styleElement = document.createElement('style')
    styleElement.id = 'template-editor-styles'
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
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        pointer-events: auto !important;
        position: relative !important;
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
      const existingStyle = document.getElementById('template-editor-styles')
      if (existingStyle) {
        document.head.removeChild(existingStyle)
      }
    }
  }, [])

  // Update editor content when htmlContent changes
  useEffect(() => {
    if (activeTab === 'content') {
      updateEditorContent()
    }
  }, [htmlContent, fieldValidation, activeTab])

  // Track cursor position changes and prevent cursor inside field placeholders
  useEffect(() => {
    const handleSelectionChange = () => {
      if (!showFieldSelector && editorRef.current && activeTab === 'content') {
        const selection = window.getSelection()
        if (selection.rangeCount > 0 && selection.isCollapsed) {
          const range = selection.getRangeAt(0)
          
          // Check if cursor is inside a field placeholder and move it outside
          const adjustedRange = adjustRangeForFieldPlaceholders(range)
          
          // If the range was adjusted, update the selection
          if (adjustedRange !== range) {
            selection.removeAllRanges()
            selection.addRange(adjustedRange)
          }
          
          const rect = adjustedRange.getBoundingClientRect()
          setLastCursorPosition({
            range: adjustedRange.cloneRange(),
            textNode: adjustedRange.startContainer,
            offset: adjustedRange.startOffset,
            x: rect.left || 0,
            y: rect.top || 0,
            timestamp: Date.now()
          })
        }
      }
    }

    if (activeTab === 'content') {
      document.addEventListener('selectionchange', handleSelectionChange)
      return () => document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [showFieldSelector, activeTab])

  // Sync changes to state
  useEffect(() => {
    syncHtmlContent()
  }, [changes])

  // Update fetchAvailableFields to use new unified API
  const fetchAvailableFields = async () => {
    try {
      const response = await fetch('/api/fields/schema')
      if (response.ok) {
        const data = await response.json()
        setAvailableFields(data.fields || [])
        
        console.log('Available fields updated:', {
          totalFields: data.fields?.length || 0,
          clientFields: data.clientFields || 0,
          placeholderFields: data.placeholderFields || 0
        })
      }
    } catch (error) {
      console.error('Error fetching available fields:', error)
      setAvailableFields([])
    }
  }

  const validateCurrentMappings = async () => {
    try {
      const response = await fetch('/api/fields/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fieldMappings: template.field_mappings || {},
          templateId: template?.id // Include template ID for custom fields validation
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setFieldValidation(data.validation)
      }
    } catch (error) {
      console.error('Error validating field mappings:', error)
    }
  }

  // Content Management Functions
  const syncHtmlContent = () => {
    if (editorRef.current && activeTab === 'content') {
      const newContent = editorRef.current.innerHTML
      if (newContent !== htmlContent) {
        console.log('Syncing HTML content from DOM')
        setHtmlContent(newContent)
      }
    }
  }

  const updateEditorContent = () => {
    if (editorRef.current && activeTab === 'content' && htmlContent) {
      console.log('Updating editor content, current length:', htmlContent.length)
      if (editorRef.current.innerHTML !== htmlContent) {
        editorRef.current.innerHTML = htmlContent
        highlightInvalidFields()
      }
    }
  }

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

  // Cursor Position Management
  const createFreshCursorPosition = (x, y) => {
    if (!editorRef.current) return null

    let range
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y)
    } else if (document.caretPositionFromPoint) {
      const caretPos = document.caretPositionFromPoint(x, y)
      if (caretPos) {
        range = document.createRange()
        range.setStart(caretPos.offsetNode, caretPos.offset)
        range.collapse(true)
      }
    }

    if (range) {
      const adjustedRange = adjustRangeForFieldPlaceholders(range)
      
      return {
        range: adjustedRange,
        textNode: adjustedRange.startContainer,
        offset: adjustedRange.startOffset,
        x,
        y,
        timestamp: Date.now()
      }
    }

    return null
  }

  const adjustRangeForFieldPlaceholders = (originalRange) => {
    let container = originalRange.startContainer
    let currentNode = container
    let fieldPlaceholder = null
    
    // Walk up the DOM tree to check if we're inside a field placeholder
    while (currentNode && currentNode !== editorRef.current) {
      if (currentNode.nodeType === Node.ELEMENT_NODE && 
          currentNode.classList && 
          currentNode.classList.contains('field-placeholder')) {
        fieldPlaceholder = currentNode
        break
      }
      currentNode = currentNode.parentNode
    }
    
    if (fieldPlaceholder) {
      console.log('Cursor detected inside field placeholder, repositioning outside')
      
      // ALWAYS position after the field placeholder to prevent any internal editing
      const newRange = document.createRange()
      newRange.setStartAfter(fieldPlaceholder)
      newRange.collapse(true)
      
      console.log('Forced cursor position to be after field placeholder')
      return newRange
    }
    
    return originalRange
  }

  const updateCursorAfterInsertion = (insertedNode) => {
    try {
      if (!insertedNode || !editorRef.current) return

      const range = document.createRange()
      range.setStartAfter(insertedNode)
      range.collapse(true)

      const rect = range.getBoundingClientRect()
      setLastCursorPosition({
        range: range.cloneRange(),
        textNode: range.startContainer,
        offset: range.startOffset,
        x: rect.left,
        y: rect.top,
        timestamp: Date.now()
      })

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    } catch (error) {
      console.error('Error updating cursor position:', error)
    }
  }

  // Interaction Handlers
  const handleEditorInteraction = (e) => {
    // Block all interactions with field placeholders
    if (e.target.classList.contains('field-placeholder')) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    
    const selection = window.getSelection()
    const hasTextSelection = selection.rangeCount > 0 && selection.toString().trim().length > 0

    if (hasTextSelection) {
      // Check if selection includes any field placeholders - if so, reject it
      const range = selection.getRangeAt(0)
      const selectedContent = range.cloneContents()
      const fieldPlaceholdersInSelection = selectedContent.querySelectorAll('.field-placeholder')
      
      if (fieldPlaceholdersInSelection.length > 0) {
        console.log('Selection includes field placeholders - rejecting interaction')
        selection.removeAllRanges()
        return
      }
      
      setInteractionMode('highlight')
      setSelectedText(selection.toString().trim())
      setClickPosition(null)
      setShowFieldSelector(true)
    } else if (e.type === 'click') {
      setInteractionMode('click')
      setSelectedText('')
      
      const freshPosition = createFreshCursorPosition(e.clientX, e.clientY)
      
      if (freshPosition) {
        setClickPosition(freshPosition)
        setLastCursorPosition(freshPosition)
        setShowFieldSelector(true)

        const newSelection = window.getSelection()
        newSelection.removeAllRanges()
        newSelection.addRange(freshPosition.range)
      }
    }
  }

  const handleFieldMapping = (fieldName) => {
    if (interactionMode === 'highlight' && selectedText) {
      handleHighlightFieldMapping(fieldName)
    } else if (interactionMode === 'click' && (clickPosition || lastCursorPosition)) {
      handleClickFieldMapping(fieldName)
    }
  }

  const handleHighlightFieldMapping = (fieldName) => {
    if (!selectedText) return

    const selection = window.getSelection()
    if (selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const instanceId = Date.now() + Math.random() // Unique ID for this instance
    const placeholder = `<span class="field-placeholder" data-field="${fieldName}" data-instance-id="${instanceId}" title="Field: ${fieldName}">{{${fieldName}}}</span>`
    
    try {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = placeholder
      const placeholderNode = tempDiv.firstChild

      range.deleteContents()
      range.insertNode(placeholderNode)
      
      selection.removeAllRanges()
      updateCursorAfterInsertion(placeholderNode)
      
      setChanges(prev => [...prev, {
        field: fieldName,
        instanceId: instanceId,
        originalText: selectedText,
        placeholder: `{{${fieldName}}}`,
        type: 'highlight'
      }])
      
    } catch (error) {
      console.error('Error replacing selected text:', error)
    }
    
    closeFieldSelector()
  }

  const handleClickFieldMapping = (fieldName) => {
    try {
      const position = clickPosition || lastCursorPosition
      
      if (!position) {
        console.warn('No cursor position available for field insertion')
        return
      }

      const instanceId = Date.now() + Math.random() // Unique ID for this instance
      const placeholder = `<span class="field-placeholder" data-field="${fieldName}" data-instance-id="${instanceId}" title="Field: ${fieldName}">{{${fieldName}}}</span>`
      
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = placeholder
      const placeholderNode = tempDiv.firstChild

      const insertionRange = position.range.cloneRange()
      insertionRange.collapse(true)
      insertionRange.insertNode(placeholderNode)
      
      updateCursorAfterInsertion(placeholderNode)
      
      setChanges(prev => [...prev, {
        field: fieldName,
        instanceId: instanceId,
        originalText: `[Inserted at cursor position]`,
        placeholder: `{{${fieldName}}}`,
        type: 'click'
      }])

      console.log(`Successfully inserted field: ${fieldName}`)

    } catch (error) {
      console.error('Error inserting field at click position:', error)
    }
    
    closeFieldSelector()
  }

  // Field Management
  const removeFieldMapping = (fieldName, targetElement = null, instanceId = null) => {
    if (!editorRef.current) {
      console.error('Editor ref not available for field removal')
      return
    }
    
    if (targetElement) {
      // Remove only the specific clicked element
      const elementInstanceId = targetElement.getAttribute('data-instance-id')
      
      if (targetElement.parentNode) {
        targetElement.parentNode.removeChild(targetElement)
      }
      
      // Remove the specific instance from changes array
      if (elementInstanceId) {
        setChanges(prev => prev.filter(change => change.instanceId !== elementInstanceId))
      }
    } else if (instanceId) {
      // Remove by instance ID (for sidebar removal)
      const placeholder = editorRef.current.querySelector(`[data-instance-id="${instanceId}"]`)
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder)
      }
      
      // Remove the specific instance from changes array
      setChanges(prev => prev.filter(change => change.instanceId !== instanceId))
    }
  }

  const handlePlaceholderClick = (e, fieldName) => {
    e.preventDefault()
    e.stopPropagation()
    
    const clickedElement = e.target
    const isInvalid = fieldValidation?.invalidMappings.some(im => im.fieldName === fieldName)
    
    if (isInvalid) {
      if (confirm(`The field "${fieldName}" no longer exists in the schema. Would you like to remove this mapping or replace it with a valid field?`)) {
        setInteractionMode('replace')
        setSelectedText(`{{${fieldName}}}`)
        setClickPosition({ x: e.clientX, y: e.clientY })
        setShowFieldSelector(true)
      }
    } else {
      if (confirm(`Remove this "${fieldName}" field?`)) {
        // Pass the specific clicked element to remove only that one
        removeFieldMapping(fieldName, clickedElement)
      }
    }
  }

  // Update handlePlaceholderCreated to refresh fields
  const handlePlaceholderCreated = (newPlaceholder) => {
    // Refresh available fields when a new placeholder is created
    fetchAvailableFields()
    
    // Show success message
    const successDiv = document.createElement('div')
    successDiv.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50'
    successDiv.textContent = `Placeholder "${newPlaceholder.label}" created and ready to use!`
    document.body.appendChild(successDiv)
    
    setTimeout(() => {
      if (document.body.contains(successDiv)) {
        document.body.removeChild(successDiv)
      }
    }, 3000)
  }

  // Tab switching handler
  const handleTabSwitch = (tab) => {
    setActiveTab(tab)
  }

  // UI Helpers
  const closeFieldSelector = () => {
    setShowFieldSelector(false)
    setSelectedText('')
    setInteractionMode(null)
  }

  const getFieldSelectorPosition = () => {
    if (!showFieldSelector) return {}
    
    if (clickPosition && clickPosition.x && clickPosition.y) {
      return {
        position: 'fixed',
        left: `${Math.min(clickPosition.x, window.innerWidth - 350)}px`,
        top: `${Math.min(clickPosition.y + 10, window.innerHeight - 400)}px`,
      }
    }
    
    return {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  const getFieldCount = () => {
    const matches = htmlContent.match(/\{\{([^}]+)\}\}/g)
    return matches ? matches.length : 0
  }

  // Save Handler
  const handleSave = async () => {
    setLoading(true)
    
    try {
      const currentHtml = editorRef.current?.innerHTML || htmlContent
      const templateFieldMappings = {}
      const placeholderRegex = /\{\{([^}]+)\}\}/g
      let match

      while ((match = placeholderRegex.exec(currentHtml)) !== null) {
        const fieldName = match[1].trim()
        const placeholder = match[0]
        templateFieldMappings[placeholder] = fieldName
      }
      
      console.log('Current field mappings for validation:', templateFieldMappings)
      
      if (Object.keys(templateFieldMappings).length > 0) {
        const validationResponse = await fetch('/api/fields/schema', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            fieldMappings: templateFieldMappings,
            templateId: template?.id
          })
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

      // Get placeholder definitions for custom_fields
      let customFields = []
      const placeholderNames = [...new Set(Object.values(templateFieldMappings))]
      
      if (placeholderNames.length > 0) {
        try {
          // Fetch placeholder definitions from the database
          const placeholdersResponse = await fetch('/api/placeholders')
          if (placeholdersResponse.ok) {
            const placeholdersData = await placeholdersResponse.json()
            const allPlaceholders = placeholdersData.placeholders || []
            
            // Format placeholders to match the expected custom_fields format
            customFields = placeholderNames
              .map(name => {
                const placeholder = allPlaceholders.find(p => p.name === name)
                if (placeholder) {
                  return {
                    name: placeholder.name,
                    label: placeholder.label,
                    description: placeholder.description,
                    type: placeholder.field_type,
                    required: true, // All template placeholders are required
                    category: 'document',
                    source: 'placeholder',
                    placeholder_id: placeholder.id
                  }
                } else {
                  // Create a placeholder definition for missing placeholders
                  return {
                    name: name,
                    label: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    description: `Document placeholder: ${name}`,
                    type: 'text',
                    required: true,
                    category: 'missing',
                    source: 'missing'
                  }
                }
              })
              .filter(Boolean)
          }
        } catch (error) {
          console.error('Error fetching placeholder definitions:', error)
          // Create basic definitions for all placeholders if fetch fails
          customFields = placeholderNames.map(name => ({
            name: name,
            label: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: `Document placeholder: ${name}`,
            type: 'text',
            required: true,
            category: 'document',
            source: 'fallback'
          }))
        }
      }
      
      const templateData = {
        ...template,
        html_content: currentHtml,
        field_mappings: templateFieldMappings,
        custom_fields: customFields, // Store placeholder definitions in custom_fields
        status: 'active'
      }

      console.log('Saving template with field mappings and custom fields:', templateFieldMappings, customFields)
      await onSave(templateData)
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={isModal ? "h-full flex flex-col bg-white" : "h-screen flex flex-col bg-white"}>
      {/* Header - only show if not in modal */}
      {!isModal && (
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
        </div>
      )}

      {/* Compact header for modal mode */}
      {isModal && (
        <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
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

      {/* Tab Navigation */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        <nav className="flex space-x-8 px-6">
          <button
            onClick={() => handleTabSwitch('content')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'content'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Document Content
          </button>
          <button
            onClick={() => handleTabSwitch('create-placeholder')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'create-placeholder'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Create New Placeholder
            <svg className="w-4 h-4 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'content' ? (
        <TemplateEditorMainContent
          editorRef={editorRef}
          htmlContent={htmlContent}
          showFieldSelector={showFieldSelector}
          selectedText={selectedText}
          clickPosition={clickPosition}
          interactionMode={interactionMode}
          changes={changes}
          fieldValidation={fieldValidation}
          availableFields={availableFields}
          lastCursorPosition={lastCursorPosition}
          onEditorInteraction={handleEditorInteraction}
          onFieldMapping={handleFieldMapping}
          onCloseFieldSelector={closeFieldSelector}
          onPlaceholderClick={handlePlaceholderClick}
          onRemoveFieldMapping={removeFieldMapping}
          onSyncHtmlContent={syncHtmlContent}
          getFieldSelectorPosition={getFieldSelectorPosition}
          isDevelopmentMode={process.env.NODE_ENV === 'development'}
        />
      ) : (
        <PlaceholderCreator
          onPlaceholderCreated={handlePlaceholderCreated}
        />
      )}

      {/* Footer with Instructions - only show if not in modal and on content tab */}
      {!isModal && activeTab === 'content' && (
        <div className="flex-shrink-0 bg-blue-50 border-t border-blue-200 px-6 py-3">
          <div className="flex items-start text-sm text-blue-800">
            <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p><strong>Enhanced Template Editor:</strong> Use the "Document Content" tab to map fields to your template content, and the "Create New Placeholder" tab to create reusable placeholders available across all templates.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}