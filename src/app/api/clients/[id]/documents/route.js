// src/app/api/clients/[id]/documents/route.js
import { NextResponse } from 'next/server'
import { ClientDocumentService } from '@/lib/services/clientDocumentService'
import { requireSession } from '@/lib/session'

// GET - Fetch all documents for a specific client
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireSession()

    const { id: clientId } = await params

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      )
    }

    const result = await ClientDocumentService.getClientDocuments(clientId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch client documents' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      documents: result.documents,
      clientInfo: result.clientInfo
    }, { status: 200 })

  } catch (error) {
    console.error('Error fetching client documents:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch client documents' },
      { status: 500 }
    )
  }
}

// POST - Upload new documents for a client
export async function POST(request, { params }) {
  try {
    // Check authentication
    await requireSession()

    const { id: clientId } = await params

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('files')
    const description = formData.get('description') || ''

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Validate files
    const validation = ClientDocumentService.validateClientDocuments(files)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'File validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const result = await ClientDocumentService.uploadClientDocuments(
      clientId,
      files,
      description
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to upload documents' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      uploadedFiles: result.uploadedFiles,
      totalDocuments: result.totalDocuments,
      warnings: result.errors
    }, { status: 201 })

  } catch (error) {
    console.error('Error uploading client documents:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload documents' },
      { status: 500 }
    )
  }
}