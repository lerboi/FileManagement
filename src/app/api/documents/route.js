// src/app/api/documents/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase'

// GET - Fetch all generated documents
export async function GET(request) {
  try {
    // Check authentication
    await requireAuth()
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 10
    const search = searchParams.get('search') || ''
    const templateId = searchParams.get('templateId') || ''
    const clientId = searchParams.get('clientId') || ''
    
    const supabase = await createServerSupabase()
    
    let query = supabase
      .from('generated_documents')
      .select(`
        *,
        document_templates!inner(name, template_type),
        clients!inner(first_name, last_name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
    
    // Add search functionality
    if (search) {
      query = query.or(`client_name.ilike.%${search}%,original_template_name.ilike.%${search}%`)
    }
    
    // Add template filter
    if (templateId) {
      query = query.eq('template_id', templateId)
    }
    
    // Add client filter
    if (clientId) {
      query = query.eq('client_id', clientId)
    }
    
    // Add pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)
    
    const { data, error, count } = await query
    
    if (error) {
      throw new Error(`Failed to fetch generated documents: ${error.message}`)
    }
    
    return NextResponse.json({
      documents: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    })
  } catch (error) {
    console.error('Error fetching generated documents:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch generated documents' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a generated document
export async function DELETE(request) {
  try {
    // Check authentication
    await requireAuth()
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerSupabase()
    
    const { error } = await supabase
      .from('generated_documents')
      .delete()
      .eq('id', id)
    
    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`)
    }
    
    return NextResponse.json(
      { message: 'Document deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting generated document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete document' },
      { status: 500 }
    )
  }
}