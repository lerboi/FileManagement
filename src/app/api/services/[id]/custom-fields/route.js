// src/app/api/services/[id]/custom-fields/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { ServiceManagementService } from '@/lib/services/serviceManagementService'
import { ServiceTemplateService } from '@/lib/services/serviceTemplateService'

// GET - Get aggregated custom fields from all service templates
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
    
    // Get service
    const service = await ServiceManagementService.getServiceById(id, false)
    
    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      )
    }
    
    // Get aggregated custom fields
    const result = await ServiceTemplateService.getAggregatedCustomFields(service.template_ids || [])
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      service: {
        id: service.id,
        name: service.name,
        template_count: service.template_ids ? service.template_ids.length : 0
      },
      customFields: result.customFields,
      fieldsByTemplate: result.fieldsByTemplate,
      stats: result.stats,
      conflicts: result.conflicts || []
    })
  } catch (error) {
    console.error('Error fetching service custom fields:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch service custom fields' },
      { status: 500 }
    )
  }
}