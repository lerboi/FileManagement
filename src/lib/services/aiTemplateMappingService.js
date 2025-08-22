import { Mistral } from "@mistralai/mistralai";

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY
})

export class AITemplateMappingService {
  
  // Main method to suggest field mappings for HTML templates
  static async suggestFieldMappings(htmlContent, availableFields) {
    try {
      if (!htmlContent || !htmlContent.trim()) {
        throw new Error('HTML content is required')
      }

      if (!availableFields || availableFields.length === 0) {
        throw new Error('Available fields list is required')
      }

      const systemPrompt = `You are an expert at analyzing legal documents and contracts to identify where client data should be inserted.

Your task is to analyze the HTML content of a legal document and suggest where placeholders for client data should be placed.

Available client database fields:
${availableFields.map(field => `- ${field.name}: ${field.description}${field.computed ? ' (computed field)' : ''}`).join('\n')}

CRITICAL INSTRUCTIONS:
1. You must return the EXACT same HTML content with NO changes to formatting, structure, or styling
2. Only add placeholder spans like <span class="field-placeholder">{{field_name}}</span> where appropriate
3. Look for text that represents client information that should be replaced with database fields
4. Common patterns to look for:
   - Names of people (should be {{full_name}} or {{first_name}} {{last_name}})
   - Addresses (should be {{address_line_1}}, {{city}}, etc.)
   - Contact information ({{email}}, {{phone}})
   - Occupation/job titles ({{occupation}})
   - Company names ({{company}})
   - Dates that should be current date ({{current_date}})
5. Do NOT replace existing placeholders that are already in {{field}} format
6. Be conservative - only replace text that clearly represents client data
7. Preserve all HTML structure, CSS classes, and formatting exactly
8. Only use field names from the provided available fields list

Return ONLY the modified HTML content with placeholders added. Do not include any explanation or additional text.`

      const userPrompt = `Analyze this legal document HTML and add appropriate client data placeholders:

${htmlContent}`

      const response = await mistral.chat.complete({
        model: "mistral-large-latest",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        max_tokens: 8000,
        temperature: 0.1
      })

      const enhancedHtml = response.choices[0]?.message?.content

      if (!enhancedHtml) {
        throw new Error('No response from Mistral AI')
      }

      // Clean up the response (remove any markdown code blocks if present)
      let cleanedHtml = enhancedHtml.trim()
      
      // Remove markdown code blocks if present
      if (cleanedHtml.startsWith('```html')) {
        cleanedHtml = cleanedHtml.replace(/^```html\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedHtml.startsWith('```')) {
        cleanedHtml = cleanedHtml.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }

      // Extract the changes made for review
      const changes = this.extractChanges(htmlContent, cleanedHtml)

      return {
        success: true,
        enhancedHtml: cleanedHtml,
        changes,
        fieldCount: this.countPlaceholders(cleanedHtml)
      }

    } catch (error) {
      console.error('Error in Mistral AI field mapping:', error)
      return {
        success: false,
        error: error.message,
        enhancedHtml: htmlContent, // Return original on error
        changes: [],
        fieldCount: 0
      }
    }
  }

  // Extract what changes were made by comparing original and enhanced HTML
  static extractChanges(originalHtml, enhancedHtml) {
    const changes = []
    
    try {
      // Find all placeholders in the enhanced HTML
      const placeholderRegex = /<span class="field-placeholder">\{\{([^}]+)\}\}<\/span>/g
      let match

      while ((match = placeholderRegex.exec(enhancedHtml)) !== null) {
        const fieldName = match[1]
        const placeholder = match[0]
        
        changes.push({
          field: fieldName,
          placeholder: placeholder,
          position: match.index
        })
      }

      // Also find direct {{field}} placeholders that might have been added
      const directPlaceholderRegex = /\{\{([^}]+)\}\}/g
      let directMatch

      while ((directMatch = directPlaceholderRegex.exec(enhancedHtml)) !== null) {
        const fieldName = directMatch[1]
        const placeholder = directMatch[0]
        
        // Check if this is not already in our changes (to avoid duplicates)
        const alreadyExists = changes.some(change => 
          change.field === fieldName && change.position === directMatch.index
        )
        
        if (!alreadyExists) {
          changes.push({
            field: fieldName,
            placeholder: placeholder,
            position: directMatch.index,
            type: 'direct'
          })
        }
      }
    } catch (error) {
      console.error('Error extracting changes:', error)
    }

