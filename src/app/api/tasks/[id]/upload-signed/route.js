// src/app/api/tasks/[id]/upload-signed/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { TaskDocumentService } from '@/lib/services/taskDocumentService'

// POST - Upload signed documents
export async function POST(request, { params }) {
  try {
    await requireSession()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const templateId = formData.get('templateId')
    const templateName = formData.get('templateName')
    
    if (!file || !templateId) {
      return NextResponse.json({ error: 'File and templateId are required' }, { status: 400 })
    }

    // Import the storage service
    const { SignedDocumentStorageService } = await import('@/lib/services/signedDocumentStorageService')
    
    // Upload to organized storage structure
    const uploadResult = await SignedDocumentStorageService.uploadSignedDocument(
      id, 
      templateId, 
      file, 
      file.name
    )

    if (!uploadResult.success) {
      return NextResponse.json({ error: uploadResult.error }, { status: 400 })
    }

    // Get updated task data
    const { TaskManagementService } = await import('@/lib/services/taskManagementService')
    const taskResult = await TaskManagementService.getTaskById(id, false)
    
    if (!taskResult.success) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      task: taskResult.task,
      uploadInfo: {
        templateId,
        templateName,
        fileName: uploadResult.fileName,
        storagePath: uploadResult.storagePath
      },
      message: `Signed version of "${templateName}" uploaded successfully`
    })
  } catch (error) {
    console.error('Error uploading signed document:', error)
    return NextResponse.json({ error: error.message || 'Failed to upload signed document' }, { status: 500 })
  }
}

// GET - List uploaded signed documents
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireSession()

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
    await requireSession()

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