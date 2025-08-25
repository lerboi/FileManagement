// src/app/api/documents/generate/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    // Check authentication
    await requireAuth()

    const { templateId, clientId, customFieldValues = {} } = await request.json()

    console.log('Document generation request:', { templateId, clientId, customFieldValues })

    if (!templateId || !clientId) {
      return NextResponse.json(
        { error: 'Template ID and Client ID are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabase()

    // Fetch template
    console.log('Fetching template...')
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

    // Generate document
    console.log('Generating document...')
    const generatedHtml = generateDocumentFromTemplate(template.html_content, client, customFieldValues)

    // Create document record
    const documentData = {
      template_id: templateId,
      client_id: clientId,
      generated_content: generatedHtml,
      original_template_name: template.name,
      client_name: `${client.first_name} ${client.last_name}`,
      status: 'generated',
      created_at: new Date().toISOString(),
      custom_field_values: customFieldValues // Store custom field values used
    }

    console.log('Saving document record...')
    const { data: savedDocument, error: saveError } = await supabase
      .from('generated_documents')
      .insert([documentData])
      .select()
      .single()

    if (saveError) {
      console.error('Document save error:', saveError)
      throw new Error(`Failed to save document: ${saveError.message}`)
    }

    console.log('Document generated successfully:', savedDocument.id)

    return NextResponse.json({
      success: true,
      document: savedDocument,
      generatedHtml
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
function generateDocumentFromTemplate(htmlContent, client, customFieldValues = {}) {
  console.log('Processing template with client data and custom fields...')
  
  let processedHtml = htmlContent

  // Define field mappings for client data
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

  // Add custom field values to field mappings with multiple name variations
  Object.entries(customFieldValues).forEach(([fieldName, fieldValue]) => {
    // Add the original field name
    fieldMappings[fieldName] = fieldValue || ''
    
    // Add variations to handle different naming conventions
    const normalizedName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const originalCase = fieldName
    const upperCase = fieldName.toUpperCase()
    const lowerCase = fieldName.toLowerCase()
    
    // Map all variations to the same value
    fieldMappings[normalizedName] = fieldValue || ''
    fieldMappings[originalCase] = fieldValue || ''
    fieldMappings[upperCase] = fieldValue || ''
    fieldMappings[lowerCase] = fieldValue || ''
  })

  console.log('Available field mappings:', Object.keys(fieldMappings))
  console.log('Custom field values received:', customFieldValues)

  // Find all placeholders in the template first
  const placeholderMatches = processedHtml.match(/\{\{([^}]+)\}\}/g) || []
  const uniquePlaceholders = [...new Set(placeholderMatches)]
  console.log('Found placeholders in template:', uniquePlaceholders)

  // Replace all field placeholders with case-insensitive matching
  Object.entries(fieldMappings).forEach(([fieldName, fieldValue]) => {
    // Create multiple regex patterns for different placeholder formats
    const patterns = [
      // Span-wrapped placeholders
      new RegExp(
        `<span[^>]*class="field-placeholder"[^>]*>\\{\\{${escapeRegExp(fieldName)}\\}\\}</span>`,
        'gi'
      ),
      // Direct placeholders (case-insensitive)
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
      console.log(`Replaced ${totalReplacements} instances of {{${fieldName}}} with "${fieldValue}"`)
    }
  })

  // Final pass: try to match any remaining custom field placeholders by finding similar names
  const stillRemainingPlaceholders = processedHtml.match(/\{\{([^}]+)\}\}/g) || []
  
  stillRemainingPlaceholders.forEach(placeholder => {
    const placeholderName = placeholder.replace(/[{}]/g, '')
    
    // Try to find a matching custom field value by comparing normalized names
    Object.entries(customFieldValues).forEach(([customFieldName, customFieldValue]) => {
      const normalizedPlaceholder = placeholderName.toLowerCase().replace(/[^a-z0-9]/g, '')
      const normalizedCustomField = customFieldName.toLowerCase().replace(/[^a-z0-9]/g, '')
      
      if (normalizedPlaceholder === normalizedCustomField) {
        console.log(`Fuzzy matching: ${placeholder} -> ${customFieldName} = "${customFieldValue}"`)
        processedHtml = processedHtml.replace(
          new RegExp(escapeRegExp(placeholder), 'g'),
          customFieldValue || ''
        )
      }
    })
  })

  // Clean up any remaining unmapped placeholders
  const finalRemainingPlaceholders = processedHtml.match(/\{\{([^}]+)\}\}/g)
  if (finalRemainingPlaceholders) {
    console.warn('Still unmapped placeholders found:', finalRemainingPlaceholders)
    finalRemainingPlaceholders.forEach(placeholder => {
      const fieldName = placeholder.replace(/[{}]/g, '')
      // Instead of showing [FIELDNAME], show a more user-friendly message
      processedHtml = processedHtml.replace(
        new RegExp(escapeRegExp(placeholder), 'g'),
        `[${fieldName.toUpperCase()}_NOT_FOUND]`
      )
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