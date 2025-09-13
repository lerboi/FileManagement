// src/app/api/tasks/[id]/preview/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase'

// GET - Download DOCX document directly
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireSession()

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')

    if (!id || !templateId) {
      return NextResponse.json(
        { error: 'Task ID and Template ID are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabase()

    // Fetch task to get document info
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, generated_documents, status, client_name, service_name')
      .eq('id', id)
      .single()

    if (taskError) {
      return NextResponse.json(
        { error: 'Failed to fetch task' },
        { status: 500 }
      )
    }

    // Find the specific document
    const document = task.generated_documents?.find(doc => doc.templateId === templateId)
    
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found in task' },
        { status: 404 }
      )
    }

    if (document.status !== 'generated') {
      return NextResponse.json(
        { error: 'Document is not ready for download' },
        { status: 400 }
      )
    }

    // Download DOCX file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('task-documents')
      .download(document.storagePath)

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: 'Failed to load document file' },
        { status: 500 }
      )
    }

    // Convert blob to buffer
    const fileBuffer = await fileData.arrayBuffer()

    // Generate filename
    const fileName = `${document.templateName}_${task.client_name}_${document.fileName}.docx`
      .replace(/[^a-zA-Z0-9._-]/g, '_')

    // Return DOCX file directly
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.byteLength.toString(),
      }
    })

  } catch (error) {
    console.error('Error downloading DOCX document:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Not needed anymore, redirect to GET
export async function POST(request, { params }) {
  const { searchParams } = new URL(request.url)
  const templateId = searchParams.get('templateId')
  
  // Redirect POST requests to GET for download
  return Response.redirect(new URL(`/api/tasks/${params.id}/preview?templateId=${templateId}`, request.url), 302)
}