// src/app/api/templates/selection/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { ServiceTemplateService } from '@/lib/services/serviceTemplateService'

// GET - Get active templates available for service selection
export async function GET(request) {
  try {
    // Check authentication
    await requireSession()
    
    const { searchParams } = new URL(request.url)
    const groupByType = searchParams.get('groupByType') === 'true'
    
    if (groupByType) {
      const result = await ServiceTemplateService.getTemplatesByType()
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        templatesByType: result.templatesByType,
        types: result.types,
        totalTemplates: result.totalTemplates
      })
    } else {
      const result = await ServiceTemplateService.getActiveTemplatesForSelection()
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        templates: result.templates,
        total: result.total
      })
    }
  } catch (error) {
    console.error('Error fetching templates for selection:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// POST - Validate template selection and get preview
export async function POST(request) {
  try {
    // Check authentication
    await requireSession()
    
    const { template_ids, action = 'validate' } = await request.json()
    
    if (!template_ids || !Array.isArray(template_ids)) {
      return NextResponse.json(
        { error: 'template_ids must be an array' },
        { status: 400 }
      )
    }
    
    if (action === 'preview') {
      // Get service generation preview
      const result = await ServiceTemplateService.getServiceGenerationPreview(template_ids)
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        )
      }
      
      return NextResponse.json({
        success: true,
        preview: result.preview
      })
    } else {
      // Default: validate template selection
      const result = await ServiceTemplateService.validateTemplateSelection(template_ids)
      
      if (!result.valid) {
        return NextResponse.json(
          { 
            error: result.error,
            stats: result.stats 
          },
          { status: 400 }
        )
      }
      
      return NextResponse.json({
        success: true,
        valid: result.valid,
        templates: result.templates,
        customFields: result.customFields,
        warnings: result.warnings || [],
        stats: result.stats
      })
    }
  } catch (error) {
    console.error('Error processing template selection:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process template selection' },
      { status: 500 }
    )
  }
}