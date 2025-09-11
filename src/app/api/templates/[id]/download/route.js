// src/app/api/templates/[id]/download/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase'

// GET - Download original DOCX template file
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireSession()
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerSupabase()
    
    // Get template information
    const { data: template, error: templateError } = await supabase
      .from('document_templates')
      .select('docx_file_path, original_filename, name')
      .eq('id', id)
      .single()
    
    if (templateError) {
      if (templateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }
      throw new Error(`Failed to fetch template: ${templateError.message}`)
    }
    
    if (!template.docx_file_path) {
      return NextResponse.json(
        { error: 'No DOCX file associated with this template' },
        { status: 404 }
      )
    }
    
    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('document-templates')
      .download(template.docx_file_path)
    
    if (downloadError) {
      console.error('File download error:', downloadError)
      return NextResponse.json(
        { error: 'Failed to download template file' },
        { status: 500 }
      )
    }
    
    // Convert blob to buffer
    const fileBuffer = await fileData.arrayBuffer()
    
    // Generate filename
    const fileName = template.original_filename || `${template.name}.docx`
    
    // Return file
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.byteLength.toString()
      }
    })
    
  } catch (error) {
    console.error('Error downloading template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to download template' },
      { status: 500 }
    )
  }
}