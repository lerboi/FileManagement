// src/components/templates/PlaceholderLibrary.jsx
'use client'

import { useState, useEffect } from 'react'
import CustomFieldModal from './CustomFieldModal'

export default function PlaceholderLibrary({ isOpen, onClose, onSelectPlaceholder }) {
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('client') // 'client' | 'custom'
  const [isEditMode, setIsEditMode] = useState(false)
  
  // Custom field management
  const [showCustomFieldModal, setShowCustomFieldModal] = useState(false)
  const [editingCustomField, setEditingCustomField] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [fieldToDelete, setFieldToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchAvailableFields()
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !showCustomFieldModal && !showDeleteConfirm) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, showCustomFieldModal, showDeleteConfirm, onClose])

  const fetchAvailableFields = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/fields/schema')
      if (!response.ok) throw new Error('Failed to fetch fields')
      
      const data = await response.json()
      setFields(data.fields || [])
      
    } catch (error) {
      console.error('Error fetching fields:', error)
      setFields([])
    } finally {
      setLoading(false)
    }
  }

  const showSuccessMessage = (message) => {
    const successDiv = document.createElement('div')
    successDiv.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-[70]'
    successDiv.textContent = message
    document.body.appendChild(successDiv)
    
    setTimeout(() => {
      if (document.body.contains(successDiv)) {
        document.body.removeChild(successDiv)
      }
    }, 3000)
  }

  const handleFieldSelect = (field) => {
    navigator.clipboard.writeText(`{${field.name}}`).then(() => {
      showSuccessMessage(`Placeholder {${field.name}} copied to clipboard!`)
      // Don't close modal - keep it open
      if (onSelectPlaceholder) {
        onSelectPlaceholder(field)
      }
    })
  }

  const handleCreateCustomField = () => {
    setEditingCustomField(null)
    setShowCustomFieldModal(true)
  }

  const handleEditCustomField = (field) => {
    setEditingCustomField(field)
    setShowCustomFieldModal(true)
  }

  const handleDeleteCustomField = (field) => {
    setFieldToDelete(field)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteCustomField = async () => {
    if (!fieldToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/placeholders/${fieldToDelete.placeholder_id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete custom field')
      }

      showSuccessMessage(`Custom field "${fieldToDelete.label}" deleted successfully!`)
      await fetchAvailableFields() // Refresh list
      setShowDeleteConfirm(false)
      setFieldToDelete(null)
    } catch (error) {
      alert('Failed to delete custom field: ' + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCustomFieldSuccess = async (action, placeholder) => {
    const actionText = action === 'created' ? 'created' : 'updated'
    showSuccessMessage(`Custom field "${placeholder.label}" ${actionText} successfully!`)
    await fetchAvailableFields() // Refresh list
  }

  // Filter fields based on active tab and search
  const clientFields = fields.filter(f => f.source === 'client')
  const customFields = fields.filter(f => f.source === 'placeholder')

  const activeFields = activeTab === 'client' ? clientFields : customFields

  const filteredFields = activeFields.filter(field => {
    const matchesSearch = field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         field.description?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  // Group client fields by category
  const groupedFields = activeTab === 'client' 
    ? filteredFields.reduce((groups, field) => {
        const category = field.category || 'other'
        if (!groups[category]) groups[category] = []
        groups[category].push(field)
        return groups
      }, {})
    : null

  const getCategoryIcon = (category) => {
    const icons = {
      personal: '👤',
      contact: '📧',
      professional: '💼',
      financial: '💰',
      legal: '⚖️',
      system: '🔧',
      document: '📄',
      custom: '🔧',
      other: '📝'
    }
    return icons[category] || '📝'
  }

  const getCategoryColor = (category) => {
    const colors = {
      personal: 'bg-blue-50 border-blue-200 text-blue-800',
      contact: 'bg-green-50 border-green-200 text-green-800',
      professional: 'bg-purple-50 border-purple-200 text-purple-800',
      financial: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      legal: 'bg-red-50 border-red-200 text-red-800',
      system: 'bg-gray-50 border-gray-200 text-gray-800',
      document: 'bg-orange-50 border-orange-200 text-orange-800',
      custom: 'bg-indigo-50 border-indigo-200 text-indigo-800',
      other: 'bg-slate-50 border-slate-200 text-slate-800'
    }
    return colors[category] || colors.other
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={handleBackdropClick}
        />
        
        {/* Modal Container */}
        <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
          <div 
            className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white rounded-t-lg">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Available Placeholders
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Browse all fields you can use in your DOCX templates
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

            {/* Tabs */}
            <div className="border-b border-gray-200 bg-gray-50 px-6">
              <div className="flex space-x-1">
              <button
                onClick={() => {
                  setActiveTab('client')
                  setIsEditMode(false) // Reset edit mode when switching tabs
                }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'client'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                Client Fields
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700">
                  {clientFields.length}
                </span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('custom')
                  setIsEditMode(false) // Reset edit mode when switching tabs
                }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'custom'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                Custom Fields
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700">
                  {customFields.length}
                </span>
              </button>
              </div>
            </div>

            {/* Search and Actions */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder={`Search ${activeTab} fields...`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                {/* Add Custom Field Button (only in custom tab) */}
                {activeTab === 'custom' && (
                  <button
                    onClick={handleCreateCustomField}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 whitespace-nowrap"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Custom Field
                  </button>
                )}
              </div>
            </div>

            {/* Fields List */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3">Loading placeholders...</span>
                </div>
              ) : filteredFields.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-gray-900">
                    {activeTab === 'custom' && customFields.length === 0
                      ? 'No custom fields yet'
                      : 'No placeholders found'}
                  </h3>
                  <p className="mt-1 text-gray-600">
                    {activeTab === 'custom' && customFields.length === 0
                      ? 'Create your first custom field to get started.'
                      : searchTerm 
                        ? 'Try adjusting your search criteria.' 
                        : 'No placeholders are available.'}
                  </p>
                  {activeTab === 'custom' && customFields.length === 0 && (
                    <button
                      onClick={handleCreateCustomField}
                      className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Custom Field
                    </button>
                  )}
                </div>
              ) : activeTab === 'client' ? (
                // Client fields grouped by category
                <div className="space-y-6">
                  {Object.entries(groupedFields).map(([category, categoryFields]) => (
                    <div key={category}>
                      {/* Category Header */}
                      <div className={`px-3 py-2 rounded-lg text-sm font-medium border ${getCategoryColor(category)} mb-3`}>
                        {getCategoryIcon(category)} {category.charAt(0).toUpperCase() + category.slice(1)}
                        <span className="ml-2 text-xs opacity-75">({categoryFields.length})</span>
                      </div>
                      
                      {/* Category Fields Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                        {categoryFields.map((field) => (
                          <button
                            key={field.name}
                            onClick={() => handleFieldSelect(field)}
                            className="text-left p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 flex items-center text-sm">
                                  {field.label}
                                  {field.computed && (
                                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                      computed
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                  {field.description || 'No description available'}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded">
                              {`{${field.name}}`}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Custom fields simple grid
                <div>
                  {/* Edit Mode Toggle */}
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => setIsEditMode(!isEditMode)}
                      className={`inline-flex items-center px-3 py-1.5 text-sm rounded-md transition-colors ${
                        isEditMode
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      {isEditMode ? 'Done Editing' : 'Edit Fields'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredFields.map((field) => (
                      <div
                        key={field.name}
                        className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 text-sm">
                              {field.label}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {field.description || 'No description'}
                            </div>
                          </div>
                        </div>
                        
                        <div 
                          onClick={() => handleFieldSelect(field)}
                          className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded mb-3 cursor-pointer hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        >
                          {`{${field.name}}`}
                        </div>

                        {/* Action Buttons - Only show in edit mode */}
                        {isEditMode && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditCustomField(field)}
                              className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                            >
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCustomField(field)}
                              className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs border border-red-300 rounded text-red-700 hover:bg-red-50"
                            >
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-600">
                {filteredFields.length} placeholder{filteredFields.length !== 1 ? 's' : ''} available
                {searchTerm && ` (filtered from ${activeFields.length})`}
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Field Modal */}
      <CustomFieldModal
        isOpen={showCustomFieldModal}
        onClose={() => {
          setShowCustomFieldModal(false)
          setEditingCustomField(null)
        }}
        field={editingCustomField}
        onSuccess={handleCustomFieldSuccess}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && fieldToDelete && (
        <div className="fixed inset-0 z-[60] overflow-hidden">
          <div 
            className="fixed inset-0 bg-black/60 transition-opacity"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          />
          
          <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
            <div 
              className="relative bg-white rounded-lg shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3l-7.93-13.743a2 2 0 00-3.464 0L1.732 18c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Delete Custom Field</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <span className="font-medium text-gray-900">"{fieldToDelete.label}"</span>? 
                This action cannot be undone and may affect templates using this placeholder.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setFieldToDelete(null)
                  }}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteCustomField}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete Field'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}