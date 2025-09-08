// src/components/templates/TemplateEditorMainContent.jsx
'use client'

import { useRef, useEffect } from 'react'
import DynamicFieldSelector from './DynamicFieldSelector'

export default function TemplateEditorMainContent({
  // Refs
  editorRef,
  
  // Content state
  htmlContent,
  
  // Field selector state
  showFieldSelector,
  selectedText,
  clickPosition,
  interactionMode,
  
  // Field mapping data
  changes,
  fieldValidation,
  availableFields,
  lastCursorPosition,
  
  // Event handlers
  onEditorInteraction,
  onFieldMapping,
  onCloseFieldSelector,
  onPlaceholderClick,
  onRemoveFieldMapping,
  onSyncHtmlContent,
  
  // Utility functions
  getFieldSelectorPosition,
  
  // Configuration
  isDevelopmentMode = false
}) {
  // Initialize editor content when component mounts
  useEffect(() => {
    if (editorRef.current && htmlContent && !editorRef.current.innerHTML) {
      console.log('Initializing editor content on mount, length:', htmlContent.length)
      editorRef.current.innerHTML = htmlContent
    }
  }, [htmlContent])

  // Event handlers setup
  useEffect(() => {
    const handleInput = () => {
      setTimeout(onSyncHtmlContent, 0)
    }
    
    const handlePlaceholderClicks = (e) => {
      const target = e.target
      if (target.classList.contains('field-placeholder')) {
        const fieldName = target.getAttribute('data-field')
        if (fieldName) {
          onPlaceholderClick(e, fieldName)
        }
      }
    }

    const handleClickOutside = (e) => {
      // Close field selector if clicking outside
      if (showFieldSelector && !e.target.closest('.field-selector-overlay') && !e.target.closest('.editor-content')) {
        onCloseFieldSelector()
      }
    }

    const handlePaste = (e) => {
      // Prevent pasting inside field placeholders
      const selection = window.getSelection()
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        let container = range.startContainer
        
        while (container && container !== editorRef.current) {
          if (container.classList && container.classList.contains('field-placeholder')) {
            console.log('Preventing paste inside field placeholder')
            e.preventDefault()
            e.stopPropagation()
            return
          }
          container = container.parentNode
        }
      }
    }

    const handleCut = (e) => {
      // Prevent cutting field placeholders or content inside them
      const selection = window.getSelection()
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const selectedContent = range.cloneContents()
        const fieldPlaceholdersInSelection = selectedContent.querySelectorAll('.field-placeholder')
        
        if (fieldPlaceholdersInSelection.length > 0) {
          console.log('Preventing cut operation on field placeholders')
          e.preventDefault()
          e.stopPropagation()
          return
        }
      }
    }

    const handleKeyDown = (e) => {
      // Close field selector on Escape key
      if (e.key === 'Escape' && showFieldSelector) {
        onCloseFieldSelector()
      }
    }

    const currentEditor = editorRef.current

    if (currentEditor) {
      currentEditor.addEventListener('click', handlePlaceholderClicks)
      currentEditor.addEventListener('input', handleInput)
      currentEditor.addEventListener('paste', handlePaste)
      currentEditor.addEventListener('cut', handleCut)
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      
      return () => {
        currentEditor.removeEventListener('click', handlePlaceholderClicks)
        currentEditor.removeEventListener('input', handleInput)
        currentEditor.removeEventListener('paste', handlePaste)
        currentEditor.removeEventListener('cut', handleCut)
        document.removeEventListener('click', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [showFieldSelector, onPlaceholderClick, onCloseFieldSelector, onSyncHtmlContent])

  return (
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
            <div className="flex items-center space-x-2">
              {interactionMode && (
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
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
            onMouseUp={onEditorInteraction}
            onClick={onEditorInteraction}
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
                availableFields={availableFields}
                onFieldSelect={onFieldMapping}
                onClose={onCloseFieldSelector}
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
            Enhanced with smart cursor tracking
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
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

          {/* Content Status */}
          {htmlContent && (
            <div className="bg-white border rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Content Status</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p>• Content length: {htmlContent.length} characters</p>
                <p>• Editor loaded: {editorRef.current ? 'Yes' : 'No'}</p>
                <p>• Last updated: {new Date().toLocaleTimeString()}</p>
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
                        onClick={() => {
                          // Remove the specific instance using its instanceId
                          onRemoveFieldMapping(change.field, null, change.instanceId)
                        }}
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
              <p>• {availableFields.filter(f => f.custom).length} custom fields</p>
              <p>• Auto-updates when schema changes</p>
              <p>• Smart cursor tracking enabled</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}