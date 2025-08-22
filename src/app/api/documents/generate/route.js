// src/app/api/documents/generate/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    // Check authentication
    await requireAuth()

    const { templateId, clientId } = await request.json()

    console.log('Document generation request:', { templateId, clientId })

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
    const generatedHtml = generateDocumentFromTemplate(template.html_content, client)

    // Create document record
    const documentData = {
      template_id: templateId,
      client_id: clientId,
      generated_content: generatedHtml,
      original_template_name: template.name,
      client_name: `${client.first_name} ${client.last_name}`,
      status: 'generated',
      created_at: new Date().toISOString()
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

// Helper function to replace template fields with client data
function generateDocumentFromTemplate(htmlContent, client) {
  console.log('Processing template with client data...')
  
  let processedHtml = htmlContent

  // Define field mappings
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

  console.log('Available field mappings:', Object.keys(fieldMappings))

  // Replace all field placeholders
  Object.entries(fieldMappings).forEach(([fieldName, fieldValue]) => {
    // Replace both span-wrapped and direct placeholders
    const spanRegex = new RegExp(
      `<span[^>]*class="field-placeholder"[^>]*>\\{\\{${escapeRegExp(fieldName)}\\}\\}</span>`,
      'g'
    )
    const directRegex = new RegExp(`\\{\\{${escapeRegExp(fieldName)}\\}\\}`, 'g')
    
    const replacementCount = (processedHtml.match(spanRegex) || []).length + 
                            (processedHtml.match(directRegex) || []).length
    
    if (replacementCount > 0) {
      console.log(`Replacing ${replacementCount} instances of {{${fieldName}}} with "${fieldValue}"`)
    }
    
    processedHtml = processedHtml.replace(spanRegex, fieldValue)
    processedHtml = processedHtml.replace(directRegex, fieldValue)
  })

  // Clean up any remaining unmapped placeholders
  const remainingPlaceholders = processedHtml.match(/\{\{([^}]+)\}\}/g)
  if (remainingPlaceholders) {
    console.warn('Unmapped placeholders found:', remainingPlaceholders)
    remainingPlaceholders.forEach(placeholder => {
      const fieldName = placeholder.replace(/[{}]/g, '')
      processedHtml = processedHtml.replace(
        new RegExp(escapeRegExp(placeholder), 'g'),
        `[${fieldName.toUpperCase()}]`
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