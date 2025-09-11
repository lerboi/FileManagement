// src/app/api/documents/generate/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    // Check authentication
    await requireSession()

    const { templateId, clientId, customFieldValues = {} } = await request.json()

    console.log('Document generation request:', { templateId, clientId, customFieldValues })

    if (!templateId || !clientId) {
      return NextResponse.json(
        { error: 'Template ID and Client ID are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabase()

    // Fetch template with both HTML versions
    console.log('Fetching template with dual HTML content...')
    const { data: template, error: templateError } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (templateError) {
      console.error('Template fetch error:', templateError)
      throw new Error(`Failed to fetch template: ${templateError.message}`)
    }

    if (template.status !== 'active') {
      return NextResponse.json(
        { error: 'Template must be active to generate documents' },
        { status: 400 }
      )
    }

    // Fetch client
    console.log('Fetching client...')
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    if (clientError) {
      console.error('Client fetch error:', clientError)
      throw new Error(`Failed to fetch client: ${clientError.message}`)
    }

    // Generate clean document for Word conversion
    console.log('Generating clean document for Word conversion...')
    const cleanGeneratedHtml = generateDocumentFromTemplate(
      template.html_content, // Use clean HTML
      client, 
      customFieldValues,
      template.custom_fields || []
    )

    // Generate enhanced document for web preview
    console.log('Generating enhanced document for web preview...')
    const enhancedSourceHtml = template.enhanced_html_content || template.html_content
    const enhancedGeneratedHtml = generateDocumentFromTemplate(
      enhancedSourceHtml,
      client, 
      customFieldValues,
      template.custom_fields || []
    )

    // Create document record with both versions
    const documentData = {
      template_id: templateId,
      client_id: clientId,
      generated_content: cleanGeneratedHtml, // Clean for Word
      enhanced_generated_content: enhancedGeneratedHtml, // Enhanced for web
      original_template_name: template.name,
      client_name: `${client.first_name} ${client.last_name}`,
      status: 'generated',
      created_at: new Date().toISOString(),
      custom_field_values: customFieldValues
    }

    console.log('Saving document with dual HTML versions...', {
      cleanLength: cleanGeneratedHtml.length,
      enhancedLength: enhancedGeneratedHtml.length
    })

    const { data: savedDocument, error: saveError } = await supabase
      .from('generated_documents')
      .insert([documentData])
      .select()
      .single()

    if (saveError) {
      console.error('Document save error:', saveError)
      throw new Error(`Failed to save document: ${saveError.message}`)
    }

    console.log('Document generated successfully with dual versions:', savedDocument.id)

    return NextResponse.json({
      success: true,
      document: savedDocument,
      generatedHtml: enhancedGeneratedHtml // Return enhanced for immediate web display
    })

  } catch (error) {
    console.error('Error generating document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate document' },
      { status: 500 }
    )
  }
}

