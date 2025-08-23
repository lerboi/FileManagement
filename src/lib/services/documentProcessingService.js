// src/lib/services/documentProcessingService.js
import mammoth from 'mammoth'
import { createServerSupabase } from '@/lib/supabase'
import { FieldSchemaService } from './fieldSchemaService'

export class DocumentProcessingService {
  
  // Convert Word document to HTML
  static async convertWordToHtml(fileBuffer, fileName) {
    try {
      const result = await mammoth.convertToHtml(fileBuffer, {
        styleMap: [
          // Preserve important styling
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "b => strong",
          "i => em",
          "u => u"
        ],
        convertImage: mammoth.images.imgElement(function(image) {
          // Handle images in documents
          return image.read("base64").then(function(imageBuffer) {
            return {
              src: "data:" + image.contentType + ";base64," + imageBuffer
            }
          })
        })
      })

      // Clean up and enhance HTML for better preservation
      const enhancedHtml = this.enhanceHtmlForPreservation(result.value)

      return {
        success: true,
        html: enhancedHtml,
        messages: result.messages,
        warnings: result.messages.filter(m => m.type === 'warning'),
        errors: result.messages.filter(m => m.type === 'error')
      }
    } catch (error) {
      console.error('Error converting Word to HTML:', error)
      return {
        success: false,
        error: error.message,
        html: null
      }
    }
  }

