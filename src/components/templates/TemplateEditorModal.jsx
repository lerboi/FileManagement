// src/components/templates/TemplateEditorModal.jsx
'use client'

import { useEffect } from 'react'
import SimpleTemplateEditor from './SimpleTemplateEditor'

export default function TemplateEditorModal({ 
  isOpen, 
  template, 
  onSave, 
  onClose 
}) {
  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleBackdropClick = (e) => {
    // Only close if clicking the backdrop, not the modal content
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleBackdropClick}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
        <div 
          className="relative bg-white rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white rounded-t-lg">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Edit Template: {template?.name}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Configure field mappings and content
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Body - Scrollable */}
          <div className="flex-1 overflow-hidden">
            {template && (
              <SimpleTemplateEditor
                template={template}
                onSave={async (templateData) => {
                  await onSave(templateData)
                  onClose()
                }}
                onCancel={onClose}
                isModal={true}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}