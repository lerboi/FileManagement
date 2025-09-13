// src/app/api/templates/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase'

// GET - Fetch all templates
export async function GET(request) {
  try {
    await requireSession()

    const supabase = await createServerSupabase()
    
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      templates: data || []
    })

  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// PUT - Update template
export async function PUT(request) {
  try {
    // Check authentication
    await requireSession()

    const { id, name, description, html_content, field_mappings, status } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabase()
    
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (html_content !== undefined) updateData.html_content = html_content
    if (field_mappings !== undefined) updateData.field_mappings = field_mappings
    if (status !== undefined) updateData.status = status

    const { data, error } = await supabase
      .from('document_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      template: data
    })

  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    )
  }
}