// src/app/api/fields/schema/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { FieldSchemaService } from '@/lib/services/fieldSchemaService'
import { createServiceSupabase } from '@/lib/supabase'

// GET - Fetch current client table schema
export async function GET(request) {
  try {
    // Check authentication
    await requireAuth()
    
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const includeComputed = searchParams.get('includeComputed') !== 'false'
    
    let fields = await FieldSchemaService.getClientTableSchema()
    
    // Filter by category if specified
    if (category && category !== 'all') {
      fields = fields.filter(field => field.category === category)
    }
    
    // Filter computed fields if specified
    if (!includeComputed) {
      fields = fields.filter(field => !field.computed)
    }
    
    // Group fields by category for easier frontend consumption
    const fieldsByCategory = fields.reduce((groups, field) => {
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
      fields,
      fieldsByCategory,
      categories,
      totalFields: fields.length,
      computedFields: fields.filter(f => f.computed).length,
      regularFields: fields.filter(f => !f.computed).length
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

// POST - Validate field mappings against current schema (including custom fields)
export async function POST(request) {
  try {
    // Check authentication
    await requireAuth()
    
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
    
    // Get custom fields for this template if templateId is provided
    let customFieldNames = []
    if (templateId) {
      try {
        const supabase = createServiceSupabase()
        const { data: template, error } = await supabase
          .from('document_templates')
          .select('custom_fields')
          .eq('id', templateId)
          .single()
        
        if (!error && template && template.custom_fields) {
          customFieldNames = template.custom_fields
            .filter(cf => cf.name) // Only fields with names
            .map(cf => cf.name)
          
          console.log(`Found ${customFieldNames.length} custom fields for template ${templateId}:`, customFieldNames)
        }
      } catch (customFieldError) {
        console.error('Error fetching custom fields for validation:', customFieldError)
        // Continue validation without custom fields if fetch fails
      }
    }
    
    // Combine system fields with custom fields
    const availableFieldNames = [...systemFieldNames, ...customFieldNames]
    
    console.log('Validating against fields:', {
      systemFields: systemFieldNames.length,
      customFields: customFieldNames.length,
      total: availableFieldNames.length
    })
    
    const validMappings = []
    const invalidMappings = []
    const warnings = []
    
    Object.entries(fieldMappings).forEach(([placeholder, fieldName]) => {
      if (availableFieldNames.includes(fieldName)) {
        // Find field info (system or custom)
        let fieldInfo = schema.find(f => f.name === fieldName)
        if (!fieldInfo && customFieldNames.includes(fieldName)) {
          // Create field info for custom field
          fieldInfo = {
            name: fieldName,
            type: 'custom',
            category: 'custom',
            computed: false,
            custom: true
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
          reason: 'Field no longer exists in schema or custom fields'
        })
      }
    })
    
    // Check for potential issues
    availableFieldNames.forEach(fieldName => {
      const usageCount = validMappings.filter(m => m.fieldName === fieldName).length
      if (usageCount > 1) {
        // Check if it's a computed field (those can be used multiple times)
        const fieldInfo = schema.find(f => f.name === fieldName)
        const isComputed = fieldInfo?.computed || customFieldNames.includes(fieldName) // Custom fields can be reused
        
        if (!isComputed) {
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
    await requireAuth()
    
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