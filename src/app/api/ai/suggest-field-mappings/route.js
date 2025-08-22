// src/app/api/ai/suggest-field-mappings/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { AITemplateMappingService } from '@/lib/services/aiTemplateMappingService'
import { DocumentProcessingService } from '@/lib/services/documentProcessingService'

export async function POST(request) {
  try {
    // Check authentication
    await requireAuth()

    const { htmlContent, templateId } = await request.json()

    if (!htmlContent) {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      )
    }

    console.log("Getting available fields...")
    // Get available fields
    const availableFields = DocumentProcessingService.getAvailableFields()

    console.log("Getting field mappings...")
    // Get AI suggestions
    const result = await AITemplateMappingService.suggestFieldMappings(
      htmlContent,
      availableFields
    )

    console.log('Done...')
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      enhancedHtml: result.enhancedHtml,
      changes: result.changes,
      fieldCount: result.fieldCount,
      availableFields
    })

  } catch (error) {
    console.error('Error getting AI field suggestions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get AI suggestions' },
      { status: 500 }
    )
  }
}