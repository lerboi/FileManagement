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
    const file = formData.get('file')
    const templateId = formData.get('templateId')
    const templateName = formData.get('templateName')
    const isReplacement = formData.get('replace') === 'true'
    
    console.log('Upload request:', { templateId, templateName, fileName: file?.name, isReplacement })

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Get current task to check existing signed documents
    const { TaskManagementService } = await import('@/lib/services/taskManagementService')
    const taskResult = await TaskManagementService.getTaskById(id, false)
    
    if (!taskResult.success) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Check if document already exists and this isn't a replacement
    if (!isReplacement && taskResult.task.signed_documents) {
      const existingSignedDoc = taskResult.task.signed_documents.find(doc => 
        doc.templateId === templateId || 
        doc.templateName === templateName ||
        doc.originalName?.includes(templateName)
      )
      
      if (existingSignedDoc) {
        return NextResponse.json(
          { error: `A signed document for "${templateName}" already exists. Use replace function to update it.` },
          { status: 400 }
        )
      }
    }

    // Validate file
    const validation = TaskDocumentService.validateFiles([file], 'signed')
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'File validation failed',
          details: validation.errors
        },
        { status: 400 }
      )
    }

    console.log(`${isReplacement ? 'Replacing' : 'Uploading'} signed document for template ${templateId} in task: ${id}`)

    // Create metadata object to associate with the upload
    const uploadMetadata = {
      templateId: templateId,
      templateName: templateName,
      replace: isReplacement,
      fileName: file.name,
      fileSize: file.size
    }

    // Use the existing uploadSignedDocuments method
    const result = await TaskDocumentService.uploadSignedDocuments(id, [file], uploadMetadata)

    console.log('Upload result:', result)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Get the updated task to return fresh data
    const updatedTaskResult = await TaskManagementService.getTaskById(id, false)
    
    const response = {
      success: true,
      task: updatedTaskResult.success ? updatedTaskResult.task : result.task,
      uploadedFiles: result.uploadedFiles,
      templateId: templateId,
      message: `Successfully ${isReplacement ? 'replaced' : 'uploaded'} signed version of "${templateName}"`
    }

    if (result.warnings && result.warnings.length > 0) {
      response.warnings = result.warnings
    }

    console.log('Sending response:', response)
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error uploading signed document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload signed document' },
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