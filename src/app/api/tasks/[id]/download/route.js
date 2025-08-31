// src/app/api/tasks/[id]/download/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { TaskDocumentService } from '@/lib/services/taskDocumentService'

// GET - Download documents from a task
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

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')

    // If templateId is specified, download single document
    if (templateId) {
      const result = await TaskDocumentService.downloadDocument(id, templateId)

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        download: {
          url: result.downloadUrl,
          fileName: result.fileName,
          templateName: result.templateName
        }
      })
    }

    // Download all documents
    const result = await TaskDocumentService.downloadAllDocuments(id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      downloads: result.documents,
      taskInfo: result.taskInfo,
      totalDocuments: result.documents.length
    })
  } catch (error) {
    console.error('Error creating download URLs:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create download URLs' },
      { status: 500 }
    )
  }
}

// POST - Bulk download with custom options
export async function POST(request, { params }) {
  try {
    // Check authentication
    await requireSession()

    const { id } = await params
    const { templateIds, format = 'html', includeMetadata = false } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    // For future implementation: support different formats, metadata inclusion, etc.
    const result = await TaskDocumentService.downloadAllDocuments(id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Filter by templateIds if specified
    let filteredDocuments = result.documents
    if (templateIds && templateIds.length > 0) {
      // This would require storing templateId in the download result
      // For now, return all documents
    }

    const response = {
      success: true,
      downloads: filteredDocuments,
      taskInfo: result.taskInfo,
      options: {
        format,
        includeMetadata,
        requestedTemplates: templateIds?.length || 'all'
      }
    }

    if (includeMetadata) {
      // Add metadata about the task and generation
      response.metadata = {
        generatedAt: new Date().toISOString(),
        taskId: id,
        totalDocuments: filteredDocuments.length
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in bulk download:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process bulk download' },
      { status: 500 }
    )
  }
}