// src/app/api/fields/schema/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { FieldSchemaService } from '@/lib/services/fieldSchemaService'
import { createServerSupabase } from '@/lib/supabase'

// GET - Fetch current client table schema + document placeholders
export async function GET(request) {
  try {
    // Check authentication
    await requireSession()
    
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const includeComputed = searchParams.get('includeComputed') !== 'false'
    const includePlaceholders = searchParams.get('includePlaceholders') !== 'false'
    
    // Get client table schema fields
    let clientFields = await FieldSchemaService.getClientTableSchema()
    
    // Get document placeholders
    let placeholderFields = []
    if (includePlaceholders) {
      try {
        const supabase = await createServerSupabase()
        const { data: placeholders, error } = await supabase
          .from('document_placeholders')
          .select('*')
          .order('name', { ascending: true })
        
        if (!error && placeholders) {
          placeholderFields = placeholders.map(placeholder => ({
            name: placeholder.name,
            label: placeholder.label,
            description: placeholder.description,
            type: placeholder.field_type,
            category: 'document',
            computed: false,
            custom: true,
            source: 'placeholder',
            placeholder_id: placeholder.id,
            created_at: placeholder.created_at
          }))
        }
      } catch (placeholderError) {
        console.error('Error fetching document placeholders:', placeholderError)
        // Continue without placeholders if fetch fails
      }
    }
    
    // Combine client fields and placeholder fields
    let allFields = [
      ...clientFields.map(field => ({ ...field, source: 'client' })),
      ...placeholderFields
    ]
    
    // Filter by category if specified
    if (category && category !== 'all') {
      allFields = allFields.filter(field => field.category === category)
    }
    
    // Filter computed fields if specified
    if (!includeComputed) {
      allFields = allFields.filter(field => !field.computed)
    }
    
    // Group fields by category for easier frontend consumption
    const fieldsByCategory = allFields.reduce((groups, field) => {
      const cat = field.category || 'other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(field)
      return groups
    }, {})
    
    // Get categories with counts
    const categories = Object.keys(fieldsByCategory).map(cat => ({
      name: cat,
      count: fieldsByCategory[cat].length,
      fields: fieldsByCategory[cat]
    })).sort((a, b) => a.name.localeCompare(b.name))
    
    return NextResponse.json({
      success: true,
      fields: allFields,
      fieldsByCategory,
      categories,
      totalFields: allFields.length,
      clientFields: clientFields.length,
      placeholderFields: placeholderFields.length,
      computedFields: allFields.filter(f => f.computed).length,
      regularFields: allFields.filter(f => !f.computed).length
    })
    
  } catch (error) {
    console.error('Error fetching field schema:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to fetch field schema'
      },
      { status: 500 }
    )
  }
}