  // Enhance HTML to preserve formatting when converting back to Word
  static enhanceHtmlForPreservation(html) {
    const enhancedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.5;
            margin: 1in;
            color: #000;
          }
          h1, h2, h3, h4, h5, h6 {
            font-weight: bold;
            margin-top: 12pt;
            margin-bottom: 6pt;
          }
          h1 { font-size: 16pt; }
          h2 { font-size: 14pt; }
          h3 { font-size: 12pt; }
          p {
            margin-top: 0pt;
            margin-bottom: 6pt;
            text-align: justify;
          }
          strong { font-weight: bold; }
          em { font-style: italic; }
          u { text-decoration: underline; }
          .field-placeholder {
            background-color: #ffffcc;
            border: 1px solid #ffcc00;
            padding: 2px 4px;
            font-weight: bold;
            color: #cc6600;
          }
          .signature-line {
            border-bottom: 1px solid #000;
            width: 200px;
            height: 20px;
            display: inline-block;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 6pt 0;
          }
          th, td {
            border: 1px solid #000;
            padding: 6pt;
            text-align: left;
          }
          th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `
    
    return enhancedHtml
  }

  // AI-powered field mapping using dynamic schema
  static async suggestFieldMappings(htmlContent) {
    try {
      const response = await fetch('/api/ai/suggest-field-mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          htmlContent,
          availableFields: await this.getAvailableFields()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get AI suggestions')
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting AI field suggestions:', error)
      return {
        success: false,
        error: error.message,
        suggestions: []
      }
    }
  }

  // Apply field mappings to HTML content
  static applyFieldMappings(htmlContent, mappings) {
    let processedHtml = htmlContent

    Object.entries(mappings).forEach(([placeholder, fieldName]) => {
      // Create a highlighted placeholder that's easy to identify
      const placeholderHtml = `<span class="field-placeholder">{{${fieldName}}}</span>`
      
      // Replace the selected text with the placeholder
      const regex = new RegExp(escapeRegExp(placeholder), 'gi')
      processedHtml = processedHtml.replace(regex, placeholderHtml)
    })

    return processedHtml
  }

  // Get available database fields for mapping (now dynamic)
  static async getAvailableFields() {
    try {
      return await FieldSchemaService.getAvailableFieldsForAI()
    } catch (error) {
      console.error('Error getting dynamic fields, using fallback:', error)
      // Fallback to basic fields if dynamic discovery fails
      return [
        { name: 'first_name', label: 'First Name', description: 'Client first name' },
        { name: 'last_name', label: 'Last Name', description: 'Client last name' },
        { name: 'full_name', label: 'Full Name', description: 'Complete client name (computed)', computed: true },
        { name: 'email', label: 'Email', description: 'Client email address' },
        { name: 'phone', label: 'Phone', description: 'Client phone number' }
      ]
    }
  }

  // Save template to database with dynamic field validation
  static async saveTemplate(templateData) {
    try {
      // Validate that all field mappings are still valid
      if (templateData.field_mappings) {
        const validationResult = await this.validateFieldMappings(templateData.field_mappings)
        if (!validationResult.valid) {
          console.warn('Some field mappings are invalid:', validationResult.invalidFields)
          // Optionally, you could remove invalid mappings or return an error
        }
      }

      const supabase = await createServerSupabase()
      
      const { data, error } = await supabase
        .from('document_templates')
        .insert([templateData])
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to save template: ${error.message}`)
      }

      return {
        success: true,
        template: data,
        fieldValidation: await this.validateFieldMappings(data.field_mappings || {})
      }
    } catch (error) {
      console.error('Error saving template:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Validate that field mappings still exist in current schema
  static async validateFieldMappings(fieldMappings) {
    try {
      const availableFields = await FieldSchemaService.getClientTableSchema()
      const availableFieldNames = availableFields.map(f => f.name)
      
      const validFields = []
      const invalidFields = []
      
      Object.entries(fieldMappings).forEach(([placeholder, fieldName]) => {
        if (availableFieldNames.includes(fieldName)) {
          validFields.push({ placeholder, fieldName })
        } else {
          invalidFields.push({ placeholder, fieldName })
        }
      })
      
      return {
        valid: invalidFields.length === 0,
        validFields,
        invalidFields,
        totalMappings: Object.keys(fieldMappings).length
      }
    } catch (error) {
      console.error('Error validating field mappings:', error)
      return {
        valid: false,
        error: error.message,
        validFields: [],
        invalidFields: Object.entries(fieldMappings).map(([placeholder, fieldName]) => ({ placeholder, fieldName }))
      }
    }
  }

  // Get all templates with field validation
  static async getTemplates() {
    try {
      const supabase = await createServerSupabase()
      
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch templates: ${error.message}`)
      }

      // Add field validation for each template
      const templatesWithValidation = await Promise.all(
        (data || []).map(async (template) => ({
          ...template,
          fieldValidation: await this.validateFieldMappings(template.field_mappings || {})
        }))
      )

      return {
        success: true,
        templates: templatesWithValidation
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
      return {
        success: false,
        error: error.message,
        templates: []
      }
    }
  }

  // Convert HTML back to Word document
  static async convertHtmlToWord(htmlContent, fileName) {
    try {
      // Use html-docx-js to convert HTML to Word
      const HtmlDocx = require('html-docx-js')
      
      const docxBuffer = HtmlDocx.asBlob(htmlContent, {
        orientation: 'portrait',
        margins: {
          top: 1440, // 1 inch = 1440 twips
          right: 1440,
          bottom: 1440,
          left: 1440
        }
      })

      return {
        success: true,
        buffer: docxBuffer,
        fileName: fileName.replace(/\.[^/.]+$/, '.docx'),
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    } catch (error) {
      console.error('Error converting HTML to Word:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Migration helper: Update existing templates when schema changes
  static async migrateTemplateFields(templateId, fieldMappingChanges) {
    try {
      const supabase = await createServerSupabase()
      
      // Get current template
      const { data: template, error: fetchError } = await supabase
        .from('document_templates')
        .select('*')
        .eq('id', templateId)
        .single()

      if (fetchError) throw fetchError

      // Apply field mapping changes
      let updatedMappings = { ...template.field_mappings }
      
      fieldMappingChanges.forEach(change => {
        switch (change.type) {
          case 'rename':
            // Rename field in mappings
            Object.keys(updatedMappings).forEach(placeholder => {
              if (updatedMappings[placeholder] === change.oldField) {
                updatedMappings[placeholder] = change.newField
              }
            })
            break
          case 'remove':
            // Remove field from mappings
            Object.keys(updatedMappings).forEach(placeholder => {
              if (updatedMappings[placeholder] === change.field) {
                delete updatedMappings[placeholder]
              }
            })
            break
        }
      })

      // Update template HTML content if needed
      let updatedHtml = template.html_content
      fieldMappingChanges.forEach(change => {
        if (change.type === 'rename') {
          const oldPlaceholderRegex = new RegExp(`\\{\\{${escapeRegExp(change.oldField)}\\}\\}`, 'g')
          updatedHtml = updatedHtml.replace(oldPlaceholderRegex, `{{${change.newField}}}`)
        } else if (change.type === 'remove') {
          const placeholderRegex = new RegExp(`\\{\\{${escapeRegExp(change.field)}\\}\\}`, 'g')
          updatedHtml = updatedHtml.replace(placeholderRegex, `[${change.field.toUpperCase()}_REMOVED]`)
        }
      })

      // Save updated template
      const { data, error } = await supabase
        .from('document_templates')
        .update({
          field_mappings: updatedMappings,
          html_content: updatedHtml,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        template: data,
        changes: fieldMappingChanges
      }
    } catch (error) {
      console.error('Error migrating template fields:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

// Utility function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}