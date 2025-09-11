// src/app/api/documents/generate/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { DocxtemplaterService } from '@/lib/services/docxtemplaterService'
import { createServerSupabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    // Check authentication
    await requireSession()

    const { templateId, clientId, customFieldValues = {} } = await request.json()

    console.log('Document generation request:', { templateId, clientId, customFieldValues })

    if (!templateId || !clientId) {
      return NextResponse.json({ error: 'Template ID and Client ID are required' },
        { status: 400 }
      )
    }

    // Generate document using Docxtemplater
    const result = await DocxtemplaterService.generateDocument(
      templateId, 
      clientId, 
      customFieldValues
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    console.log('Document generated successfully:', result.document.id)

    // Return the generated document buffer for download
    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Content-Length': result.buffer.length.toString(),
        'X-Document-ID': result.document.id // Include document ID in header
      }
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