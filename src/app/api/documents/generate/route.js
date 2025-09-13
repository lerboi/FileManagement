// src/app/api/documents/generate/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { DocxtemplaterService } from '@/lib/services/docxtemplaterService'

// POST - Generate DOCX document using DocxtemplaterService
export async function POST(request) {
  try {
    await requireSession()

    const { templateId, clientId, customFieldValues = {} } = await request.json()

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      )
    }

    console.log('Starting DOCX document generation:', {
      templateId,
      clientId,
      customFieldCount: Object.keys(customFieldValues).length
    })

    // Generate document using DocxtemplaterService
    const result = await DocxtemplaterService.generateDocument(
      templateId,
      clientId,
      customFieldValues
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    console.log('DOCX document generated successfully:', {
      documentId: result.document.id,
      fileName: result.fileName
    })

    // Return DOCX file as download response
    const response = new Response(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Content-Length': result.buffer.length.toString(),
      }
    })

    return response

  } catch (error) {
    console.error('Error generating DOCX document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate document' },
      { status: 500 }
    )
  }
}

// GET - Get document generation status or preview
export async function GET(request) {
  try {
    await requireSession()

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')
    const clientId = searchParams.get('clientId')
    const preview = searchParams.get('preview') === 'true'

    if (!templateId || !clientId) {
      return NextResponse.json(
        { error: 'Template ID and Client ID are required' },
        { status: 400 }
      )
    }

    if (preview) {
      // Return preview of template data without generating document
      const result = await DocxtemplaterService.previewTemplateData(
        templateId,
        clientId,
        {}
      )

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        preview: result.preview,
        templateData: result.templateData
      })
    }

    return NextResponse.json(
      { error: 'Invalid request parameters' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in document generation GET:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    )
  }
}