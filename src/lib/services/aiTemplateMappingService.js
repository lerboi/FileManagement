import { Mistral } from "@mistralai/mistralai";

console.log('=== AITemplateMappingService Module Loading ===')

// Initialize Mistral client with validation
let mistral = null
try {
  const apiKey = process.env.MISTRAL_API_KEY
  console.log('Mistral API Key check:', {
    hasApiKey: !!apiKey,
    keyLength: apiKey?.length || 0,
    keyPrefix: apiKey?.substring(0, 8) + '...' || 'none'
  })
  
  if (!apiKey) {
    console.error('MISTRAL_API_KEY environment variable is not set!')
  } else {
    mistral = new Mistral({
      apiKey: apiKey
    })
    console.log('Mistral client initialized successfully')
  }
} catch (error) {
  console.error('Failed to initialize Mistral client:', error)
}

export class AITemplateMappingService {
  
  // Main method to suggest field mappings for HTML templates
  static async suggestFieldMappings(htmlContent, availableFields) {
    console.log('=== suggestFieldMappings called ===')
    console.log('Input validation:', {
      hasHtmlContent: !!htmlContent,
      htmlContentLength: htmlContent?.length || 0,
      hasAvailableFields: !!availableFields,
      availableFieldsCount: availableFields?.length || 0
    })

    try {
      // Input validation
      if (!htmlContent || !htmlContent.trim()) {
        console.error('HTML content validation failed: empty or null')
        throw new Error('HTML content is required')
      }

      if (!availableFields || availableFields.length === 0) {
        console.error('Available fields validation failed: empty or null')
        throw new Error('Available fields list is required')
      }

      // Check Mistral client
      if (!mistral) {
        console.error('Mistral client is not initialized')
        throw new Error('Mistral AI client is not properly configured. Please check MISTRAL_API_KEY environment variable.')
      }

      console.log('Preparing system prompt...')
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

      console.log('System prompt length:', systemPrompt.length)
      
      const userPrompt = `Analyze this legal document HTML and add appropriate client data placeholders:

${htmlContent}`

      console.log('User prompt length:', userPrompt.length)
      console.log('Making Mistral API call...')

      const requestPayload = {
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
      }

      console.log('Mistral request configuration:', {
        model: requestPayload.model,
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
        maxTokens: requestPayload.max_tokens,
        temperature: requestPayload.temperature
      })

      let response
      try {
        console.log('Calling mistral.chat.complete...')
        response = await mistral.chat.complete(requestPayload)
        console.log('Mistral API call successful')
        console.log('Response structure:', {
          hasChoices: !!response.choices,
          choicesLength: response.choices?.length || 0,
          hasFirstChoice: !!response.choices?.[0],
          hasMessage: !!response.choices?.[0]?.message,
          hasContent: !!response.choices?.[0]?.message?.content
        })
      } catch (apiError) {
        console.error('=== MISTRAL API ERROR ===')
        console.error('API Error details:', {
          message: apiError.message,
          stack: apiError.stack,
          name: apiError.name,
          status: apiError.status,
          statusText: apiError.statusText
        })
        throw new Error(`Mistral API error: ${apiError.message}`)
      }

      const enhancedHtml = response.choices?.[0]?.message?.content

      if (!enhancedHtml) {
        console.error('No content in Mistral response')
        console.log('Full response object:', JSON.stringify(response, null, 2))
        throw new Error('No response content from Mistral AI')
      }

      console.log('Mistral response received:', {
        contentLength: enhancedHtml.length,
        contentType: typeof enhancedHtml,
        contentPreview: typeof enhancedHtml === 'string' ? enhancedHtml.substring(0, 200) + '...' : 'Not a string'
      })

      // Ensure we have a string
      let cleanedHtml = String(enhancedHtml).trim()
      
      // Remove markdown code blocks if present
      if (cleanedHtml.startsWith('```html')) {
        console.log('Removing HTML markdown wrapper')
        cleanedHtml = cleanedHtml.replace(/^```html\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedHtml.startsWith('```')) {
        console.log('Removing generic markdown wrapper')
        cleanedHtml = cleanedHtml.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }

      console.log('Cleaned HTML length:', cleanedHtml.length)

      // Extract the changes made for review
      console.log('Extracting changes...')
      const changes = this.extractChanges(htmlContent, cleanedHtml)
      console.log('Changes extracted:', {
        changesCount: changes.length,
        changesList: changes.map(c => ({ field: c.field, type: c.type || 'span' }))
      })

      const fieldCount = this.countPlaceholders(cleanedHtml)
      console.log('Final field count:', fieldCount)

      console.log('=== suggestFieldMappings completed successfully ===')
      return {
        success: true,
        enhancedHtml: cleanedHtml,
        changes,
        fieldCount
      }

    } catch (error) {
      console.error('=== ERROR in suggestFieldMappings ===')
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      
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
    console.log('=== extractChanges called ===')
    console.log('Comparing HTML:', {
      originalLength: originalHtml?.length || 0,
      enhancedLength: enhancedHtml?.length || 0
    })

    const changes = []
    
    try {
      // Find all placeholders in the enhanced HTML
      console.log('Looking for span placeholders...')
      const placeholderRegex = /<span class="field-placeholder">\{\{([^}]+)\}\}<\/span>/g
      let match
      let spanCount = 0

      while ((match = placeholderRegex.exec(enhancedHtml)) !== null) {
        spanCount++
        const fieldName = match[1]
        const placeholder = match[0]
        
        console.log(`Found span placeholder ${spanCount}:`, {
          field: fieldName,
          position: match.index
        })
        
        changes.push({
          field: fieldName,
          placeholder: placeholder,
          position: match.index,
          type: 'span'
        })
      }

      console.log('Looking for direct placeholders...')
      // Also find direct {{field}} placeholders that might have been added
      const directPlaceholderRegex = /\{\{([^}]+)\}\}/g
      let directMatch
      let directCount = 0

      while ((directMatch = directPlaceholderRegex.exec(enhancedHtml)) !== null) {
        directCount++
        const fieldName = directMatch[1]
        const placeholder = directMatch[0]
        
        // Check if this is not already in our changes (to avoid duplicates)
        const alreadyExists = changes.some(change => 
          change.field === fieldName && Math.abs(change.position - directMatch.index) < 50
        )
        
        if (!alreadyExists) {
          console.log(`Found direct placeholder ${directCount}:`, {
            field: fieldName,
            position: directMatch.index
          })
          
          changes.push({
            field: fieldName,
            placeholder: placeholder,
            position: directMatch.index,
            type: 'direct'
          })
        }
      }

      console.log('Changes extraction complete:', {
        totalChanges: changes.length,
        spanPlaceholders: spanCount,
        directPlaceholders: directCount
      })

    } catch (error) {
      console.error('Error extracting changes:', error)
    }

    return changes
  }

