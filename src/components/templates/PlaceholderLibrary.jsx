// src/components/templates/PlaceholderLibrary.jsx
'use client'

import { useState, useEffect } from 'react'

export default function PlaceholderLibrary({ isOpen, onClose, onSelectPlaceholder }) {
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [categories, setCategories] = useState([])

  useEffect(() => {
    if (isOpen) {
      fetchAvailableFields()
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
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
  }, [isOpen, onClose])

  const fetchAvailableFields = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/fields/schema')
      if (!response.ok) throw new Error('Failed to fetch fields')
      
      const data = await response.json()
      setFields(data.fields || [])
      
      // Extract unique categories
      const uniqueCategories = [...new Set(data.fields?.map(f => f.category) || [])]
      setCategories(uniqueCategories.sort())
      
    } catch (error) {
      console.error('Error fetching fields:', error)
      setFields([])
    } finally {
      setLoading(false)
    }
  }

  const filteredFields = fields.filter(field => {
    const matchesSearch = field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         field.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = selectedCategory === 'all' || field.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  const groupedFields = filteredFields.reduce((groups, field) => {
    const category = field.category || 'other'
    if (!groups[category]) groups[category] = []
    groups[category].push(field)
    return groups
  }, {})

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

  const handleFieldSelect = (field) => {
    if (onSelectPlaceholder) {
      onSelectPlaceholder(field)
    }
    onClose()
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

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

          {/* Search and Filters */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
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
                    placeholder="Search placeholders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              {/* Category Filter */}
              <div className="lg:w-48">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {getCategoryIcon(category)} {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
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
                <h3 className="mt-2 text-lg font-medium text-gray-900">No placeholders found</h3>
                <p className="mt-1 text-gray-600">
                  {searchTerm ? 'Try adjusting your search criteria.' : 'No placeholders are available.'}
                </p>
              </div>
            ) : (
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
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              {filteredFields.length} placeholder{filteredFields.length !== 1 ? 's' : ''} available
              {searchTerm && ` (filtered from ${fields.length})`}
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
  )
}