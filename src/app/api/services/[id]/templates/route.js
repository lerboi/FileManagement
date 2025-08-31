// src/app/api/services/[id]/templates/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { ServiceManagementService } from '@/lib/services/serviceManagementService'
import { ServiceTemplateService } from '@/lib/services/serviceTemplateService'

// GET - Get templates in a service with their custom fields
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireSession()
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      )
    }
    
    const service = await ServiceManagementService.getServiceById(id, true)
    
    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      )
    }
    
    // Get aggregated custom fields
    const customFieldsResult = await ServiceTemplateService.getAggregatedCustomFields(service.template_ids || [])
    
    return NextResponse.json({
      success: true,
      service: {
        id: service.id,
        name: service.name,
        description: service.description
      },
      templates: service.templates || [],
      customFields: customFieldsResult.customFields,
      fieldsByTemplate: customFieldsResult.fieldsByTemplate,
      stats: customFieldsResult.stats,
      conflicts: customFieldsResult.conflicts || [],
      validation: service.validation
    })
  } catch (error) {
    console.error('Error fetching service templates:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch service templates' },
      { status: 500 }
    )
  }
}

// PUT - Update service template selection
export async function PUT(request, { params }) {
  try {
    // Check authentication
    await requireSession()
    
    const { id } = await params
    const { template_ids } = await request.json()
    
    if (!id) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      )
    }
    
    if (!template_ids || !Array.isArray(template_ids)) {
      return NextResponse.json(
        { error: 'template_ids must be an array' },
        { status: 400 }
      )
    }
    
    const result = await ServiceManagementService.updateService(id, { template_ids })
    
    if (!result.success) {
      if (result.error === 'Service not found') {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }
    
    const response = {
      success: true,
      service: result.service
    }
    
    if (result.warnings && result.warnings.length > 0) {
      response.warnings = result.warnings
    }
    
    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('Error updating service templates:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update service templates' },
      { status: 500 }
    )
  }
}