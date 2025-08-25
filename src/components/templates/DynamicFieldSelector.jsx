// src/components/templates/DynamicFieldSelector.js
'use client'

import { useState, useEffect } from 'react'

export default function DynamicFieldSelector({ 
  onFieldSelect, 
  selectedText = '', 
  clickPosition = null,
  availableFields = null, // New prop to receive fields from parent
  onClose 
}) {
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [categories, setCategories] = useState([])

  useEffect(() => {
    if (availableFields && availableFields.length > 0) {
      // Use fields passed from parent (includes custom fields)
      console.log('Using available fields from parent:', availableFields.length, 'fields')
      setFields(availableFields)
      
      // Extract unique categories
      const uniqueCategories = [...new Set(availableFields.map(f => f.category))].sort()
      setCategories(uniqueCategories)
      setLoading(false)
    } else {
      // Fallback: fetch fields if none provided
      fetchAvailableFields()
    }
  }, [availableFields])

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
      // Fallback to basic fields
      setFields([
        { name: 'first_name', label: 'First Name', description: 'Client first name', category: 'personal' },
        { name: 'last_name', label: 'Last Name', description: 'Client last name', category: 'personal' },
        { name: 'full_name', label: 'Full Name', description: 'Complete client name', category: 'personal', computed: true },
        { name: 'email', label: 'Email', description: 'Client email address', category: 'contact' },
        { name: 'phone', label: 'Phone', description: 'Client phone number', category: 'contact' }
      ])
      setCategories(['personal', 'contact'])
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
      custom: 'bg-indigo-50 border-indigo-200 text-indigo-800',
      other: 'bg-slate-50 border-slate-200 text-slate-800'
    }
    return colors[category] || colors.other
  }

  return (
    <div className="bg-white border rounded-lg shadow-lg p-4 max-w-md w-full max-h-[50vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900">
          {selectedText ? 'Replace with Field' : 'Insert Field'}
        </h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Selected Text Preview */}
      {selectedText && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
          <span className="font-medium text-yellow-800">Selected: </span>
          <span className="text-yellow-700">"{selectedText}"</span>
        </div>
      )}

      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-3">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>
              {getCategoryIcon(category)} {category.charAt(0).toUpperCase() + category.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Fields List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">Loading fields...</span>
          </div>
        ) : filteredFields.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500">
            No fields found matching your search.
          </div>
        ) : (
          Object.entries(groupedFields).map(([category, categoryFields]) => (
            <div key={category} className="space-y-1">
              {/* Category Header */}
              <div className={`px-2 py-1 rounded text-xs font-medium border ${getCategoryColor(category)}`}>
                {getCategoryIcon(category)} {category.charAt(0).toUpperCase() + category.slice(1)}
                {category === 'custom' && (
                  <span className="ml-1 text-xs opacity-75">({categoryFields.length})</span>
                )}
              </div>
              
              {/* Category Fields */}
              <div className="space-y-1 ml-2">
                {categoryFields.map((field) => (
                  <button
                    key={field.name}
                    onClick={() => onFieldSelect(field.name)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 focus:outline-none focus:bg-blue-50 focus:border-blue-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 flex items-center">
                          {field.label}
                          {field.computed && (
                            <span className="ml-1 px-1 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                              computed
                            </span>
                          )}
                          {field.custom && (
                            <span className="ml-1 px-1 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded">
                              custom
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {field.description}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                          {`{{${field.name}}}`}
                        </div>
                      </div>
                      <div className="ml-2 flex-shrink-0">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Field Stats */}
      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500 text-center">
        {filteredFields.length} field{filteredFields.length !== 1 ? 's' : ''} available
        {searchTerm && ` (filtered from ${fields.length})`}
        {availableFields && (
          <div className="mt-1">
            <span className="text-indigo-600">
              {fields.filter(f => f.custom).length} custom field{fields.filter(f => f.custom).length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}