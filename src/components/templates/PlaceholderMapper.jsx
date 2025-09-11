// src/components/templates/PlaceholderMapper.jsx
'use client'

import { useState, useEffect } from 'react'

export default function PlaceholderMapper({ 
  detectedPlaceholders = [], 
  validationResult = null,
  onMappingComplete,
  onCancel 
}) {
  const [availableFields, setAvailableFields] = useState([])
  const [mappings, setMappings] = useState({})
  const [loading, setLoading] = useState(false)
  const [searchTerms, setSearchTerms] = useState({})

  useEffect(() => {
    fetchAvailableFields()
    initializeMappings()
  }, [detectedPlaceholders, validationResult])

  const fetchAvailableFields = async () => {
    try {
      const response = await fetch('/api/fields/schema')
      if (response.ok) {
        const data = await response.json()
        setAvailableFields(data.fields || [])
      }
    } catch (error) {
      console.error('Error fetching available fields:', error)
      setAvailableFields([])
    }
  }

  const initializeMappings = () => {
    const initialMappings = {}
    
    if (validationResult?.validPlaceholders) {
      // Auto-map valid placeholders
      validationResult.validPlaceholders.forEach(placeholder => {
        initialMappings[placeholder.name] = placeholder.field.name
      })
    }
    
    if (validationResult?.invalidPlaceholders) {
      // Set suggestions for invalid placeholders
      validationResult.invalidPlaceholders.forEach(placeholder => {
        initialMappings[placeholder.name] = placeholder.suggestion || ''
      })
    }
    
    setMappings(initialMappings)
  }

  const handleMappingChange = (placeholderName, fieldName) => {
    setMappings(prev => ({
      ...prev,
      [placeholderName]: fieldName
    }))
  }

  const handleSearchChange = (placeholderName, searchTerm) => {
    setSearchTerms(prev => ({
      ...prev,
      [placeholderName]: searchTerm
    }))
  }

  const getFilteredFields = (placeholderName) => {
    const searchTerm = searchTerms[placeholderName] || ''
    if (!searchTerm) return availableFields
    
    return availableFields.filter(field =>
      field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  const isValidMapping = () => {
    return detectedPlaceholders.every(placeholder => {
      const mappedField = mappings[placeholder]
      return mappedField && availableFields.some(field => field.name === mappedField)
    })
  }

  const getPlaceholderStatus = (placeholderName) => {
    if (validationResult?.validPlaceholders?.some(p => p.name === placeholderName)) {
      return 'valid'
    }
    if (validationResult?.invalidPlaceholders?.some(p => p.name === placeholderName)) {
      return 'invalid'
    }
    return 'unknown'
  }

  const handleComplete = () => {
    if (!isValidMapping()) {
      alert('Please map all placeholders to valid fields before continuing.')
      return
    }

    const finalMappings = {}
    detectedPlaceholders.forEach(placeholder => {
      const mappedField = mappings[placeholder]
      if (mappedField) {
        finalMappings[`{${placeholder}}`] = mappedField
      }
    })

    if (onMappingComplete) {
      onMappingComplete(finalMappings)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Map Template Placeholders
        </h3>
        <p className="text-sm text-gray-600">
          Your DOCX template contains {detectedPlaceholders.length} placeholder{detectedPlaceholders.length !== 1 ? 's' : ''}. 
          Map each placeholder to the corresponding database field.
        </p>
      </div>

      {/* Validation Summary */}
      {validationResult && (
        <div className="mb-6 p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">Validation Results</h4>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-green-600">
                ✓ {validationResult.validCount} valid
              </span>
              {validationResult.invalidCount > 0 && (
                <span className="text-red-600">
                  ✗ {validationResult.invalidCount} invalid
                </span>
              )}
            </div>
          </div>
          
          {validationResult.invalidCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800 mb-2">
                <strong>Invalid placeholders found:</strong> These need to be mapped to valid fields.
              </p>
              <ul className="text-sm text-red-700 space-y-1">
                {validationResult.invalidPlaceholders.map(placeholder => (
                  <li key={placeholder.name} className="flex items-center">
                    <code className="bg-red-100 px-1 rounded">{`{${placeholder.name}}`}</code>
                    {placeholder.suggestion && (
                      <span className="ml-2 text-xs">
                        → Suggested: <code className="bg-green-100 px-1 rounded">{placeholder.suggestion}</code>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Mapping Interface */}
      <div className="space-y-4 mb-6">
        {detectedPlaceholders.map((placeholder) => {
          const status = getPlaceholderStatus(placeholder)
          const filteredFields = getFilteredFields(placeholder)
          const selectedField = availableFields.find(f => f.name === mappings[placeholder])
          
          return (
            <div
              key={placeholder}
              className={`p-4 rounded-lg border-2 ${
                status === 'valid' ? 'border-green-200 bg-green-50' :
                status === 'invalid' ? 'border-red-200 bg-red-50' :
                'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start space-x-4">
                {/* Placeholder Info */}
                <div className="flex-shrink-0 w-48">
                  <div className="flex items-center space-x-2 mb-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {`{${placeholder}}`}
                    </code>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      status === 'valid' ? 'bg-green-100 text-green-700' :
                      status === 'invalid' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {status}
                    </span>
                  </div>
                  {status === 'invalid' && validationResult?.invalidPlaceholders?.find(p => p.name === placeholder)?.suggestion && (
                    <p className="text-xs text-gray-600">
                      Suggested: {validationResult.invalidPlaceholders.find(p => p.name === placeholder).suggestion}
                    </p>
                  )}
                </div>

                {/* Field Selection */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Map to database field:
                  </label>
                  
                  {/* Search Input */}
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="Search fields..."
                      value={searchTerms[placeholder] || ''}
                      onChange={(e) => handleSearchChange(placeholder, e.target.value)}
                      className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Field Selection Dropdown */}
                  <select
                    value={mappings[placeholder] || ''}
                    onChange={(e) => handleMappingChange(placeholder, e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a field...</option>
                    {filteredFields.map((field) => (
                      <option key={field.name} value={field.name}>
                        {field.label} ({field.name})
                        {field.computed && ' - computed'}
                      </option>
                    ))}
                  </select>

                  {/* Selected Field Info */}
                  {selectedField && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                      <p className="font-medium text-blue-900">{selectedField.label}</p>
                      <p className="text-blue-700">{selectedField.description}</p>
                      <p className="text-blue-600 text-xs">
                        Category: {selectedField.category}
                        {selectedField.computed && ' • Computed field'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          onClick={handleComplete}
          disabled={loading || !isValidMapping()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            'Complete Mapping'
          )}
        </button>
      </div>

      {/* Mapping Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Mapping Summary</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• {detectedPlaceholders.length} total placeholders</p>
          <p>• {Object.values(mappings).filter(Boolean).length} mapped</p>
          <p>• {detectedPlaceholders.length - Object.values(mappings).filter(Boolean).length} remaining</p>
          {isValidMapping() ? (
            <p className="text-green-600 font-medium">✓ All placeholders mapped successfully</p>
          ) : (
            <p className="text-red-600 font-medium">✗ Some placeholders still need mapping</p>
          )}
        </div>
      </div>
    </div>
  )
}