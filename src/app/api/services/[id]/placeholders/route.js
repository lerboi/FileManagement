// src/app/api/services/[id]/placeholders/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase'

// GET - Get placeholders needed for a service (from its templates)
export async function GET(request, { params }) {
  try {
    await requireSession()
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerSupabase()
    
    // Get the service and its template IDs
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('name, template_ids')
      .eq('id', id)
      .single()
    
    if (serviceError) {
      if (serviceError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        )
      }
      throw new Error(`Failed to fetch service: ${serviceError.message}`)
    }
    
    if (!service.template_ids || service.template_ids.length === 0) {
      return NextResponse.json({
        success: true,
        placeholders: [],
        serviceName: service.name,
        templateCount: 0
      })
    }
    
    // Get templates and their field mappings
    const { data: templates, error: templatesError } = await supabase
      .from('document_templates')
      .select('id, name, field_mappings')
      .in('id', service.template_ids)
      .eq('status', 'active')
    
    if (templatesError) {
      throw new Error(`Failed to fetch templates: ${templatesError.message}`)
    }
    
    // Extract all placeholder names from field mappings
    const placeholderNames = new Set()
    const templateInfo = []
    
    templates.forEach(template => {
      const fieldMappings = template.field_mappings || {}
      const templatePlaceholders = []
      
      Object.values(fieldMappings).forEach(fieldName => {
        placeholderNames.add(fieldName)
        templatePlaceholders.push(fieldName)
      })
      
      templateInfo.push({
        id: template.id,
        name: template.name,
        placeholders: templatePlaceholders
      })
    })
    
    if (placeholderNames.size === 0) {
      return NextResponse.json({
        success: true,
        placeholders: [],
        serviceName: service.name,
        templateCount: templates.length,
        templateInfo
      })
    }
    
    // Get placeholder definitions from document_placeholders table
    const { data: placeholderDefs, error: placeholdersError } = await supabase
      .from('document_placeholders')
      .select('*')
      .in('name', Array.from(placeholderNames))
      .order('name', { ascending: true })
    
    if (placeholdersError) {
      throw new Error(`Failed to fetch placeholder definitions: ${placeholdersError.message}`)
    }
    
    // Format placeholders for frontend (convert to custom field format)
    const formattedPlaceholders = placeholderDefs.map(placeholder => ({
      name: placeholder.name,
      label: placeholder.label,
      description: placeholder.description,
      type: placeholder.field_type,
      required: true, // All placeholders in templates are considered required
      category: 'document',
      source: 'placeholder',
      placeholder_id: placeholder.id
    }))
    
    // Add any missing placeholders (placeholders referenced in templates but not in DB)
    const foundNames = new Set(placeholderDefs.map(p => p.name))
    const missingPlaceholders = []
    
    placeholderNames.forEach(name => {
      if (!foundNames.has(name)) {
        missingPlaceholders.push({
          name,
          label: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: `Missing placeholder: ${name}`,
          type: 'text',
          required: true,
          category: 'missing',
          source: 'missing'
        })
      }
    })
    
    const allPlaceholders = [...formattedPlaceholders, ...missingPlaceholders]
    
    return NextResponse.json({
      success: true,
      placeholders: allPlaceholders,
      serviceName: service.name,
      templateCount: templates.length,
      templateInfo,
      source: 'database_fallback',
      stats: {
        totalPlaceholders: allPlaceholders.length,
        foundInDB: formattedPlaceholders.length,
        missing: missingPlaceholders.length,
        fromTemplateDefinitions: 0
      }
    })
    
  } catch (error) {
    console.error('Error fetching service placeholders:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch service placeholders' },
      { status: 500 }
    )
  }
}