// src/app/api/tasks/[id]/upload-signed/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { TaskDocumentService } from '@/lib/services/taskDocumentService'

// POST - Upload signed documents
export async function POST(request, { params }) {
  try {
    // Check authentication
    await requireAuth()

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const files = formData.getAll('files')
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      )
    }

    // Validate files
    const validation = TaskDocumentService.validateFiles(files, 'signed')
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'File validation failed',
          details: validation.errors
        },
        { status: 400 }
      )
    }

    console.log(`Uploading ${files.length} signed documents for task: ${id}`)

    const result = await TaskDocumentService.uploadSignedDocuments(id, files)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    const response = {
      success: true,
      task: result.task,
      uploadedFiles: result.uploadedFiles,
      totalSignedDocuments: result.totalSignedDocuments,
      message: `Successfully uploaded ${result.uploadedFiles} signed document${result.uploadedFiles !== 1 ? 's' : ''}`
    }

    if (result.errors && result.errors.length > 0) {
      response.warnings = result.errors
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error uploading signed documents:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload signed documents' },
      { status: 500 }
    )
  }
}

// GET - List uploaded signed documents
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireAuth()

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    const { TaskManagementService } = await import('@/lib/services/taskManagementService')
    
    const result = await TaskManagementService.getTaskById(id, false)

    if (!result.success) {
      if (result.error === 'Task not found') {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    const signedDocuments = result.task.signed_documents || []

    return NextResponse.json({
      success: true,
      taskId: id,
      signedDocuments: signedDocuments,
      totalFiles: signedDocuments.length,
      canUploadMore: result.task.status === 'awaiting'
    })
  } catch (error) {
    console.error('Error fetching signed documents:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch signed documents' },
      { status: 500 }
    )
  }
}

// DELETE - Remove uploaded signed document
export async function DELETE(request, { params }) {
  try {
    // Check authentication
    await requireAuth()

    const { id } = await params
    const { filePath } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    const result = await TaskDocumentService.deleteUploadedFile(id, filePath, 'signed')

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Signed document deleted successfully',
      task: result.task
    })
  } catch (error) {
    console.error('Error deleting signed document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete signed document' },
      { status: 500 }
    )
  }
}