// src/lib/services/docxtemplaterService.js
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { createServerSupabase } from '@/lib/supabase'

export class DocxtemplaterService {
  
  // Generate document using Docxtemplater
  static async generateDocument(templateId, clientId, customFieldValues = {}) {
    try {
      const supabase = await createServerSupabase()

      // Fetch template
      console.log('Fetching template for generation...')
      const { data: template, error: templateError } = await supabase
        .from('document_templates')
        .select('*')
        .eq('id', templateId)
        .single()

      if (templateError) {
        throw new Error(`Failed to fetch template: ${templateError.message}`)
      }

      if (template.status !== 'active') {
        throw new Error('Template must be active to generate documents')
      }

      // Fetch client data
      console.log('Fetching client data...')
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (clientError) {
        throw new Error(`Failed to fetch client: ${clientError.message}`)
      }

      // Download DOCX file from storage
      console.log('Downloading DOCX template from storage...')
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('document-templates')
        .download(template.docx_file_path)

      if (downloadError) {
        throw new Error(`Failed to download template file: ${downloadError.message}`)
      }

      // Convert blob to buffer
      const fileBuffer = await fileData.arrayBuffer()
      
      // Prepare data for template
      const templateData = this.prepareTemplateData(client, customFieldValues, template)
      
      // Generate document using Docxtemplater
      const generatedBuffer = await this.processDocxTemplate(fileBuffer, templateData)
      
      // Save generated document record
      const documentRecord = await this.saveGeneratedDocument({
        templateId,
        clientId,
        template,
        client,
        customFieldValues,
        templateData
      })

      return {
        success: true,
        document: documentRecord,
        buffer: generatedBuffer,
        fileName: this.generateFileName(template.name, client),
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }

    } catch (error) {
      console.error('Error generating document:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Process DOCX template with Docxtemplater
  static async processDocxTemplate(fileBuffer, templateData) {
    try {
      // Load the DOCX file
      const zip = new PizZip(fileBuffer)
      
      // Create Docxtemplater instance
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: function(part, scopeManager) {
          // Handle missing values gracefully
          console.warn(`Missing template value: ${part.value}`)
          return `[${part.value.toUpperCase()}_NOT_PROVIDED]`
        }
      })

      // Set the template data
      doc.render(templateData)

      // Generate the document
      const generatedBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE'
      })

      console.log('Document generated successfully with Docxtemplater')
      return generatedBuffer

    } catch (error) {
      console.error('Docxtemplater processing error:', error)
      
      // Provide detailed error information
      if (error.properties) {
        console.error('Error details:', {
          id: error.properties.id,
          explanation: error.properties.explanation,
          scope: error.properties.scope
        })
      }
      
      throw new Error(`Template processing failed: ${error.message}`)
    }
  }

  // Prepare template data from client and custom fields
  static prepareTemplateData(client, customFieldValues = {}, template) {
    console.log('Preparing template data for generation...')
    
    // Base client data mappings
    const templateData = {
      // Personal information
      first_name: client.first_name || '',
      last_name: client.last_name || '',
      full_name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
      
      // Contact information
      email: client.email || '',
      phone: client.phone || '',
      
      // Address information
      address_line_1: client.address_line_1 || '',
      address_line_2: client.address_line_2 || '',
      city: client.city || '',
      state: client.state || '',
      postal_code: client.postal_code || '',
      country: client.country || '',
      full_address: this.buildFullAddress(client),
      
      // Professional information
      occupation: client.occupation || '',
      company: client.company || '',
      
      // Personal details
      date_of_birth: client.date_of_birth ? this.formatDate(client.date_of_birth) : '',
      
      // System fields
      current_date: this.formatDate(new Date()),
      current_year: new Date().getFullYear().toString(),
      
      // Custom field values
      ...customFieldValues
    }

    // Add detected placeholder mappings if available
    if (template.detected_placeholders) {
      template.detected_placeholders.forEach(placeholder => {
        const fieldName = placeholder.name
        const fieldInfo = placeholder.field
        
        // If this placeholder maps to a known field, ensure it's included
        if (fieldInfo && fieldInfo.name && templateData[fieldInfo.name] !== undefined) {
          templateData[fieldName] = templateData[fieldInfo.name]
        }
      })
    }

    console.log('Template data prepared:', {
      clientFields: Object.keys(templateData).filter(k => templateData[k] && typeof templateData[k] === 'string').length,
      customFields: Object.keys(customFieldValues).length,
      totalFields: Object.keys(templateData).length
    })

    return templateData
  }

  // Save generated document record to database
  static async saveGeneratedDocument({ templateId, clientId, template, client, customFieldValues, templateData }) {
    try {
      const supabase = await createServerSupabase()

      const documentData = {
        template_id: templateId,
        client_id: clientId,
        original_template_name: template.name,
        client_name: `${client.first_name} ${client.last_name}`,
        status: 'generated',
        created_at: new Date().toISOString(),
        custom_field_values: customFieldValues,
        // Store the actual data used for generation
        generated_data: templateData,
        generation_method: 'docxtemplater'
      }

      const { data: savedDocument, error: saveError } = await supabase
        .from('generated_documents')
        .insert([documentData])
        .select()
        .single()

      if (saveError) {
        throw new Error(`Failed to save document record: ${saveError.message}`)
      }

      console.log('Generated document record saved:', savedDocument.id)
      return savedDocument

    } catch (error) {
      console.error('Error saving generated document record:', error)
      throw error
    }
  }

  // Utility: Format dates consistently
  static formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Utility: Build full address string
  static buildFullAddress(client) {
    const addressParts = []
    
    if (client.address_line_1) addressParts.push(client.address_line_1)
    if (client.address_line_2) addressParts.push(client.address_line_2)
    if (client.city) addressParts.push(client.city)
    if (client.state) addressParts.push(client.state)
    if (client.postal_code) addressParts.push(client.postal_code)
    if (client.country) addressParts.push(client.country)
    
    return addressParts.join(', ')
  }

  // Utility: Generate meaningful file names
  static generateFileName(templateName, client) {
    const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim()
    const datePart = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    
    // Clean template name for filename
    const cleanTemplateName = templateName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
    const cleanClientName = clientName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
    
    return `${cleanTemplateName}_${cleanClientName}_${datePart}.docx`
  }

  // Preview template data (for debugging/validation)
  static async previewTemplateData(templateId, clientId, customFieldValues = {}) {
    try {
      const supabase = await createServerSupabase()

      // Fetch template and client
      const [templateResult, clientResult] = await Promise.all([
        supabase.from('document_templates').select('*').eq('id', templateId).single(),
        supabase.from('clients').select('*').eq('id', clientId).single()
      ])

      if (templateResult.error) throw new Error(`Template error: ${templateResult.error.message}`)
      if (clientResult.error) throw new Error(`Client error: ${clientResult.error.message}`)

      const templateData = this.prepareTemplateData(
        clientResult.data, 
        customFieldValues, 
        templateResult.data
      )

      return {
        success: true,
        templateData,
        template: templateResult.data,
        client: clientResult.data,
        preview: {
          fileName: this.generateFileName(templateResult.data.name, clientResult.data),
          fieldCount: Object.keys(templateData).length,
          detectedPlaceholders: templateResult.data.detected_placeholders || []
        }
      }

    } catch (error) {
      console.error('Error previewing template data:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}