// src/app/api/templates/upload/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { DocxParsingService } from '@/lib/services/docxParsingService'
import { createServerSupabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    // Check authentication
    await requireSession()

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file')
    const name = formData.get('name')
    const description = formData.get('description')
    const placeholderMappings = formData.get('placeholderMappings')

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.docx') && !file.name.toLowerCase().endsWith('.doc')) {
      return NextResponse.json(
        { error: 'Only Word documents (.doc, .docx) are supported' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Process DOCX template
    const processingResult = await DocxParsingService.processDocxTemplate(
      buffer,
      file.name,
      { name, description }
    )

    if (!processingResult.success) {
      // If upload is blocked due to invalid placeholders, return detailed error
      if (processingResult.blockUpload) {
        return NextResponse.json({
          error: processingResult.error,
          validation: processingResult.validation,
          blockUpload: true
        }, { status: 400 })
      }
      
      return NextResponse.json(
        { error: 'Failed to process template: ' + processingResult.error },
        { status: 500 }
      )
    }

    // Handle placeholder mappings if provided (for retry uploads)
    if (placeholderMappings) {
      try {
        const mappings = JSON.parse(placeholderMappings)
        console.log('Applied placeholder mappings:', mappings)
        
        // Update template data with corrected mappings
        processingResult.templateData.placeholder_mappings = mappings
        
        // Re-validate with mappings applied
        const mappedPlaceholders = Object.keys(mappings).map(placeholder => 
          placeholder.replace(/[{}]/g, '') // Remove braces from placeholder
        )
        
        const revalidationResult = await DocxParsingService.validatePlaceholders(mappedPlaceholders)
        
        if (!revalidationResult.success || !revalidationResult.valid) {
          return NextResponse.json({
            error: 'Some mapped placeholders are still invalid',
            validation: revalidationResult,
            blockUpload: true
          }, { status: 400 })
        }
        
        // Update validation result
        processingResult.validation = revalidationResult
        
      } catch (error) {
        console.error('Error parsing placeholder mappings:', error)
        return NextResponse.json(
          { error: 'Invalid placeholder mappings format' },
          { status: 400 }
        )
      }
    }

    // Save template to database
    const supabase = await createServerSupabase()
    const { data: savedTemplate, error: saveError } = await supabase
      .from('document_templates')
      .insert([processingResult.templateData])
      .select()
      .single()

    if (saveError) {
      console.error('Template save error:', saveError)
      
      // Clean up uploaded file if database save fails
      if (processingResult.storage?.filePath) {
        try {
          await supabase.storage
            .from('document-templates')
            .remove([processingResult.storage.filePath])
          console.log('Cleaned up uploaded file after database error')
        } catch (cleanupError) {
          console.error('Failed to cleanup file after database error:', cleanupError)
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to save template: ' + saveError.message },
        { status: 500 }
      )
    }

    console.log('Template uploaded successfully:', {
      templateId: savedTemplate.id,
      fileName: file.name,
      placeholders: processingResult.validation?.validCount || 0,
      storage: processingResult.storage?.filePath
    })

    return NextResponse.json({
      success: true,
      template: savedTemplate,
      validation: processingResult.validation,
      placeholders: processingResult.validation?.validPlaceholders || [],
      storage: processingResult.storage
    })

  } catch (error) {
    console.error('Error uploading template:', error)
    return NextResponse.json(
      { error: 'Failed to upload template: ' + error.message },
      { status: 500 }
    )
  }
}