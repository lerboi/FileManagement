// src/lib/services/docxParsingService.js
import JSZip from 'jszip'
import { createServerSupabase } from '@/lib/supabase'

export class DocxParsingService {
  
  // Extract placeholders from DOCX content
  static async extractPlaceholders(docxBuffer) {
    try {
      const zip = new JSZip()
      const docx = await zip.loadAsync(docxBuffer)
      
      // Get document.xml which contains the main content
      const documentXml = await docx.file('word/document.xml')?.async('text')
      
      if (!documentXml) {
        throw new Error('Invalid DOCX file: document.xml not found')
      }
      
      console.log('Raw document XML length:', documentXml.length)
      
      // Remove all XML tags to get clean text
      const cleanText = documentXml.replace(/<[^>]*>/g, '')
      
      console.log('Clean text sample:', cleanText.substring(0, 500))
      
      // Extract all placeholders matching {field_name} pattern from clean text
      const placeholderRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g
      const placeholders = new Set()
      let match
      
      while ((match = placeholderRegex.exec(cleanText)) !== null) {
        placeholders.add(match[1]) // Add just the field name without braces
        console.log('Found placeholder:', match[1])
      }
      
      console.log('All extracted placeholders:', Array.from(placeholders))
      
      return {
        success: true,
        placeholders: Array.from(placeholders),
        documentContent: cleanText // Return clean text instead of XML
      }
    } catch (error) {
      console.error('Error extracting placeholders from DOCX:', error)
      return {
        success: false,
        error: error.message,
        placeholders: []
      }
    }
  }
  
  // Validate placeholders against available database fields
  static async validatePlaceholders(placeholders) {
    try {
      const { createServerSupabase } = await import('@/lib/supabase')
      const supabase = await createServerSupabase()
      
      // Get basic client fields (hardcoded schema)
      const basicFields = [
        'first_name', 'last_name', 'full_name', 'email', 'phone',
        'company', 'address_line_1', 'address_line_2', 'city', 
        'state', 'postal_code', 'country', 'date_of_birth',
        'occupation', 'current_date', 'current_year'
      ]
      
      // Get custom placeholders from database if table exists
      let customFields = []
      try {
        const { data: customPlaceholders } = await supabase
          .from('document_placeholders')
          .select('name')
        
        if (customPlaceholders) {
          customFields = customPlaceholders.map(p => p.name)
        }
      } catch (error) {
        console.log('No custom placeholders table found, using basic fields only')
      }
      
      const availableFieldNames = [...basicFields, ...customFields]
      
      const validPlaceholders = []
      const invalidPlaceholders = []
      
      placeholders.forEach(placeholder => {
        if (availableFieldNames.includes(placeholder)) {
          validPlaceholders.push({
            name: placeholder,
            field: {
              name: placeholder,
              label: placeholder.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              category: basicFields.includes(placeholder) ? 'client' : 'custom'
            }
          })
        } else {
          invalidPlaceholders.push({
            name: placeholder,
            suggestion: this.findClosestField(placeholder, availableFieldNames)
          })
        }
      })
      
      return {
        success: true,
        valid: invalidPlaceholders.length === 0,
        validPlaceholders,
        invalidPlaceholders,
        totalCount: placeholders.length,
        validCount: validPlaceholders.length,
        invalidCount: invalidPlaceholders.length
      }
    } catch (error) {
      console.error('Error validating placeholders:', error)
      return {
        success: false,
        error: error.message,
        valid: false
      }
    }
  }
  
  // Find closest matching field name for suggestions
  static findClosestField(placeholder, availableFields) {
    const lowerPlaceholder = placeholder.toLowerCase()
    
    // Look for exact matches first
    const exactMatch = availableFields.find(field => 
      field.toLowerCase() === lowerPlaceholder
    )
    if (exactMatch) return exactMatch
    
    // Look for partial matches
    const partialMatches = availableFields.filter(field =>
      field.toLowerCase().includes(lowerPlaceholder) ||
      lowerPlaceholder.includes(field.toLowerCase())
    )
    
    if (partialMatches.length > 0) {
      return partialMatches[0]
    }
    
    // Look for similar fields (common patterns)
    const commonMappings = {
      'name': 'full_name',
      'firstname': 'first_name',
      'lastname': 'last_name',
      'mail': 'email',
      'phone_number': 'phone',
      'address': 'address_line_1',
      'company_name': 'company'
    }
    
    return commonMappings[lowerPlaceholder] || null
  }
  
  // Store DOCX file in Supabase storage bucket
  static async storeDocxFile(fileBuffer, fileName, templateId) {
    try {
      const supabase = await createServerSupabase()
      
      // Create file path
      const filePath = `templates/${templateId}/${fileName}`
      
      // Upload to storage bucket
      const { data, error } = await supabase.storage
        .from('document-templates')
        .upload(filePath, fileBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true
        })
      
      if (error) {
        throw new Error(`Failed to store DOCX file: ${error.message}`)
      }
      
      console.log('DOCX file stored successfully:', filePath)
      
      return {
        success: true,
        filePath: data.path,
        publicUrl: supabase.storage.from('document-templates').getPublicUrl(data.path).data.publicUrl
      }
    } catch (error) {
      console.error('Error storing DOCX file:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  // Complete DOCX processing workflow
  static async processDocxTemplate(fileBuffer, fileName, templateMetadata) {
    try {
      // Step 1: Extract placeholders
      const extractionResult = await this.extractPlaceholders(fileBuffer)
      if (!extractionResult.success) {
        return extractionResult
      }
      
      console.log('Extracted placeholders:', extractionResult.placeholders)
      
      // Step 2: Validate placeholders (only if there are any)
      let validationResult
      if (extractionResult.placeholders.length > 0) {
        validationResult = await this.validatePlaceholders(extractionResult.placeholders)
        if (!validationResult.success) {
          return validationResult
        }
        
        // Step 3: Block upload if invalid placeholders found
        if (!validationResult.valid) {
          return {
            success: false,
            error: 'Template contains invalid placeholders',
            validation: validationResult,
            blockUpload: true
          }
        }
      } else {
        // No placeholders found - create empty validation result
        validationResult = {
          success: true,
          valid: true,
          validPlaceholders: [],
          invalidPlaceholders: [],
          totalCount: 0,
          validCount: 0,
          invalidCount: 0
        }
      }
      
      // Step 4: Generate template ID for storage
      const templateId = crypto.randomUUID()
      
      // Step 5: Store DOCX file
      const storageResult = await this.storeDocxFile(fileBuffer, fileName, templateId)
      if (!storageResult.success) {
        return storageResult
      }
      
      // Step 6: Prepare template data for database
      const templateData = {
        id: templateId,
        name: templateMetadata.name,
        description: templateMetadata.description || '',
        original_filename: fileName,
        docx_file_path: storageResult.filePath,
        detected_placeholders: validationResult.validPlaceholders,
        template_type: 'docx',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      return {
        success: true,
        templateData,
        validation: validationResult,
        storage: storageResult
      }
    } catch (error) {
      console.error('Error processing DOCX template:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}