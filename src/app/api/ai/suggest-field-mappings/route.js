// src/app/api/ai/suggest-field-mappings/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { AITemplateMappingService } from '@/lib/services/aiTemplateMappingService'
import { DocumentProcessingService } from '@/lib/services/documentProcessingService'

export async function POST(request) {
  console.log('=== AI Field Mapping API Called ===')
  
  try {
    // Check authentication
    console.log('Checking authentication...')
    await requireAuth()
    console.log('Authentication successful')

    const { htmlContent, templateId } = await request.json()
    console.log('Request data received:', {
      hasHtmlContent: !!htmlContent,
      htmlContentLength: htmlContent?.length || 0,
      templateId
    })

    if (!htmlContent) {
      console.error('No HTML content provided')
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      )
    }

    console.log("Getting available fields...")
    // Get available fields
    const availableFields = DocumentProcessingService.getAvailableFields()
    console.log('Available fields count:', availableFields.length)

    console.log("Getting AI field mappings from Mistral...")
    // Get AI suggestions
    const result = await AITemplateMappingService.suggestFieldMappings(
      htmlContent,
      availableFields
    )
    console.log('AI service result:', {
      success: result.success,
      hasEnhancedHtml: !!result.enhancedHtml,
      changesCount: result.changes?.length || 0,
      fieldCount: result.fieldCount || 0,
      error: result.error
    })

    console.log('Processing complete')
    if (!result.success) {
      console.error('AI service failed:', result.error)
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    console.log('Returning successful response')
    return NextResponse.json({
      success: true,
      enhancedHtml: result.enhancedHtml,
      changes: result.changes,
      fieldCount: result.fieldCount,
      availableFields
    })

  } catch (error) {
    console.error('=== ERROR in AI field mapping API ===')
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    
    return NextResponse.json(
      { error: error.message || 'Failed to get AI suggestions' },
      { status: 500 }
    )
  }
}