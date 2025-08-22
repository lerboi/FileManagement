// src/lib/services/documentProcessingService.js
import mammoth from 'mammoth'
import { createServerSupabase } from '@/lib/supabase'

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
    // Add necessary CSS classes and styles for better Word conversion
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

  // AI-powered field mapping
  static async suggestFieldMappings(htmlContent) {
    try {
      const response = await fetch('/api/ai/suggest-field-mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          htmlContent,
          availableFields: this.getAvailableFields()
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
      // This is a simplified approach - in practice, you'd need more sophisticated text replacement
      const regex = new RegExp(escapeRegExp(placeholder), 'gi')
      processedHtml = processedHtml.replace(regex, placeholderHtml)
    })

    return processedHtml
  }

  // Get available database fields for mapping
  static getAvailableFields() {
    return [
      { name: 'first_name', label: 'First Name', description: 'Client first name' },
      { name: 'last_name', label: 'Last Name', description: 'Client last name' },
      { name: 'full_name', label: 'Full Name', description: 'Complete client name (computed)', computed: true },
      { name: 'email', label: 'Email', description: 'Client email address' },
      { name: 'phone', label: 'Phone', description: 'Client phone number' },
      { name: 'address_line_1', label: 'Address Line 1', description: 'Primary address' },
      { name: 'address_line_2', label: 'Address Line 2', description: 'Secondary address' },
      { name: 'city', label: 'City', description: 'City name' },
      { name: 'state', label: 'State', description: 'State or province' },
      { name: 'postal_code', label: 'Postal Code', description: 'ZIP/postal code' },
      { name: 'country', label: 'Country', description: 'Country name' },
      { name: 'date_of_birth', label: 'Date of Birth', description: 'Client date of birth' },
      { name: 'occupation', label: 'Occupation', description: 'Job title or profession' },
      { name: 'company', label: 'Company', description: 'Employer or company name' },
      { name: 'notes', label: 'Notes', description: 'Additional notes about client' },
      { name: 'current_date', label: 'Current Date', description: 'Today\'s date', computed: true },
      { name: 'current_year', label: 'Current Year', description: 'Current year', computed: true }
    ]
  }

  // Save template to database
  static async saveTemplate(templateData) {
    try {
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
        template: data
      }
    } catch (error) {
      console.error('Error saving template:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Get all templates
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

      return {
        success: true,
        templates: data || []
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
}

// Utility function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}