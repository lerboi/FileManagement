// src/app/api/templates/upload/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { DocumentProcessingService } from '@/lib/services/documentProcessingService'
import formidable from 'formidable'
import fs from 'fs'

export async function POST(request) {
  try {
    // Check authentication
    await requireAuth()

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file')
    const name = formData.get('name')
    const description = formData.get('description')

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

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Convert Word to HTML
    const conversionResult = await DocumentProcessingService.convertWordToHtml(
      buffer,
      file.name
    )

    if (!conversionResult.success) {
      return NextResponse.json(
        { error: 'Failed to convert document: ' + conversionResult.error },
        { status: 500 }
      )
    }

    // Save template to database
    const templateData = {
      name: name || file.name.replace(/\.[^/.]+$/, ''),
      description: description || '',
      original_filename: file.name,
      html_content: conversionResult.html,
      template_type: 'contract',
      status: 'draft'
    }

    const saveResult = await DocumentProcessingService.saveTemplate(templateData)

    if (!saveResult.success) {
      return NextResponse.json(
        { error: 'Failed to save template: ' + saveResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      template: saveResult.template,
      conversion: {
        warnings: conversionResult.warnings,
        errors: conversionResult.errors
      }
    })

  } catch (error) {
    console.error('Error uploading template:', error)
    return NextResponse.json(
      { error: 'Failed to upload template: ' + error.message },
      { status: 500 }
    )
  }
}