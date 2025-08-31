// src/app/api/tasks/[id]/additional-files/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { TaskDocumentService } from '@/lib/services/taskDocumentService'

// POST - Upload additional files
export async function POST(request, { params }) {
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

    // Parse form data
    const formData = await request.formData()
    const files = formData.getAll('files')
    const description = formData.get('description') || ''

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      )
    }

    // Validate files
    const validation = TaskDocumentService.validateFiles(files, 'additional')
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'File validation failed',
          details: validation.errors
        },
        { status: 400 }
      )
    }

    console.log(`Uploading ${files.length} additional files for task: ${id}`)

    const result = await TaskDocumentService.uploadAdditionalFiles(id, files, description)

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
      totalAdditionalFiles: result.totalAdditionalFiles,
      message: `Successfully uploaded ${result.uploadedFiles} additional file${result.uploadedFiles !== 1 ? 's' : ''}`
    }

    if (result.errors && result.errors.length > 0) {
      response.warnings = result.errors
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error uploading additional files:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload additional files' },
      { status: 500 }
    )
  }
}

// GET - List additional files
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

    const additionalFiles = result.task.additional_files || []

    return NextResponse.json({
      success: true,
      taskId: id,
      additionalFiles: additionalFiles,
      totalFiles: additionalFiles.length,
      canUploadMore: true // Additional files can be uploaded at any time
    })
  } catch (error) {
    console.error('Error fetching additional files:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch additional files' },
      { status: 500 }
    )
  }
}

// DELETE - Remove additional file
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

    const result = await TaskDocumentService.deleteUploadedFile(id, filePath, 'additional')

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Additional file deleted successfully',
      task: result.task
    })
  } catch (error) {
    console.error('Error deleting additional file:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete additional file' },
      { status: 500 }
    )
  }
}