  // Count placeholders in HTML
  static countPlaceholders(html) {
    console.log('=== countPlaceholders called ===')
    try {
      const placeholderRegex = /\{\{([^}]+)\}\}/g
      const matches = html.match(placeholderRegex)
      const count = matches ? matches.length : 0
      console.log('Placeholder count:', {
        count,
        matches: matches?.slice(0, 5) // Show first 5 matches for debugging
      })
      return count
    } catch (error) {
      console.error('Error counting placeholders:', error)
      return 0
    }
  }

  // Manual field mapping - replace selected text with placeholder
  static applyManualMapping(htmlContent, selectedText, fieldName) {
    console.log('=== applyManualMapping called ===')
    console.log('Manual mapping input:', {
      hasHtmlContent: !!htmlContent,
      selectedText,
      fieldName
    })

    try {
      if (!htmlContent || !selectedText || !fieldName) {
        throw new Error('HTML content, selected text, and field name are required')
      }

      // Create the placeholder span
      const placeholder = `<span class="field-placeholder">{{${fieldName}}}</span>`
      console.log('Created placeholder:', placeholder)
      
      // Escape special regex characters in the selected text
      const escapedText = this.escapeRegExp(selectedText)
      console.log('Escaped text for regex:', escapedText)
      
      // Replace the selected text with the placeholder (global replace)
      const modifiedHtml = htmlContent.replace(
        new RegExp(escapedText, 'g'),
        placeholder
      )

      console.log('Manual mapping complete:', {
        originalLength: htmlContent.length,
        modifiedLength: modifiedHtml.length,
        replacements: (modifiedHtml.match(new RegExp(this.escapeRegExp(placeholder), 'g')) || []).length
      })

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
    console.log('=== removeFieldMapping called ===')
    console.log('Remove mapping input:', {
      hasHtmlContent: !!htmlContent,
      fieldName
    })

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

      console.log('Field mapping removal complete:', {
        originalLength: htmlContent.length,
        modifiedLength: modifiedHtml.length
      })

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
    console.log('=== validateHtmlStructure called ===')
    try {
      if (!html) {
        console.log('HTML validation failed: empty content')
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
      
      console.log('HTML validation passed')
      return {
        valid: true,
        errors: []
      }
    } catch (error) {
      console.error('HTML validation error:', error)
      return {
        valid: false,
        errors: [error.message]
      }
    }
  }

  // Preview the changes that would be made
  static previewFieldMapping(htmlContent, selectedText, fieldName) {
    console.log('=== previewFieldMapping called ===')
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
      console.error('Error previewing field mapping:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Get all current field mappings in the HTML
  static getCurrentMappings(htmlContent) {
    console.log('=== getCurrentMappings called ===')
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

      console.log('Current mappings found:', mappings.length)
      return {
        success: true,
        mappings
      }
    } catch (error) {
      console.error('Error getting current mappings:', error)
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
      console.warn('escapeRegExp called with non-string:', typeof string)
      return ''
    }
    const escaped = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    console.log('Escaped regex:', { original: string, escaped })
    return escaped
  }
}