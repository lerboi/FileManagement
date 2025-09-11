// Updated src/app/api/tasks/[id]/preview/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'

// GET method stays the same (no changes to preview functionality)
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireSession()

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')

    if (!id || !templateId) {
      return new Response('Task ID and Template ID are required', { status: 400 })
    }

    const supabase = await createServerSupabase()

    // Fetch task to get document info
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, generated_documents, status, client_name, service_name')
      .eq('id', id)
      .single()

    if (taskError) {
      return new Response('Failed to fetch task', { status: 500 })
    }

    // Find the specific document
    const document = task.generated_documents?.find(doc => doc.templateId === templateId)
    
    if (!document) {
      return new Response('Document not found in task', { status: 404 })
    }

    if (document.status !== 'generated') {
      return new Response('Document is not ready for preview', { status: 400 })
    }

    // Get the ENHANCED HTML content for web preview
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('task-documents')
      .download(document.storagePath) // This points to enhanced HTML

    if (downloadError || !fileData) {
      return new Response('Failed to load document content', { status: 500 })
    }

    // Convert blob to text - this is enhanced HTML with CSS
    const enhancedHtmlContent = await fileData.text()

    // Add metadata header for preview
    const previewHtml = enhancedHtmlContent.replace(
      '<body>',
      `<body>
        <div style="background: #f0f0f0; padding: 10px; margin-bottom: 20px; border: 1px solid #ddd; font-size: 12px;">
          <strong>Document Preview:</strong> ${document.templateName} for ${task.client_name} | 
          <strong>Generated:</strong> ${new Date(document.generatedAt).toLocaleDateString()} |
          <strong>Task:</strong> ${task.service_name}
        </div>`
    )

    // Return enhanced HTML for web preview
    return new Response(previewHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache',
      }
    })

  } catch (error) {
    console.error('Error previewing document:', error)
    return new Response('Internal server error', { status: 500 })
  }
}

// POST - Download document as Word file using html-to-docx
export async function POST(request, { params }) {
  try {
    // Check authentication
    await requireSession()

    const { id } = await params
    const { templateId } = await request.json()

    if (!id || !templateId) {
      return NextResponse.json({ error: 'Task ID and Template ID are required' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // Fetch task to get document info
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, generated_documents, client_name, service_name')
      .eq('id', id)
      .single()

    if (taskError) {
      return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
    }

    // Find the specific document
    const document = task.generated_documents?.find(doc => doc.templateId === templateId)
    
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Get the CLEAN HTML content from storage (not enhanced)
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('task-documents')
      .download(document.storagePath)

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to load document content' }, { status: 500 })
    }

    // Convert blob to text - this should be CLEAN HTML
    const cleanHtmlContent = await fileData.text()

    try {
      // Import html-to-docx using dynamic import
      const HTMLtoDOCX = (await import('html-to-docx')).default

      // Prepare clean HTML for Word conversion (remove any CSS)
      let wordReadyHtml = cleanHtmlContent
      
      // Remove any CSS that might have leaked in
      wordReadyHtml = wordReadyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      wordReadyHtml = wordReadyHtml.replace(/style="[^"]*"/g, '')
      wordReadyHtml = wordReadyHtml.replace(/class="[^"]*"/g, '')
      
      // Ensure we have proper HTML structure
      if (!wordReadyHtml.includes('<html>')) {
        wordReadyHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Document</title>
</head>
<body>
${wordReadyHtml}
</body>
</html>`
      }

      console.log('Converting HTML to DOCX...')
      console.log('HTML content length:', wordReadyHtml.length)

      // Convert to DOCX using html-to-docx with simplified options
      const docxBuffer = await HTMLtoDOCX(wordReadyHtml, null, {
        table: { row: { cantSplit: true } },
        footer: false,
        pageNumber: false
      })

      console.log('Conversion result:', typeof docxBuffer, docxBuffer ? 'Buffer created' : 'No buffer')

      if (!docxBuffer) {
        throw new Error('Failed to generate DOCX buffer - conversion returned null/undefined')
      }

      // Generate filename
      const sanitizedTemplateName = document.templateName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
      const sanitizedClientName = task.client_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
      const fileName = `${sanitizedTemplateName}_${sanitizedClientName}.docx`

      // Return Word document
      return new Response(docxBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': docxBuffer.byteLength ? docxBuffer.byteLength.toString() : docxBuffer.length.toString(),
        }
      })

    } catch (conversionError) {
      console.error('Error creating Word document:', conversionError)
      console.error('HTML content that failed:', cleanHtmlContent.substring(0, 500) + '...')
      return NextResponse.json({ 
        error: `Failed to convert document to Word format: ${conversionError.message}` 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error downloading document as Word:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}