// POST - Validate field mappings against current schema (including placeholders)
export async function POST(request) {
  try {
    // Check authentication
    await requireSession()
    
    const { fieldMappings, templateId } = await request.json()
    
    if (!fieldMappings || typeof fieldMappings !== 'object') {
      return NextResponse.json(
        { error: 'Field mappings object is required' },
        { status: 400 }
      )
    }
    
    // Get system fields schema
    const schema = await FieldSchemaService.getClientTableSchema()
    const systemFieldNames = schema.map(f => f.name)
    
    // Get document placeholders
    let placeholderFieldNames = []
    try {
      const supabase = await createServerSupabase()
      const { data: placeholders, error } = await supabase
        .from('document_placeholders')
        .select('name')
      
      if (!error && placeholders) {
        placeholderFieldNames = placeholders.map(p => p.name)
        console.log(`Found ${placeholderFieldNames.length} document placeholders for validation`)
      }
    } catch (placeholderError) {
      console.error('Error fetching placeholders for validation:', placeholderError)
      // Continue validation without placeholders if fetch fails
    }
    
    // Get custom fields for this template if templateId is provided (legacy support)
    let customFieldNames = []
    if (templateId) {
      try {
        const supabase = await createServerSupabase()
        const { data: template, error } = await supabase
          .from('document_templates')
          .select('custom_fields')
          .eq('id', templateId)
          .single()
        
        if (!error && template && template.custom_fields) {
          customFieldNames = template.custom_fields
            .filter(cf => cf.name) // Only fields with names
            .map(cf => cf.name)
          
          console.log(`Found ${customFieldNames.length} legacy custom fields for template ${templateId}`)
        }
      } catch (customFieldError) {
        console.error('Error fetching custom fields for validation:', customFieldError)
        // Continue validation without custom fields if fetch fails
      }
    }
    
    // Combine all available field names
    const availableFieldNames = [...systemFieldNames, ...placeholderFieldNames, ...customFieldNames]
    
    console.log('Validating against fields:', {
      systemFields: systemFieldNames.length,
      placeholderFields: placeholderFieldNames.length,
      legacyCustomFields: customFieldNames.length,
      total: availableFieldNames.length
    })
    
    const validMappings = []
    const invalidMappings = []
    const warnings = []
    
    Object.entries(fieldMappings).forEach(([placeholder, fieldName]) => {
      if (availableFieldNames.includes(fieldName)) {
        // Find field info (system, placeholder, or custom)
        let fieldInfo = schema.find(f => f.name === fieldName)
        
        if (!fieldInfo && placeholderFieldNames.includes(fieldName)) {
          // Create field info for placeholder field
          fieldInfo = {
            name: fieldName,
            type: 'placeholder',
            category: 'document',
            computed: false,
            custom: true,
            source: 'placeholder'
          }
        } else if (!fieldInfo && customFieldNames.includes(fieldName)) {
          // Create field info for legacy custom field
          fieldInfo = {
            name: fieldName,
            type: 'custom',
            category: 'custom',
            computed: false,
            custom: true,
            source: 'legacy'
          }
        }
        
        validMappings.push({
          placeholder,
          fieldName,
          fieldInfo
        })
      } else {
        invalidMappings.push({
          placeholder,
          fieldName,
          reason: 'Field no longer exists in schema, placeholders, or custom fields'
        })
      }
    })
    
    // Check for potential issues
    availableFieldNames.forEach(fieldName => {
      const usageCount = validMappings.filter(m => m.fieldName === fieldName).length
      if (usageCount > 1) {
        // Check if it's a computed field or placeholder (those can be used multiple times)
        const fieldInfo = schema.find(f => f.name === fieldName)
        const isReusable = fieldInfo?.computed || 
                          placeholderFieldNames.includes(fieldName) || 
                          customFieldNames.includes(fieldName)
        
        if (!isReusable) {
          warnings.push({
            type: 'multiple_usage',
            fieldName,
            count: usageCount,
            message: `Field "${fieldName}" is used ${usageCount} times`
          })
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      validation: {
        valid: invalidMappings.length === 0,
        validMappings,
        invalidMappings,
        warnings,
        totalMappings: Object.keys(fieldMappings).length,
        validCount: validMappings.length,
        invalidCount: invalidMappings.length,
        placeholderFieldsValidated: placeholderFieldNames.length,
        customFieldsValidated: customFieldNames.length
      }
    })
    
  } catch (error) {
    console.error('Error validating field mappings:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to validate field mappings'
      },
      { status: 500 }
    )
  }
}

// PUT - Clear field schema cache (useful after schema changes)
export async function PUT(request) {
  try {
    // Check authentication
    await requireSession()
    
    FieldSchemaService.clearCache()
    
    // Optionally reload schema immediately
    const freshSchema = await FieldSchemaService.getClientTableSchema()
    
    return NextResponse.json({
      success: true,
      message: 'Field schema cache cleared successfully',
      fieldCount: freshSchema.length
    })
    
  } catch (error) {
    console.error('Error clearing field schema cache:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to clear field schema cache'
      },
      { status: 500 }
    )
  }
}