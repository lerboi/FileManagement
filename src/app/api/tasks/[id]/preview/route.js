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

    // Get the HTML content from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('task-documents')
      .download(document.storagePath)

    if (downloadError || !fileData) {
      return new Response('Failed to load document content', { status: 500 })
    }

    // Convert blob to text
    const htmlContent = await fileData.text()

    // Enhanced HTML with better styling and metadata (unchanged)
    const enhancedHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${document.templateName} - ${task.client_name}</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 1in;
            background-color: #ffffff;
            color: #333333;
        }
        
        .document-header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        .document-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .document-meta {
            font-size: 12px;
            color: #666;
            font-style: italic;
        }
        
        .document-content {
            text-align: justify;
        }
        
        .document-footer {
            margin-top: 50px;
            border-top: 1px solid #ccc;
            padding-top: 20px;
            font-size: 10px;
            color: #666;
            text-align: center;
        }
        
        h1, h2, h3, h4, h5, h6 {
            color: #333;
            margin-top: 25px;
            margin-bottom: 15px;
        }
        
        p {
            margin-bottom: 12px;
            text-align: justify;
        }
        
        .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #007cba;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 1000;
        }
        
        .print-button:hover {
            background-color: #005a87;
        }
        
        @media print {
            .print-button {
                display: none;
            }
            body {
                padding: 0.5in;
            }
        }
    </style>
</head>
<body>
    <button class="print-button" onclick="window.print()">Print Document</button>
    
    <div class="document-header">
        <div class="document-title">${document.templateName}</div>
        <div class="document-meta">
            Client: ${task.client_name} | Service: ${task.service_name}<br>
            Generated: ${new Date(document.generatedAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
        </div>
    </div>
    
    <div class="document-content">
        ${htmlContent}
    </div>
    
    <div class="document-footer">
        <p>This document was generated on ${new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })} | Task ID: ${id}</p>
    </div>
</body>
</html>`

    // Return as HTML response
    return new Response(enhancedHTML, {
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

// POST - Download document as Word file using modern docx library
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

    // Get the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('task-documents')
      .download(document.storagePath)

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
    }

    const htmlContent = await fileData.text()

    try {
      // Helper function to convert HTML to plain text and preserve structure
      const htmlToText = (html) => {
        return html
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
      }

      // Convert HTML content to structured text
      const plainTextContent = htmlToText(htmlContent)
      
      // Create paragraphs for the Word document
      const paragraphs = []

      // Add document title
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: document.templateName,
              bold: true,
              size: 32, // 16pt font
              font: 'Times New Roman'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        })
      )

      // Add client and service information
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Client: ${task.client_name} | Service: ${task.service_name}`,
              italics: true,
              size: 20, // 10pt font
              font: 'Times New Roman'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        })
      )

      // Add generation date
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated: ${new Date(document.generatedAt).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}`,
              italics: true,
              size: 20, // 10pt font
              font: 'Times New Roman'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        })
      )

      // Process content line by line
      const contentLines = plainTextContent.split('\n')
      contentLines.forEach(line => {
        const trimmedLine = line.trim()
        
        if (trimmedLine) {
          // Check if it's a heading (marked with **)
          if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
            const headingText = trimmedLine.replace(/\*\*/g, '')
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: headingText,
                    bold: true,
                    size: 28, // 14pt font
                    font: 'Times New Roman'
                  })
                ],
                heading: HeadingLevel.HEADING_2,
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
                    size: 24, // 12pt font
                    font: 'Times New Roman'
                  })
                ],
                alignment: AlignmentType.JUSTIFIED,
                spacing: { after: 200 }
              })
            )
          }
        } else {
          // Empty line for spacing
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: '', size: 24 })],
              spacing: { after: 100 }
            })
          )
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
      const buffer = await Packer.toBuffer(doc)

      // Generate filename
      const sanitizedTemplateName = document.templateName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
      const sanitizedClientName = task.client_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
      const fileName = `${sanitizedTemplateName}_${sanitizedClientName}.docx`

      // Return Word document
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': buffer.length.toString(),
        }
      })

    } catch (conversionError) {
      console.error('Error creating Word document:', conversionError)
      return NextResponse.json({ 
        error: `Failed to convert document to Word format: ${conversionError.message}` 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error downloading document as Word:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}