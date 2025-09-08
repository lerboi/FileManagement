// src/app/api/placeholders/[id]/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase'

// GET - Fetch single placeholder
export async function GET(request, { params }) {
  try {
    await requireSession()
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Placeholder ID is required' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerSupabase()
    
    const { data, error } = await supabase
      .from('document_placeholders')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Placeholder not found' },
          { status: 404 }
        )
      }
      throw new Error(`Failed to fetch placeholder: ${error.message}`)
    }
    
    return NextResponse.json({
      success: true,
      placeholder: data
    })
    
  } catch (error) {
    console.error('Error fetching placeholder:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch placeholder' },
      { status: 500 }
    )
  }
}

// PUT - Update placeholder
export async function PUT(request, { params }) {
  try {
    await requireSession()
    
    const { id } = await params
    const updateData = await request.json()
    
    if (!id) {
      return NextResponse.json(
        { error: 'Placeholder ID is required' },
        { status: 400 }
      )
    }
    
    const allowedFields = ['label', 'description', 'field_type']
    const filteredData = {}
    
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        filteredData[key] = updateData[key]
      }
    })
    
    if (Object.keys(filteredData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }
    
    // Add updated timestamp
    filteredData.updated_at = new Date().toISOString()
    
    const supabase = await createServerSupabase()
    
    const { data, error } = await supabase
      .from('document_placeholders')
      .update(filteredData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Placeholder not found' },
          { status: 404 }
        )
      }
      throw new Error(`Failed to update placeholder: ${error.message}`)
    }
    
    console.log(`Placeholder updated: ${data.name} (${data.label})`)
    
    return NextResponse.json({
      success: true,
      placeholder: data
    })
    
  } catch (error) {
    console.error('Error updating placeholder:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update placeholder' },
      { status: 500 }
    )
  }
}

// DELETE - Delete placeholder
export async function DELETE(request, { params }) {
  try {
    await requireSession()
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Placeholder ID is required' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerSupabase()
    
    // First check if placeholder exists
    const { data: existingPlaceholder, error: fetchError } = await supabase
      .from('document_placeholders')
      .select('id, name, label')
      .eq('id', id)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Placeholder not found' },
          { status: 404 }
        )
      }
      throw new Error(`Failed to verify placeholder: ${fetchError.message}`)
    }
    
    // Delete the placeholder
    const { error: deleteError } = await supabase
      .from('document_placeholders')
      .delete()
      .eq('id', id)
    
    if (deleteError) {
      throw new Error(`Failed to delete placeholder: ${deleteError.message}`)
    }
    
    console.log(`Placeholder deleted: ${existingPlaceholder.name} (${existingPlaceholder.label})`)
    
    return NextResponse.json({
      success: true,
      message: 'Placeholder deleted successfully',
      deletedPlaceholder: {
        id: existingPlaceholder.id,
        name: existingPlaceholder.name,
        label: existingPlaceholder.label
      }
    })
    
  } catch (error) {
    console.error('Error deleting placeholder:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete placeholder' },
      { status: 500 }
    )
  }
}