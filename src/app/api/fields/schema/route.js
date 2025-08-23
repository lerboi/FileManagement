// src/app/api/fields/schema/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { FieldSchemaService } from '@/lib/services/fieldSchemaService'

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

// POST - Validate field mappings against current schema
export async function POST(request) {
  try {
    // Check authentication
    await requireAuth()
    
    const { fieldMappings } = await request.json()
    
    if (!fieldMappings || typeof fieldMappings !== 'object') {
      return NextResponse.json(
        { error: 'Field mappings object is required' },
        { status: 400 }
      )
    }
    
    const schema = await FieldSchemaService.getClientTableSchema()
    const availableFieldNames = schema.map(f => f.name)
    
    const validMappings = []
    const invalidMappings = []
    const warnings = []
    
    Object.entries(fieldMappings).forEach(([placeholder, fieldName]) => {
      if (availableFieldNames.includes(fieldName)) {
        validMappings.push({
          placeholder,
          fieldName,
          fieldInfo: schema.find(f => f.name === fieldName)
        })
      } else {
        invalidMappings.push({
          placeholder,
          fieldName,
          reason: 'Field no longer exists in schema'
        })
      }
    })
    
    // Check for potential issues
    schema.forEach(field => {
      const usageCount = validMappings.filter(m => m.fieldName === field.name).length
      if (usageCount > 1 && !field.computed) {
        warnings.push({
          type: 'multiple_usage',
          fieldName: field.name,
          count: usageCount,
          message: `Field "${field.name}" is used ${usageCount} times`
        })
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
        invalidCount: invalidMappings.length
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