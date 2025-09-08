// src/app/api/placeholders/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase'

// GET - Fetch all placeholders
export async function GET(request) {
  try {
    await requireSession()
    
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const fieldType = searchParams.get('fieldType')
    const limit = parseInt(searchParams.get('limit')) || 100
    const offset = parseInt(searchParams.get('offset')) || 0
    
    const supabase = await createServerSupabase()
    
    let query = supabase
      .from('document_placeholders')
      .select('*')
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1)
    
    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,label.ilike.%${search}%,description.ilike.%${search}%`)
    }
    
    if (fieldType && fieldType !== 'all') {
      query = query.eq('field_type', fieldType)
    }
    
    const { data, error, count } = await query
    
    if (error) {
      throw new Error(`Failed to fetch placeholders: ${error.message}`)
    }
    
    return NextResponse.json({
      success: true,
      placeholders: data || [],
      total: count,
      pagination: {
        limit,
        offset,
        hasMore: (data?.length || 0) === limit
      }
    })
    
  } catch (error) {
    console.error('Error fetching placeholders:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch placeholders' },
      { status: 500 }
    )
  }
}

// POST - Create new placeholder
export async function POST(request) {
  try {
    await requireSession()
    
    const { name, label, description, field_type = 'text' } = await request.json()
    
    if (!name || !label) {
      return NextResponse.json(
        { error: 'Name and label are required' },
        { status: 400 }
      )
    }
    
    // Validate name format (lowercase, underscores, alphanumeric)
    const nameRegex = /^[a-z][a-z0-9_]*$/
    if (!nameRegex.test(name)) {
      return NextResponse.json(
        { error: 'Name must start with a letter and contain only lowercase letters, numbers, and underscores' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerSupabase()
    
    const { data, error } = await supabase
      .from('document_placeholders')
      .insert([{
        name: name.trim(),
        label: label.trim(),
        description: description?.trim() || '',
        field_type: field_type
      }])
      .select()
      .single()
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'A placeholder with this name already exists' },
          { status: 400 }
        )
      }
      throw new Error(`Failed to create placeholder: ${error.message}`)
    }
    
    console.log(`Placeholder created: ${data.name} (${data.label})`)
    
    return NextResponse.json({
      success: true,
      placeholder: data
    })
    
  } catch (error) {
    console.error('Error creating placeholder:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create placeholder' },
      { status: 500 }
    )
  }
}