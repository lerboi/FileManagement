// src/app/api/services/preview/custom-fields/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { ServiceTemplateService } from '@/lib/services/serviceTemplateService'

// POST - Get aggregated custom fields preview for template selection
export async function POST(request) {
  try {
    // Check authentication
    await requireSession()
    
    const { template_ids } = await request.json()
    
    if (!template_ids || !Array.isArray(template_ids)) {
      return NextResponse.json(
        { error: 'template_ids must be an array' },
        { status: 400 }
      )
    }
    
    // Get aggregated custom fields
    const result = await ServiceTemplateService.getAggregatedCustomFields(template_ids)
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      customFields: result.customFields,
      fieldsByTemplate: result.fieldsByTemplate,
      stats: result.stats,
      conflicts: result.conflicts || []
    })
  } catch (error) {
    console.error('Error getting custom fields preview:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get custom fields preview' },
      { status: 500 }
    )
  }
}