// Helper function to replace template fields with client data and custom field values
function generateDocumentFromTemplate(htmlContent, client, customFieldValues = {}, templateCustomFields = []) {
  console.log('Processing template with client data and custom fields...')
  console.log('Template custom fields from database:', templateCustomFields)
  console.log('Custom field values provided by user:', customFieldValues)
  
  let processedHtml = htmlContent

  // Define field mappings for client data (existing system fields)
  const fieldMappings = {
    'first_name': client.first_name || '',
    'last_name': client.last_name || '',
    'full_name': `${client.first_name || ''} ${client.last_name || ''}`.trim(),
    'email': client.email || '',
    'phone': client.phone || '',
    'address_line_1': client.address_line_1 || '',
    'address_line_2': client.address_line_2 || '',
    'city': client.city || '',
    'state': client.state || '',
    'postal_code': client.postal_code || '',
    'country': client.country || '',
    'date_of_birth': client.date_of_birth ? formatDate(client.date_of_birth) : '',
    'occupation': client.occupation || '',
    'company': client.company || '',
    'current_date': formatDate(new Date()),
    'current_year': new Date().getFullYear().toString(),
    'full_address': buildFullAddress(client)
  }

  // Add custom field values using exact field names from template's custom_fields
  console.log('Processing custom fields...')
  templateCustomFields.forEach(customField => {
    if (customField.name) {
      const fieldName = customField.name
      const fieldValue = customFieldValues[fieldName] || customField.defaultValue || ''
      
      console.log(`Mapping custom field: "${fieldName}" -> "${fieldValue}"`)
      fieldMappings[fieldName] = fieldValue
      
      // Also add the field by label as a fallback (in case placeholders use label instead of name)
      if (customField.label && customField.label !== fieldName) {
        const labelAsFieldName = customField.label.toLowerCase().replace(/[^a-z0-9]/g, '_')
        console.log(`Adding label mapping: "${labelAsFieldName}" -> "${fieldValue}"`)
        fieldMappings[labelAsFieldName] = fieldValue
      }
    }
  })

  console.log('Final field mappings:', Object.keys(fieldMappings))

  // Find all placeholders in the template first for debugging
  const placeholderMatches = processedHtml.match(/\{\{([^}]+)\}\}/g) || []
  const uniquePlaceholders = [...new Set(placeholderMatches)]
  console.log('Found placeholders in template:', uniquePlaceholders)

  // Replace all field placeholders
  Object.entries(fieldMappings).forEach(([fieldName, fieldValue]) => {
    // Create regex patterns for different placeholder formats
    const patterns = [
      // Span-wrapped placeholders (from template editor)
      new RegExp(
        `<span[^>]*class="field-placeholder"[^>]*>\\{\\{${escapeRegExp(fieldName)}\\}\\}</span>`,
        'gi'
      ),
      // Direct placeholders
      new RegExp(`\\{\\{${escapeRegExp(fieldName)}\\}\\}`, 'gi')
    ]
    
    let totalReplacements = 0
    patterns.forEach(regex => {
      const matches = processedHtml.match(regex) || []
      if (matches.length > 0) {
        processedHtml = processedHtml.replace(regex, fieldValue)
        totalReplacements += matches.length
      }
    })
    
    if (totalReplacements > 0) {
      console.log(`✓ Replaced ${totalReplacements} instances of {{${fieldName}}} with "${fieldValue}"`)
    }
  })

  // Check for any remaining unmapped placeholders
  const finalRemainingPlaceholders = processedHtml.match(/\{\{([^}]+)\}\}/g)
  if (finalRemainingPlaceholders) {
    console.warn('Unmapped placeholders found:', finalRemainingPlaceholders)
    
    // Try to identify if these are custom fields that weren't provided values
    finalRemainingPlaceholders.forEach(placeholder => {
      const fieldName = placeholder.replace(/[{}]/g, '')
      
      // Check if this matches any custom field from the template
      const matchingCustomField = templateCustomFields.find(cf => 
        cf.name === fieldName || 
        cf.label?.toLowerCase().replace(/[^a-z0-9]/g, '_') === fieldName
      )
      
      if (matchingCustomField) {
        console.warn(`Custom field "${fieldName}" found in template but no value provided`)
        // Replace with a more descriptive placeholder
        processedHtml = processedHtml.replace(
          new RegExp(escapeRegExp(placeholder), 'g'),
          `[${matchingCustomField.label || fieldName} - NO VALUE PROVIDED]`
        )
      } else {
        // Unknown field
        processedHtml = processedHtml.replace(
          new RegExp(escapeRegExp(placeholder), 'g'),
          `[${fieldName.toUpperCase()}_NOT_FOUND]`
        )
      }
    })
  }

  console.log('Document processing completed')
  return processedHtml
}

// Helper function to format dates
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Helper function to build full address
function buildFullAddress(client) {
  const addressParts = []
  
  if (client.address_line_1) addressParts.push(client.address_line_1)
  if (client.address_line_2) addressParts.push(client.address_line_2)
  if (client.city) addressParts.push(client.city)
  if (client.state) addressParts.push(client.state)
  if (client.postal_code) addressParts.push(client.postal_code)
  if (client.country) addressParts.push(client.country)
  
  return addressParts.join(', ')
}

// Helper function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}