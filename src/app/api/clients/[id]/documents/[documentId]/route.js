// src/app/api/clients/[id]/documents/[documentId]/route.js
import { NextResponse } from 'next/server'
import { ClientDocumentService } from '@/lib/services/clientDocumentService'
import { requireSession } from '@/lib/session'

// DELETE - Delete a specific client document
export async function DELETE(request, { params }) {
  try {
    // Check authentication
    await requireSession()

    const { id: clientId, documentId } = await params

    if (!clientId || !documentId) {
      return NextResponse.json(
        { error: 'Client ID and Document ID are required' },
        { status: 400 }
      )
    }

    const result = await ClientDocumentService.deleteClientDocument(clientId, documentId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete document' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
      deletedDocument: result.deletedDocument,
      remainingDocuments: result.remainingDocuments
    }, { status: 200 })

  } catch (error) {
    console.error('Error deleting client document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete document' },
      { status: 500 }
    )
  }
}

// GET - Get download URL for a specific document
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireSession()

    const { id: clientId, documentId } = await params

    if (!clientId || !documentId) {
      return NextResponse.json(
        { error: 'Client ID and Document ID are required' },
        { status: 400 }
      )
    }

    const result = await ClientDocumentService.getDocumentDownloadUrl(clientId, documentId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to get download URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      downloadUrl: result.downloadUrl,
      fileName: result.fileName,
      fallbackUsed: result.fallbackUsed || false
    }, { status: 200 })

  } catch (error) {
    console.error('Error getting document download URL:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get download URL' },
      { status: 500 }
    )
  }
}