    return changes
  }

  // Count placeholders in HTML
  static countPlaceholders(html) {
    try {
      const placeholderRegex = /\{\{([^}]+)\}\}/g
      const matches = html.match(placeholderRegex)
      return matches ? matches.length : 0
    } catch (error) {
      console.error('Error counting placeholders:', error)
      return 0
    }
  }

  // Manual field mapping - replace selected text with placeholder
  static applyManualMapping(htmlContent, selectedText, fieldName) {
    try {
      if (!htmlContent || !selectedText || !fieldName) {
        throw new Error('HTML content, selected text, and field name are required')
      }

      // Create the placeholder span
      const placeholder = `<span class="field-placeholder">{{${fieldName}}}</span>`
      
      // Escape special regex characters in the selected text
      const escapedText = this.escapeRegExp(selectedText)
      
      // Replace the selected text with the placeholder (global replace)
      const modifiedHtml = htmlContent.replace(
        new RegExp(escapedText, 'g'),
        placeholder
      )

      return {
        success: true,
        modifiedHtml,
        change: {
          originalText: selectedText,
          field: fieldName,
          placeholder
        }
      }
    } catch (error) {
      console.error('Error applying manual mapping:', error)
      return {
        success: false,
        error: error.message,
        modifiedHtml: htmlContent
      }
    }
  }

  // Remove a field mapping
  static removeFieldMapping(htmlContent, fieldName) {
    try {
      if (!htmlContent || !fieldName) {
        throw new Error('HTML content and field name are required')
      }

      // Remove placeholder spans
      const spanRegex = new RegExp(
        `<span class="field-placeholder">\\{\\{${this.escapeRegExp(fieldName)}\\}\\}</span>`,
        'g'
      )
      
      // Remove direct placeholders
      const directRegex = new RegExp(
        `\\{\\{${this.escapeRegExp(fieldName)}\\}\\}`,
        'g'
      )
      
      let modifiedHtml = htmlContent.replace(spanRegex, `[${fieldName.toUpperCase()}]`)
      modifiedHtml = modifiedHtml.replace(directRegex, `[${fieldName.toUpperCase()}]`)

      return {
        success: true,
        modifiedHtml
      }
    } catch (error) {
      console.error('Error removing field mapping:', error)
      return {
        success: false,
        error: error.message,
        modifiedHtml: htmlContent
      }
    }
  }

  // Validate HTML structure
  static validateHtmlStructure(html) {
    try {
      if (!html) {
        return {
          valid: false,
          errors: ['HTML content is empty']
        }
      }

      // Basic validation to ensure HTML is well-formed
      if (typeof window !== 'undefined') {
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = html
        
        // Check if parsing was successful
        if (tempDiv.innerHTML !== html) {
          console.warn('HTML structure may have been modified during parsing')
        }
      }
      
      return {
        valid: true,
        errors: []
      }
    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      }
    }
  }

  // Preview the changes that would be made
  static previewFieldMapping(htmlContent, selectedText, fieldName) {
    try {
      const result = this.applyManualMapping(htmlContent, selectedText, fieldName)
      
      if (result.success) {
        return {
          success: true,
          preview: result.modifiedHtml,
          change: result.change
        }
      } else {
        return {
          success: false,
          error: result.error
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Get all current field mappings in the HTML
  static getCurrentMappings(htmlContent) {
    try {
      const mappings = []
      
      // Find all placeholders
      const placeholderRegex = /\{\{([^}]+)\}\}/g
      let match

      while ((match = placeholderRegex.exec(htmlContent)) !== null) {
        const fieldName = match[1]
        const placeholder = match[0]
        
        mappings.push({
          field: fieldName,
          placeholder: placeholder,
          position: match.index
        })
      }

      return {
        success: true,
        mappings
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        mappings: []
      }
    }
  }

  // Utility function to escape regex special characters
  static escapeRegExp(string) {
    if (typeof string !== 'string') {
      return ''
    }
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}