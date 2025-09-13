// src/app/api/templates/[id]/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase'

// GET - Fetch a single template by ID
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
    
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }
      throw new Error(`Failed to fetch template: ${error.message}`)
    }
    
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch template' },
      { status: 500 }
    )
  }
}

// PUT - Update a template
export async function PUT(request, { params }) {
  try {
    // Check authentication
    await requireSession()
    
    const { id } = await params
    const updateData = await request.json()
    
    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerSupabase()
    
    // Only update allowed fields for DOCX templates
    const allowedFields = ['name', 'description', 'status']
    const filteredData = {}
    
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        filteredData[key] = updateData[key]
      }
    })
    
    // Add updated_at timestamp
    filteredData.updated_at = new Date().toISOString()
    
    const { data, error } = await supabase
      .from('document_templates')
      .update(filteredData)
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
      throw new Error(`Failed to update template: ${error.message}`)
    }
    
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a template
export async function DELETE(request, { params }) {
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
    
    // First check if template exists
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('document_templates')
      .select('id, name, status')
      .eq('id', id)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }
      throw new Error(`Failed to verify template: ${fetchError.message}`)
    }
    
    // Check if template is safe to delete (optional business logic)
    if (existingTemplate.status === 'active') {
      console.warn(`Deleting active template: ${existingTemplate.name} (ID: ${id})`)
    }
    
    // Delete the template
    const { error: deleteError } = await supabase
      .from('document_templates')
      .delete()
      .eq('id', id)
    
    if (deleteError) {
      throw new Error(`Failed to delete template: ${deleteError.message}`)
    }
    
    console.log(`Template deleted successfully: ${existingTemplate.name} (ID: ${id})`)
    
    return NextResponse.json(
      { 
        message: 'Template deleted successfully',
        deletedTemplate: {
          id: existingTemplate.id,
          name: existingTemplate.name
        }
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    )
  }
}