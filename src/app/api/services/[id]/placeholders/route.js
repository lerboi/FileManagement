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
    
    // Get templates with detected_placeholders
    const { data: templates, error: templatesError } = await supabase
      .from('document_templates')
      .select('id, name, detected_placeholders')
      .in('id', service.template_ids)
      .eq('status', 'active')
    
    if (templatesError) {
      throw new Error(`Failed to fetch templates: ${templatesError.message}`)
    }
    
    // Check if any templates have null/empty detected_placeholders
    const templatesWithoutPlaceholders = templates.filter(
      template => !template.detected_placeholders || template.detected_placeholders.length === 0
    )
    
    if (templatesWithoutPlaceholders.length > 0) {
      const templateNames = templatesWithoutPlaceholders.map(t => t.name).join(', ')
      return NextResponse.json({
        success: false,
        error: `Templates not configured properly: ${templateNames}. Please upload DOCX templates with placeholders first.`,
        unconfiguredTemplates: templatesWithoutPlaceholders.map(t => ({ id: t.id, name: t.name }))
      }, { status: 400 })
    }
    
    // Collect all detected placeholders from all templates
    const allDetectedPlaceholders = []
    const templateInfo = []
    
    templates.forEach(template => {
      const detectedPlaceholders = template.detected_placeholders || []
      
      detectedPlaceholders.forEach(placeholder => {
        // Add to collection if not already present
        if (!allDetectedPlaceholders.find(p => p.name === placeholder.name)) {
          allDetectedPlaceholders.push(placeholder)
        }
      })
      
      templateInfo.push({
        id: template.id,
        name: template.name,
        placeholderCount: detectedPlaceholders.length
      })
    })
    
    // Import and apply client field filtering
    const { getCustomPlaceholders } = await import('@/lib/utils/clientFields')
    const customPlaceholders = getCustomPlaceholders(allDetectedPlaceholders)
    
    console.log('Service placeholders processing:', {
      serviceId: id,
      serviceName: service.name,
      totalTemplates: templates.length,
      totalDetectedPlaceholders: allDetectedPlaceholders.length,
      customPlaceholders: customPlaceholders.length
    })
    
    return NextResponse.json({
      success: true,
      placeholders: customPlaceholders,
      serviceName: service.name,
      templateCount: templates.length,
      templateInfo,
      stats: {
        totalPlaceholders: allDetectedPlaceholders.length,
        customPlaceholders: customPlaceholders.length,
        clientFields: allDetectedPlaceholders.length - customPlaceholders.length
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