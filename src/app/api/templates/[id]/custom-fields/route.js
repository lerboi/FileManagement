// src/app/api/templates/[id]/custom-fields/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase'

// PUT - Update custom fields for a template
export async function PUT(request, { params }) {
  try {
    // Check authentication
    await requireAuth()
    
    const { id } = await params
    const { customFields } = await request.json()
    
    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(customFields)) {
      return NextResponse.json(
        { error: 'Custom fields must be an array' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerSupabase()
    
    // Update the template with the new custom fields
    const { data, error } = await supabase
      .from('document_templates')
      .update({ 
        custom_fields: customFields,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }
      throw new Error(`Failed to update custom fields: ${error.message}`)
    }
    
    console.log(`Custom fields updated for template ${id}:`, customFields.length, 'fields')
    
    return NextResponse.json({
      success: true,
      template: data,
      customFields: data.custom_fields
    })
    
  } catch (error) {
    console.error('Error updating custom fields:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update custom fields' },
      { status: 500 }
    )
  }
}

// GET - Get custom fields for a template
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireAuth()
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerSupabase()
    
    const { data, error } = await supabase
      .from('document_templates')
      .select('custom_fields')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }
      throw new Error(`Failed to fetch custom fields: ${error.message}`)
    }
    
    return NextResponse.json({
      success: true,
      customFields: data.custom_fields || []
    })
    
  } catch (error) {
    console.error('Error fetching custom fields:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch custom fields' },
      { status: 500 }
    )
  }
}