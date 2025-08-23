// src/components/templates/TemplateEditor.jsx (Complete Rewrite)
'use client'

import { useState, useRef, useEffect } from 'react'
import DynamicFieldSelector from './DynamicFieldSelector'
import TemplateEditorMainContent from './TemplateEditorMainContent'

export default function TemplateEditor({ 
  template, 
  onSave, 
  onCancel,
  isModal = false
}) {
  // State management
  const [htmlContent, setHtmlContent] = useState(template?.html_content || '')
  const [loading, setLoading] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [clickPosition, setClickPosition] = useState(null)
  const [showFieldSelector, setShowFieldSelector] = useState(false)
  const [interactionMode, setInteractionMode] = useState(null)
  const [changes, setChanges] = useState([])
  const [fieldValidation, setFieldValidation] = useState(null)
  const [availableFields, setAvailableFields] = useState([])
  const [lastCursorPosition, setLastCursorPosition] = useState(null)
  
  // Refs
  const editorRef = useRef(null)

  // Initialize component
  useEffect(() => {
    fetchAvailableFields()
    if (template?.field_mappings) {
      validateCurrentMappings()
    }
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
    updateEditorContent()
  }, [htmlContent, fieldValidation])

  // Track cursor position changes and prevent cursor inside field placeholders
  useEffect(() => {
    const handleSelectionChange = () => {
      if (!showFieldSelector && editorRef.current) {
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

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [showFieldSelector])

  // Sync changes to state
  useEffect(() => {
    syncHtmlContent()
  }, [changes])

  // API Functions
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

  // Content Management Functions
  const syncHtmlContent = () => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML
      if (newContent !== htmlContent) {
        console.log('Syncing HTML content from DOM')
        setHtmlContent(newContent)
      }
    }
  }

  const updateEditorContent = () => {
    if (editorRef.current && editorRef.current.innerHTML !== htmlContent) {
      console.log('Updating editor content')
      editorRef.current.innerHTML = htmlContent
      highlightInvalidFields()
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
    
    // Handle adjacent field placeholders and text nodes within them
    if (container.nodeType === Node.TEXT_NODE) {
      // Check if this text node is inside a field placeholder
      let parentNode = container.parentNode
      while (parentNode && parentNode !== editorRef.current) {
        if (parentNode.classList && parentNode.classList.contains('field-placeholder')) {
          console.log('Text node is inside field placeholder, repositioning outside')
          const newRange = document.createRange()
          newRange.setStartAfter(parentNode)
          newRange.collapse(true)
          return newRange
        }
        parentNode = parentNode.parentNode
      }
    }
    
    // Handle clicking between elements that include field placeholders
    if (container.nodeType === Node.ELEMENT_NODE) {
      const children = Array.from(container.childNodes)
      const offset = originalRange.startOffset
      
      if (offset > 0 && offset < children.length) {
        const prevNode = children[offset - 1]
        const nextNode = children[offset]
        
        // If previous node is a field placeholder, make sure we're positioned after it
        if (prevNode && prevNode.classList && prevNode.classList.contains('field-placeholder')) {
          const newRange = document.createRange()
          newRange.setStartAfter(prevNode)
          newRange.collapse(true)
          console.log('Adjusted cursor to be properly after previous field placeholder')
          return newRange
        }
        
        // If next node is a field placeholder, make sure we're positioned before it
        if (nextNode && nextNode.classList && nextNode.classList.contains('field-placeholder')) {
          const newRange = document.createRange()
          newRange.setStartBefore(nextNode)
          newRange.collapse(true)
          console.log('Adjusted cursor to be properly before next field placeholder')
          return newRange
        }
      }
      
      // Handle edge case: clicking at the very end after the last field placeholder
      if (offset === children.length && offset > 0) {
        const lastNode = children[offset - 1]
        if (lastNode && lastNode.classList && lastNode.classList.contains('field-placeholder')) {
          const newRange = document.createRange()
          newRange.setStartAfter(lastNode)
          newRange.collapse(true)
          console.log('Adjusted cursor to be after the last field placeholder')
          return newRange
        }
      }
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
    
    // Also check if the click target is inside a field placeholder
    let currentNode = e.target
    while (currentNode && currentNode !== editorRef.current) {
      if (currentNode.classList && currentNode.classList.contains('field-placeholder')) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      currentNode = currentNode.parentNode
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

      const isStale = Date.now() - position.timestamp > 10000
      let insertionRange

      if (isStale || !position.range || position.range.collapsed === undefined) {
        console.log('Creating fresh range for insertion with boundary detection')
        const freshPosition = createFreshCursorPosition(position.x, position.y)
        if (!freshPosition) {
          console.error('Could not create fresh cursor position')
          return
        }
        insertionRange = freshPosition.range
      } else {
        try {
          const testContainer = position.range.startContainer
          const testOffset = position.range.startOffset
          
          if (testContainer && typeof testOffset === 'number') {
            insertionRange = adjustRangeForFieldPlaceholders(position.range)
          } else {
            throw new Error('Range validation failed')
          }
        } catch (rangeError) {
          console.log('Existing range is invalid, creating fresh range with boundary detection')
          const freshPosition = createFreshCursorPosition(position.x, position.y)
          if (!freshPosition) {
            console.error('Could not create fresh cursor position')
            return
          }
          insertionRange = freshPosition.range
        }
      }

      const instanceId = Date.now() + Math.random() // Unique ID for this instance
      const placeholder = `<span class="field-placeholder" data-field="${fieldName}" data-instance-id="${instanceId}" title="Field: ${fieldName}">{{${fieldName}}}</span>`
      
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = placeholder
      const placeholderNode = tempDiv.firstChild

      const needsSpaceBefore = shouldAddSpaceBefore(insertionRange)
      const needsSpaceAfter = shouldAddSpaceAfter(insertionRange)
      
      insertionRange.collapse(true)
      
      if (needsSpaceBefore) {
        const spaceBefore = document.createTextNode(' ')
        insertionRange.insertNode(spaceBefore)
      }
      
      insertionRange.insertNode(placeholderNode)
      
      if (needsSpaceAfter) {
        const spaceAfter = document.createTextNode(' ')
        const afterRange = document.createRange()
        afterRange.setStartAfter(placeholderNode)
        afterRange.collapse(true)
        afterRange.insertNode(spaceAfter)
      }
      
      updateCursorAfterInsertion(needsSpaceAfter ? insertionRange.endContainer : placeholderNode)
      
      setChanges(prev => [...prev, {
        field: fieldName,
        instanceId: instanceId,
        originalText: `[Inserted at cursor position]`,
        placeholder: `{{${fieldName}}}`,
        type: 'click'
      }])

      console.log(`Successfully inserted field: ${fieldName} with proper spacing`)

    } catch (error) {
      console.error('Error inserting field at click position:', error)
      try {
        const editorContent = editorRef.current
        if (editorContent) {
          const placeholder = `<span class="field-placeholder" data-field="${fieldName}" title="Field: ${fieldName}">{{${fieldName}}}</span>`
          editorContent.innerHTML += ` ${placeholder} `
          console.log('Inserted field as fallback at end of content with spacing')
        }
      } catch (fallbackError) {
        console.error('Fallback insertion also failed:', fallbackError)
      }
    }
    
    closeFieldSelector()
  }

  // Spacing Helpers
  const shouldAddSpaceBefore = (range) => {
    try {
      const container = range.startContainer
      const offset = range.startOffset
      
      if (container.nodeType === Node.TEXT_NODE) {
        if (offset > 0) {
          const charBefore = container.textContent[offset - 1]
          return charBefore !== ' ' && charBefore !== '\n' && charBefore !== '\t'
        }
      } else if (container.nodeType === Node.ELEMENT_NODE) {
        if (offset > 0) {
          const prevNode = container.childNodes[offset - 1]
          if (prevNode) {
            if (prevNode.nodeType === Node.ELEMENT_NODE && 
                prevNode.classList && 
                prevNode.classList.contains('field-placeholder')) {
              return true
            }
            if (prevNode.nodeType === Node.TEXT_NODE) {
              const text = prevNode.textContent
              return text && !text.endsWith(' ') && !text.endsWith('\n')
            }
          }
        }
      }
      
      return false
    } catch (error) {
      console.error('Error checking space before:', error)
      return true
    }
  }

  const shouldAddSpaceAfter = (range) => {
    try {
      const container = range.startContainer
      const offset = range.startOffset
      
      if (container.nodeType === Node.TEXT_NODE) {
        if (offset < container.textContent.length) {
          const charAfter = container.textContent[offset]
          return charAfter !== ' ' && charAfter !== '\n' && charAfter !== '\t'
        }
      } else if (container.nodeType === Node.ELEMENT_NODE) {
        if (offset < container.childNodes.length) {
          const nextNode = container.childNodes[offset]
          if (nextNode) {
            if (nextNode.nodeType === Node.ELEMENT_NODE && 
                nextNode.classList && 
                nextNode.classList.contains('field-placeholder')) {
              return true
            }
            if (nextNode.nodeType === Node.TEXT_NODE) {
              const text = nextNode.textContent
              return text && !text.startsWith(' ') && !text.startsWith('\n')
            }
          }
        }
      }
      
      return false
    } catch (error) {
      console.error('Error checking space after:', error)
      return true
    }
  }

  // Field Management
  const removeFieldMapping = (fieldName, targetElement = null, instanceId = null) => {
    if (!editorRef.current) {
      console.error('Editor ref not available for field removal')
      return
    }
    
    if (targetElement) {
      // Remove only the specific clicked element
      console.log('Removing specific field placeholder element')
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
      console.log('Removing field by instance ID:', instanceId)
      const placeholder = editorRef.current.querySelector(`[data-instance-id="${instanceId}"]`)
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder)
      }
      
      // Remove the specific instance from changes array
      setChanges(prev => prev.filter(change => change.instanceId !== instanceId))
    } else {
      // Fallback: remove all instances of the field (old behavior)
      console.log('Removing all instances of field:', fieldName)
      const placeholders = editorRef.current.querySelectorAll(`[data-field="${fieldName}"]`)
      
      placeholders.forEach((placeholder) => {
        if (placeholder.parentNode) {
          placeholder.parentNode.removeChild(placeholder)
        }
      })
      
      // Remove all instances from changes array
      setChanges(prev => prev.filter(change => change.field !== fieldName))
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
      const currentHtml = editorRef.current.innerHTML
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

  return (
    <div className={isModal ? "h-full flex flex-col bg-white" : "h-screen flex flex-col bg-white"}>
      {/* Header - only show if not in modal (modal has its own header) */}
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
                onClick={handleAISuggestions}
                disabled={aiProcessing}
                className="inline-flex items-center px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:bg-gray-400"
              >
                {aiProcessing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Mistral AI
                  </>
                )}
              </button>
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

          {/* Compact validation warnings for modal */}
          {fieldValidation && !fieldValidation.valid && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
              <p className="font-medium text-red-800">
                {fieldValidation.invalidCount} invalid field mappings - click red fields to fix
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
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

      {/* Footer with Instructions - only show if not in modal */}
      {!isModal && (
        <div className="flex-shrink-0 bg-blue-50 border-t border-blue-200 px-6 py-3">
          <div className="flex items-start text-sm text-blue-800">
            <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p><strong>Enhanced Smart Interaction:</strong> The editor now features improved cursor tracking that prevents formatting issues when inserting consecutive fields. 
              The system automatically refreshes cursor positions and handles DOM changes intelligently. 
              Yellow highlighted fields show current mappings - click them to modify or remove.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}