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

// POST - Download document as Word file using aggressive HTML cleaning
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

    // Get the HTML content from storage (currently enhanced HTML)
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('task-documents')
      .download(document.storagePath)

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to load document content' }, { status: 500 })
    }

    // Convert blob to text
    const htmlContent = await fileData.text()

    try {
      // AGGRESSIVELY clean the HTML for Word conversion
      let cleanHtml = htmlContent

      // Step 1: Extract only body content if wrapped in full HTML
      const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      if (bodyMatch) {
        cleanHtml = bodyMatch[1]
      }

      // Step 2: Remove all CSS and styling
      cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      cleanHtml = cleanHtml.replace(/style="[^"]*"/gi, '')
      cleanHtml = cleanHtml.replace(/class="[^"]*"/gi, '')
      cleanHtml = cleanHtml.replace(/id="[^"]*"/gi, '')

      // Step 3: Remove field placeholder spans but keep content
      cleanHtml = cleanHtml.replace(/<span[^>]*class="field-placeholder"[^>]*>(.*?)<\/span>/gi, '$1')
      
      // Step 4: Remove any remaining spans
      cleanHtml = cleanHtml.replace(/<span[^>]*>/gi, '')
      cleanHtml = cleanHtml.replace(/<\/span>/gi, '')

      // Step 5: Clean up extra whitespace and line breaks
      cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim()

      // Step 6: Create very simple HTML structure for Word
      const wordReadyHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body>
${cleanHtml}
</body>
</html>`

      console.log('Attempting DOCX conversion with cleaned HTML...', {
        originalLength: htmlContent.length,
        cleanedLength: cleanHtml.length,
        templateId
      })

      // Try html-to-docx first
      try {
        const HTMLtoDOCX = (await import('html-to-docx')).default
        
        const docxBuffer = HTMLtoDOCX(wordReadyHtml, null, {
          table: { row: { cantSplit: true } },
          footer: false,
          pageNumber: false
        })

        console.log('html-to-docx result:', {
          type: typeof docxBuffer,
          isBuffer: Buffer.isBuffer(docxBuffer),
          hasLength: docxBuffer && docxBuffer.length !== undefined,
          length: docxBuffer?.length
        })

        if (docxBuffer && (Buffer.isBuffer(docxBuffer) || docxBuffer.length > 0)) {
          // Generate filename
          const sanitizedTemplateName = document.templateName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
          const sanitizedClientName = task.client_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
          const fileName = `${sanitizedTemplateName}_${sanitizedClientName}.docx`

          console.log('DOCX conversion successful with html-to-docx')

          // Return Word document
          return new Response(docxBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'Content-Disposition': `attachment; filename="${fileName}"`,
              'Content-Length': docxBuffer.length.toString(),
            }
          })
        } else {
          throw new Error('html-to-docx returned invalid buffer')
        }

      } catch (htmlToDocxError) {
        console.error('html-to-docx failed:', htmlToDocxError)
        console.log('Falling back to original docx library...')

        // Fallback to the original docx library approach
        const { Document, Packer, Paragraph, TextRun } = await import('docx')
        
        // Convert HTML to plain text for docx library
        const plainText = cleanHtml
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<p[^>]*>/gi, '')
          .replace(/<\/div>/gi, '\n')
          .replace(/<div[^>]*>/gi, '')
          .replace(/<h[1-6][^>]*>/gi, '\n\n**')
          .replace(/<\/h[1-6]>/gi, '**\n')
          .replace(/<li[^>]*>/gi, '• ')
          .replace(/<\/li>/gi, '\n')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim()

        // Create paragraphs for the Word document
        const paragraphs = []
        const lines = plainText.split('\n')
        
        lines.forEach(line => {
          const trimmedLine = line.trim()
          if (trimmedLine) {
            if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
              // Heading
              const headingText = trimmedLine.replace(/\*\*/g, '')
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: headingText,
                      bold: true,
                      size: 28,
                      font: 'Times New Roman'
                    })
                  ],
                  spacing: { before: 300, after: 200 }
                })
              )
            } else {
              // Regular paragraph
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: trimmedLine,
                      size: 24,
                      font: 'Times New Roman'
                    })
                  ],
                  spacing: { after: 200 }
                })
              )
            }
          }
        })

        // Create the Word document
        const doc = new Document({
          sections: [{
            properties: {},
            children: paragraphs
          }]
        })

        // Generate the document buffer
        const docxBuffer = await Packer.toBuffer(doc)

        // Generate filename
        const sanitizedTemplateName = document.templateName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
        const sanitizedClientName = task.client_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
        const fileName = `${sanitizedTemplateName}_${sanitizedClientName}.docx`

        console.log('DOCX conversion successful with fallback docx library')

        // Return Word document
        return new Response(docxBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': docxBuffer.length.toString(),
          }
        })
      }

    } catch (conversionError) {
      console.error('Both DOCX conversion methods failed:', conversionError)
      return NextResponse.json({ 
        error: `Failed to convert document to Word format: ${conversionError.message}` 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error downloading document as Word:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}