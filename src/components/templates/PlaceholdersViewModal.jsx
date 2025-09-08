// src/components/templates/PlaceholdersViewModal.jsx
'use client'

import { useState, useEffect } from 'react'

export default function PlaceholdersViewModal({ isOpen, onClose }) {
  const [placeholders, setPlaceholders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')

  useEffect(() => {
    if (isOpen) {
      fetchPlaceholders()
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

  const fetchPlaceholders = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/placeholders')
      
      if (!response.ok) {
        throw new Error('Failed to fetch placeholders')
      }
      
      const data = await response.json()
      setPlaceholders(data.placeholders || [])
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredPlaceholders = placeholders
    .filter(placeholder => 
      placeholder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      placeholder.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      placeholder.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = a[sortBy] || ''
      const bValue = b[sortBy] || ''
      
      if (sortOrder === 'asc') {
        return aValue.localeCompare(bValue)
      } else {
        return bValue.localeCompare(aValue)
      }
    })

  const getFieldTypeIcon = (type) => {
    const icons = {
      text: '📝',
      textarea: '📄',
      number: '🔢',
      date: '📅',
      dropdown: '📋',
      checkbox: '☑️',
      currency: '💰',
      percentage: '📊'
    }
    return icons[type] || '📝'
  }

  const getFieldTypeColor = (type) => {
    const colors = {
      text: 'bg-blue-50 text-blue-700 border-blue-200',
      textarea: 'bg-green-50 text-green-700 border-green-200',
      number: 'bg-purple-50 text-purple-700 border-purple-200',
      date: 'bg-orange-50 text-orange-700 border-orange-200',
      dropdown: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      checkbox: 'bg-pink-50 text-pink-700 border-pink-200',
      currency: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      percentage: 'bg-cyan-50 text-cyan-700 border-cyan-200'
    }
    return colors[type] || 'bg-gray-50 text-gray-700 border-gray-200'
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
          className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white rounded-t-lg">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                All Document Placeholders
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                View and manage all available placeholders for document templates
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
              
              {/* Sort By */}
              <div className="lg:w-40">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="name">Sort by Name</option>
                  <option value="label">Sort by Label</option>
                  <option value="field_type">Sort by Type</option>
                  <option value="created_at">Sort by Created</option>
                </select>
              </div>
              
              {/* Sort Order */}
              <div className="lg:w-32">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="asc">A-Z</option>
                  <option value="desc">Z-A</option>
                </select>
              </div>
            </div>
          </div>

          {/* Modal Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3">Loading placeholders...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="text-red-600 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Placeholders</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={fetchPlaceholders}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            ) : filteredPlaceholders.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">No placeholders found</h3>
                <p className="mt-1 text-gray-600">
                  {searchTerm ? 'Try adjusting your search criteria.' : 'No document placeholders have been created yet.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlaceholders.map((placeholder) => (
                  <div
                    key={placeholder.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">{getFieldTypeIcon(placeholder.field_type)}</span>
                        <div>
                          <h4 className="font-medium text-gray-900 text-sm">{placeholder.label}</h4>
                          <code className="text-xs text-gray-500 bg-gray-100 px-1 rounded">
                            {`{{${placeholder.name}}}`}
                          </code>
                        </div>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getFieldTypeColor(placeholder.field_type)}`}>
                        {placeholder.field_type}
                      </span>
                    </div>
                    
                    {placeholder.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {placeholder.description}
                      </p>
                    )}
                    
                    <div className="text-xs text-gray-500">
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span>{new Date(placeholder.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              {filteredPlaceholders.length} placeholder{filteredPlaceholders.length !== 1 ? 's' : ''} 
              {searchTerm && ` (filtered from ${placeholders.length})`}
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