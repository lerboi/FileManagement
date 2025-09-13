// src/app/templates/page.js
'use client'
import TemplateEditorModal from '@/components/templates/TemplateEditorModal'
import TemplateUploadModal from '@/components/templates/TemplateUploadModal'
import PlaceholderLibrary from '@/components/templates/PlaceholderLibrary'
import { useState, useEffect } from 'react'
import DocumentGeneratorModal from '@/components/documents/DocumentGeneratorModal'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState(null)
  const [editingStatus, setEditingStatus] = useState(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedTemplateForGeneration, setSelectedTemplateForGeneration] = useState(null)
  const [showEditorModal, setShowEditorModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showPlaceholderLibrary, setShowPlaceholderLibrary] = useState(false)
  
  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/templates')
      
      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }
      
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUploadComplete = (template) => {
    setTemplates(prev => [template, ...prev])
    setSelectedTemplate(template)
    setShowEditorModal(true)
  }

  const handleEditTemplate = (template) => {
    setSelectedTemplate(template)
    setShowEditorModal(true)
  }

  const handleCloseEditor = () => {
    setShowEditorModal(false)
    setSelectedTemplate(null)
    fetchTemplates() // Refresh templates list
  }

  const handleSaveTemplate = async (templateData) => {
    try {
      const response = await fetch('/api/templates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData)
      })

      if (!response.ok) {
        throw new Error('Failed to save template')
      }

      const result = await response.json()
      
      // Update templates list
      setTemplates(prev => prev.map(t => 
        t.id === result.template.id ? result.template : t
      ))
      
      setShowEditorModal(false)
      setSelectedTemplate(null)
      
      // Show success message
      showSuccessMessage('Template saved successfully!')
    } catch (error) {
      throw error
    }
  }

  const handleDeleteTemplate = async (templateId) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete template')
      }

      // Remove from templates list
      setTemplates(prev => prev.filter(t => t.id !== templateId))
      setShowDeleteModal(false)
      setTemplateToDelete(null)
      
      showSuccessMessage('Template deleted successfully!')
    } catch (error) {
      alert('Failed to delete template: ' + error.message)
    }
  }

  const handleStatusChange = async (templateId, newStatus) => {
    try {
      const response = await fetch('/api/templates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: templateId,
          status: newStatus
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      const result = await response.json()
      
      // Update templates list
      setTemplates(prev => prev.map(t => 
        t.id === templateId ? { ...t, status: newStatus } : t
      ))
      
      setEditingStatus(null)
      showSuccessMessage(`Template status updated to ${newStatus}!`)
    } catch (error) {
      alert('Failed to update status: ' + error.message)
    }
  }

  const handleGenerateDocument = (template) => {
    setSelectedTemplateForGeneration(template)
    setShowGenerateModal(true)
  }

  const handleCloseGenerateModal = () => {
    setShowGenerateModal(false)
    setSelectedTemplateForGeneration(null)
  }

  const showSuccessMessage = (message) => {
    // Create and show a temporary success message
    const successDiv = document.createElement('div')
    successDiv.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50'
    successDiv.textContent = message
    document.body.appendChild(successDiv)
    
    setTimeout(() => {
      if (document.body.contains(successDiv)) {
        document.body.removeChild(successDiv)
      }
    }, 3000)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Filter and sort templates
  const filteredTemplates = templates
    .filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           template.description?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || template.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.created_at) - new Date(a.created_at)
        case 'oldest': return new Date(a.created_at) - new Date(b.created_at)
        case 'name': return a.name.localeCompare(b.name)
        case 'status': return a.status.localeCompare(b.status)
        default: return 0
      }
    })

  return (
    <div className="p-6">
      {/* Header Actions */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex space-x-3">
          <button
            onClick={() => setShowPlaceholderLibrary(true)}
            className="inline-flex items-center px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Browse Available Placeholders
          </button>
        </div>
        
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload DOCX Template
        </button>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        
        {/* Search and Filters */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
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
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              {/* Status Filter */}
              <div className="lg:w-40">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              
              {/* Sort */}
              <div className="lg:w-40">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name">Name A-Z</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-2xl font-semibold text-gray-900">{templates.length}</p>
                <p className="text-sm text-gray-600">Total Templates</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-2xl font-semibold text-gray-900">{templates.filter(t => t.status === 'active').length}</p>
                <p className="text-sm text-gray-600">Active</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-2xl font-semibold text-gray-900">{templates.filter(t => t.status === 'draft').length}</p>
                <p className="text-sm text-gray-600">Draft</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-2xl font-semibold text-gray-900">{templates.filter(t => t.status === 'archived').length}</p>
                <p className="text-sm text-gray-600">Archived</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Templates List */}
        <div className="bg-white rounded-lg shadow-sm border">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3">Loading templates...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">No templates found</h3>
              <p className="mt-1 text-sm text-gray-600">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.' 
                  : 'Get started by uploading your first DOCX template.'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Upload Your First Template
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredTemplates.map((template) => (
                <div key={template.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-900 truncate">
                          {template.name}
                        </h4>
                        {editingStatus === template.id ? (
                          <select
                            value={template.status}
                            onChange={(e) => handleStatusChange(template.id, e.target.value)}
                            onBlur={() => setEditingStatus(null)}
                            autoFocus
                            className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingStatus(template.id)}
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(template.status)}`}
                          >
                            {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
                          </button>
                        )}
                      </div>
                      
                      {template.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {template.original_filename || 'Template.docx'}
                        </div>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatDate(template.created_at)}
                        </div>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a1.994 1.994 0 01-1.414.586H7a4 4 0 01-4-4V7a4 4 0 014-4z" />
                          </svg>
                          DOCX Template
                        </div>
                        {template.detected_placeholders && template.detected_placeholders.length > 0 && (
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            {template.detected_placeholders.length} placeholders
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 ml-6">
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </button>
                      
                      {template.status === 'active' && (
                        <button
                          onClick={() => handleGenerateDocument(template)}
                          className="inline-flex items-center px-3 py-2 border border-green-300 rounded-md text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Generate
                        </button>
                      )}
                      
                      <button
                        onClick={() => {
                          setTemplateToDelete(template)
                          setShowDeleteModal(true)
                        }}
                        className="inline-flex items-center p-2 text-red-600 hover:bg-red-50 rounded-md"
                        title="Delete template"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Status Warning */}
                  {template.status === 'draft' && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex">
                        <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div className="text-sm text-yellow-800">
                          <p className="font-medium">Template is in draft mode</p>
                          <p>Activate this template to enable document generation.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Document Generator Modal */}
      {showGenerateModal && selectedTemplateForGeneration && (
        <DocumentGeneratorModal
          isOpen={showGenerateModal}
          onClose={handleCloseGenerateModal}
          template={selectedTemplateForGeneration}
        />
      )}

      {/* Delete Modal */}
      {showDeleteModal && templateToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Delete Template</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-medium text-gray-900">{templateToDelete.name}</span>? 
              This action cannot be undone and will permanently remove the template and all its data.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setTemplateToDelete(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTemplate(templateToDelete.id)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Upload Modal */}
      <TemplateUploadModal
        isOpen={showUploadModal}
        onUploadComplete={handleUploadComplete}
        onClose={() => setShowUploadModal(false)}
      />

      {/* Template Editor Modal */}
      <TemplateEditorModal
        isOpen={showEditorModal}  
        template={selectedTemplate}
        onSave={handleSaveTemplate}
        onClose={handleCloseEditor}
      />

      {/* Placeholder Library Modal */}
      <PlaceholderLibrary
        isOpen={showPlaceholderLibrary}
        onClose={() => setShowPlaceholderLibrary(false)}
        onSelectPlaceholder={(field) => {
          // Copy placeholder to clipboard
          navigator.clipboard.writeText(`{${field.name}}`).then(() => {
            showSuccessMessage(`Placeholder {${field.name}} copied to clipboard!`)
          })
        }}
      />
    </div>
  )
}