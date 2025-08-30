// CREATE NEW FILE: src/app/api/tasks/[id]/preview/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase'

// GET - Preview generated document as HTML in browser
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireAuth()

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

    // Enhanced HTML with better styling and metadata
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
        
        .signature-section {
            margin-top: 40px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
        
        .signature-line {
            margin-top: 30px;
            border-bottom: 1px solid #333;
            width: 300px;
            height: 40px;
            display: inline-block;
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

// POST - Download document as file
export async function POST(request, { params }) {
  try {
    // Check authentication
    await requireAuth()

    const { id } = await params
    const { templateId, format = 'html' } = await request.json()

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

    if (format === 'html') {
      // Return formatted HTML file
      const fileName = `${document.fileName}.html`
      const enhancedHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${document.templateName} - ${task.client_name}</title>
    <style>
        body { font-family: 'Times New Roman', serif; line-height: 1.6; max-width: 8.5in; margin: 0 auto; padding: 1in; }
        h1, h2, h3 { color: #333; }
        p { margin-bottom: 12px; text-align: justify; }
    </style>
</head>
<body>
    <h1>${document.templateName}</h1>
    <p><strong>Client:</strong> ${task.client_name}</p>
    <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
    <hr>
    ${htmlContent}
</body>
</html>`

      return new Response(enhancedHTML, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        }
      })
    }

    // Default to original content
    return new Response(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${document.fileName}.html"`,
      }
    })

  } catch (error) {
    console.error('Error downloading document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}