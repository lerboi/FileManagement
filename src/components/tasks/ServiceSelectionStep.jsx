// src/components/tasks/ServiceSelectionStep.jsx
'use client'

import { useState, useMemo } from 'react'

export default function ServiceSelectionStep({ 
  services = [], 
  selectedService, 
  onServiceSelect 
}) {
  const [searchTerm, setSearchTerm] = useState('')

  // Filter services based on search
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           service.description?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch && service.is_active
    })
  }, [services, searchTerm])

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusIcon = (service) => {
    if (!service.is_active) {
      return (
        <div className="w-3 h-3 bg-gray-400 rounded-full" title="Inactive"></div>
      )
    }
    if (service.has_missing_templates) {
      return (
        <div className="w-3 h-3 bg-red-500 rounded-full" title="Missing templates"></div>
      )
    }
    if (service.has_inactive_templates) {
      return (
        <div className="w-3 h-3 bg-yellow-500 rounded-full" title="Has inactive templates"></div>
      )
    }
    return (
      <div className="w-3 h-3 bg-green-500 rounded-full" title="Ready"></div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Select a Service
        </h3>
        <p className="text-gray-600">
          Choose the service bundle that contains the document templates you need for this task.
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Services List */}
      <div className="space-y-3">
        {filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Services Available</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm 
                ? 'No services match your search criteria.' 
                : 'No active services found. Please create a service first.'
              }
            </p>
          </div>
        ) : (
          filteredServices.map((service) => (
            <div
              key={service.id}
              onClick={() => onServiceSelect(service)}
              className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                selectedService?.id === service.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-2">
                    {getStatusIcon(service)}
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {service.name}
                    </h4>
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>{service.template_count} template{service.template_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  
                  {service.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {service.description}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Created {formatDate(service.created_at)}
                    </div>
                    
                    {service.validation && (
                      <>
                        {service.validation.activeTemplates.length > 0 && (
                          <div className="flex items-center text-green-600">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {service.validation.activeTemplates.length} active
                          </div>
                        )}
                        
                        {service.validation.inactiveTemplates.length > 0 && (
                          <div className="flex items-center text-yellow-600">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {service.validation.inactiveTemplates.length} inactive
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Warnings for services with issues */}
                  {service.has_inactive_templates && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                      <div className="flex items-start">
                        <svg className="w-3 h-3 text-yellow-600 mt-0.5 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-yellow-800">
                          <p className="font-medium">Some templates are inactive</p>
                          <p>Some documents may not be generated. Please check service configuration.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Selection indicator */}
                <div className="ml-4 flex-shrink-0">
                  {selectedService?.id === service.id ? (
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Selection summary */}
      {selectedService && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Service Selected: {selectedService.name}</p>
              <p>
                This task will be able to generate {selectedService.template_count} document{selectedService.template_count !== 1 ? 's' : ''}.
                {selectedService.validation?.activeTemplates?.length && (
                  <span className="ml-1">
                    ({selectedService.validation.activeTemplates.length} active template{selectedService.validation.activeTemplates.length !== 1 ? 's' : ''})
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Service count info */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        Showing {filteredServices.length} of {services.filter(s => s.is_active).length} active services
        {searchTerm && ` matching "${searchTerm}"`}
      </div>
    </div>
  )
}