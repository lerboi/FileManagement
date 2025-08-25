// src/components/templates/CustomFieldPreview.jsx
'use client'

export default function CustomFieldPreview({ field }) {
  if (!field || !field.type) {
    return (
      <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
        <p className="text-sm">Configure field settings to see preview</p>
      </div>
    )
  }

  const renderPreviewField = () => {
    const baseClasses = "block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
    
    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            placeholder={field.placeholder || `Enter ${field.label?.toLowerCase() || 'text'}`}
            defaultValue={field.defaultValue || ''}
            className={baseClasses}
            disabled
          />
        )
        
      case 'textarea':
        return (
          <textarea
            rows={3}
            placeholder={field.placeholder || `Enter ${field.label?.toLowerCase() || 'text'}`}
            defaultValue={field.defaultValue || ''}
            className={baseClasses}
            disabled
          />
        )
        
      case 'number':
        return (
          <input
            type="number"
            placeholder={field.placeholder || '0'}
            defaultValue={field.defaultValue || ''}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.step || 1}
            className={baseClasses}
            disabled
          />
        )
        
      case 'date':
        return (
          <input
            type="date"
            defaultValue={field.defaultValue || ''}
            className={baseClasses}
            disabled
          />
        )
        
      case 'dropdown':
        return (
          <select className={baseClasses} disabled>
            <option value="">Select {field.label?.toLowerCase() || 'option'}...</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )
        
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              defaultChecked={field.defaultValue || false}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled
            />
            <span className="text-sm text-gray-700">
              {field.checkboxLabel || field.label}
            </span>
          </div>
        )
        
      case 'currency':
        return (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              type="number"
              placeholder="0.00"
              defaultValue={field.defaultValue || ''}
              step="0.01"
              className={`${baseClasses} pl-7`}
              disabled
            />
          </div>
        )
        
      case 'percentage':
        return (
          <div className="relative">
            <input
              type="number"
              placeholder="0"
              defaultValue={field.defaultValue || ''}
              min="0"
              max="100"
              step="0.01"
              className={`${baseClasses} pr-8`}
              disabled
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">%</span>
            </div>
          </div>
        )
        
      default:
        return (
          <div className="p-3 bg-gray-100 rounded border text-gray-500 text-sm">
            Preview not available for this field type
          </div>
        )
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Field Preview</h4>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {field.label || 'Field Label'}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          
          {field.description && (
            <p className="text-xs text-gray-500 mb-2">{field.description}</p>
          )}
          
          {renderPreviewField()}
          
          {field.validation?.message && (
            <p className="text-xs text-gray-500 mt-1">
              {field.validation.message}
            </p>
          )}
        </div>
      </div>
      
      {/* Field Properties Summary */}
      <div className="bg-gray-50 border rounded-lg p-3">
        <h5 className="text-xs font-medium text-gray-700 mb-2">Field Properties</h5>
        <div className="space-y-1 text-xs text-gray-600">
          <div><span className="font-medium">Type:</span> {field.type}</div>
          <div><span className="font-medium">Name:</span> {field.name || 'auto-generated'}</div>
          <div><span className="font-medium">Required:</span> {field.required ? 'Yes' : 'No'}</div>
          {field.category && (
            <div><span className="font-medium">Category:</span> {field.category}</div>
          )}
          {field.validation?.min !== undefined && (
            <div><span className="font-medium">Min:</span> {field.validation.min}</div>
          )}
          {field.validation?.max !== undefined && (
            <div><span className="font-medium">Max:</span> {field.validation.max}</div>
          )}
        </div>
      </div>
    </div>
  )
}