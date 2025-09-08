// src/lib/services/taskDocumentService.js
import { createServerSupabase } from '@/lib/supabase'
import { ClientFieldsService } from './clientFieldsService'

export class TaskDocumentService {
  /**
   * Mark documents as ready for generation and update task status
   */
  static async markDocumentsForGeneration(taskId) {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      const supabase = await createServerSupabase()

      // Fetch task details
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          services!inner(template_ids),
          clients!inner(*)
        `)
        .eq('id', taskId)
        .single()

      if (taskError) {
        throw new Error(`Failed to fetch task: ${taskError.message}`)
      }

      // Fetch template details
      const { data: templates, error: templatesError } = await supabase
        .from('document_templates')
        .select('id, name, description, template_type, html_content, status')
        .in('id', task.services.template_ids)
        .eq('status', 'active')

      if (templatesError) {
        throw new Error(`Failed to fetch templates: ${templatesError.message}`)
      }

      if (templates.length !== task.services.template_ids.length) {
        throw new Error('Some templates are not available or inactive')
      }

      // Prepare document generation data
      const documentsToGenerate = templates.map(template => ({
        templateId: template.id,
        templateName: template.name,
        templateType: template.template_type,
        status: 'pending_generation',
        generatedAt: null,
        downloadUrl: null,
        fileName: this.generateFileName(template.name, task.client_name)
      }))

      // Update task with generation info
      const updateData = {
        status: 'awaiting',
        generated_documents: documentsToGenerate,
        generation_completed_at: null,
        generation_error: null,
        updated_at: new Date().toISOString()
      }

      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update task: ${updateError.message}`)
      }

      console.log(`Task ${taskId} marked for document generation: ${templates.length} documents`)

      return {
        success: true,
        task: updatedTask,
        documentsToGenerate: documentsToGenerate.length,
        templates: templates
      }
    } catch (error) {
      console.error('Error marking documents for generation:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Generate actual documents (HTML content populated with data)
   */
  static async generateDocuments(taskId) {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      const supabase = await createServerSupabase()

      // Fetch task with all required data
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          services!inner(template_ids),
          clients!inner(*)
        `)
        .eq('id', taskId)
        .single()

      if (taskError) {
        throw new Error(`Failed to fetch task: ${taskError.message}`)
      }

      if (task.status !== 'awaiting') {
        throw new Error(`Task must be in 'awaiting' status to generate documents. Current status: ${task.status}`)
      }

      // Fetch templates with HTML content
      const { data: templates, error: templatesError } = await supabase
        .from('document_templates')
        .select('id, name, html_content, field_mappings')
        .in('id', task.services.template_ids)

      if (templatesError) {
        throw new Error(`Failed to fetch templates: ${templatesError.message}`)
      }

      const generatedDocuments = []
      const errors = []

      // Process each template
      for (const template of templates) {
        try {
          const generatedContent = await this.populateTemplate(
            template.html_content,
            task.clients,
            task.custom_field_values,
            template.field_mappings || {}
          )

          const fileName = this.generateFileName(template.name, task.client_name)
          
          // Store generated content in Supabase Storage with client ID folder structure
          const storageResult = await this.storeGeneratedDocument(
            task.clients.id, // client ID for folder structure
            taskId,
            template.id,
            fileName,
            generatedContent
          )

          if (storageResult.success) {
            generatedDocuments.push({
              templateId: template.id,
              templateName: template.name,
              fileName: fileName,
              status: 'generated',
              generatedAt: new Date().toISOString(),
              downloadUrl: storageResult.downloadUrl,
              storagePath: storageResult.path,
              fileSize: storageResult.fileSize
            })
          } else {
            errors.push(`Failed to store ${template.name}: ${storageResult.error}`)
          }
        } catch (error) {
          errors.push(`Failed to generate ${template.name}: ${error.message}`)
        }
      }

      // Update task with generation results
      const updateData = {
        generated_documents: generatedDocuments,
        generation_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      if (errors.length > 0) {
        updateData.generation_error = errors.join('; ')
      }

      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update task: ${updateError.message}`)
      }

      console.log(`Generated ${generatedDocuments.length} documents for task ${taskId}`)

      return {
        success: true,
        task: updatedTask,
        generatedDocuments: generatedDocuments.length,
        errors: errors.length > 0 ? errors : null
      }
    } catch (error) {
      console.error('Error generating documents:', error)
      
      // Update task with error
      try {
        const supabase = await createServerSupabase()
        await supabase
          .from('tasks')
          .update({
            generation_error: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId)
      } catch (updateError) {
        console.error('Error updating task with generation error:', updateError)
      }

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Populate template HTML with client data and custom fields
   */
  static async populateTemplate(htmlContent, clientData, customFieldValues, fieldMappings) {
    try {
      console.log('=== DYNAMIC TEMPLATE POPULATION DEBUG ===')
      console.log('Client data:', clientData)
      console.log('Custom field values:', customFieldValues)
      console.log('Template field mappings:', fieldMappings)
      
      let populatedContent = htmlContent

      // Log original placeholders
      const originalPlaceholders = populatedContent.match(/\{\{([^}]+)\}\}/g) || []
      console.log('Found placeholders in template:', originalPlaceholders)

      // 1. Generate dynamic client field mappings from database schema
      console.log('Generating dynamic client field mappings...')
      const clientFieldsResult = await ClientFieldsService.generateClientFieldMappings(clientData)
      
      if (!clientFieldsResult.success) {
        console.warn('Failed to generate dynamic client fields, using fallback:', clientFieldsResult.error)
      }

      const dynamicClientFields = clientFieldsResult.fieldMappings
      console.log(`Generated ${Object.keys(dynamicClientFields).length} dynamic client field mappings`)
      console.log('Dynamic client fields:', Object.keys(dynamicClientFields))

      // 2. Create comprehensive field mappings
      const allFieldMappings = {}

      // Add dynamic client fields
      Object.assign(allFieldMappings, dynamicClientFields)

      // 3. Add custom field values from the task
      if (customFieldValues && typeof customFieldValues === 'object') {
        Object.entries(customFieldValues).forEach(([key, value]) => {
          // Add the field with its exact key
          allFieldMappings[key] = value || ''
          
          // Also add lowercase version
          allFieldMappings[key.toLowerCase()] = value || ''
          
          // Add snake_case version for flexibility
          const snakeCase = key.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
          if (snakeCase !== key && snakeCase !== key.toLowerCase()) {
            allFieldMappings[snakeCase] = value || ''
          }
          
          console.log(`Custom field mapping: "${key}" -> "${value}"`)
        })
      }

      // 4. Process template-specific field mappings
      if (fieldMappings && typeof fieldMappings === 'object') {
        Object.entries(fieldMappings).forEach(([placeholder, fieldName]) => {
          // Try to find the field value from custom fields first, then client fields
          const value = customFieldValues[fieldName] || 
                      dynamicClientFields[fieldName] || 
                      allFieldMappings[fieldName] || 
                      ''
          allFieldMappings[placeholder] = value
          console.log(`Template mapping: "${placeholder}" -> "${fieldName}" -> "${value}"`)
        })
      }

      console.log(`Total field mappings: ${Object.keys(allFieldMappings).length}`)

      // 5. Replace all placeholders with multiple pattern matching
      let replacementCount = 0
      const replacementLog = []

      Object.entries(allFieldMappings).forEach(([fieldName, fieldValue]) => {
        let fieldReplacements = 0
        
        // Handle standard placeholders first
        const standardRegex = new RegExp(`\\{\\{\\s*${this.escapeRegExp(fieldName)}\\s*\\}\\}`, 'gi')
        const standardMatches = populatedContent.match(standardRegex) || []
        if (standardMatches.length > 0) {
          populatedContent = populatedContent.replace(standardRegex, fieldValue)
          fieldReplacements += standardMatches.length
          console.log(`✓ Standard: Replaced ${standardMatches.length} instances of {{${fieldName}}} with "${fieldValue}"`)
        }

        // Handle span-wrapped placeholders - FIXED: Replace entire span with just the value
        const spanRegex = new RegExp(`<span[^>]*class=["]field-placeholder["][^>]*>\\{\\{\\s*${this.escapeRegExp(fieldName)}\\s*\\}\\}</span>`, 'gi')
        const spanMatches = populatedContent.match(spanRegex) || []
        if (spanMatches.length > 0) {
          populatedContent = populatedContent.replace(spanRegex, fieldValue)
          fieldReplacements += spanMatches.length
          console.log(`✓ Span-wrapped: Replaced ${spanMatches.length} instances of span-wrapped {{${fieldName}}} with "${fieldValue}"`)
        }

        // Handle any other HTML-wrapped placeholders - FIXED: Replace entire wrapper with just the value
        const htmlRegex = new RegExp(`<([^>]+)>\\{\\{\\s*${this.escapeRegExp(fieldName)}\\s*\\}\\}</\\1>`, 'gi')
        const htmlMatches = populatedContent.match(htmlRegex) || []
        if (htmlMatches.length > 0) {
          populatedContent = populatedContent.replace(htmlRegex, fieldValue)
          fieldReplacements += htmlMatches.length
          console.log(`✓ HTML-wrapped: Replaced ${htmlMatches.length} instances of HTML-wrapped {{${fieldName}}} with "${fieldValue}"`)
        }

        if (fieldReplacements > 0) {
          replacementCount += fieldReplacements
          replacementLog.push({
            field: fieldName,
            value: fieldValue,
            count: fieldReplacements
          })
        }
      })

      // Clean up any remaining field-placeholder spans that might have been missed
      populatedContent = populatedContent.replace(/<span[^>]*class=["]field-placeholder["][^>]*>([^<]*)<\/span>/gi, '$1')
      console.log('Cleaned up any remaining field-placeholder spans')

      // 6. Handle remaining unmapped placeholders
      const remainingPlaceholders = populatedContent.match(/\{\{([^}]+)\}\}/g) || []
      if (remainingPlaceholders.length > 0) {
        console.warn('Unmapped placeholders remaining:', remainingPlaceholders)
        
        remainingPlaceholders.forEach(placeholder => {
          const fieldName = placeholder.replace(/[{}]/g, '').trim()
          
          // Try fuzzy matching for similar field names
          const similarField = Object.keys(allFieldMappings).find(key => {
            const keyLower = key.toLowerCase()
            const fieldLower = fieldName.toLowerCase()
            return keyLower.includes(fieldLower) || 
                  fieldLower.includes(keyLower) ||
                  this.calculateSimilarity(keyLower, fieldLower) > 0.7
          })
          
          if (similarField) {
            const value = allFieldMappings[similarField]
            populatedContent = populatedContent.replace(
              new RegExp(this.escapeRegExp(placeholder), 'g'), 
              value
            )
            console.log(`🔄 Auto-mapped ${placeholder} to similar field "${similarField}": "${value}"`)
            replacementCount++
          } else {
            // Replace with clear missing field indicator
            populatedContent = populatedContent.replace(
              new RegExp(this.escapeRegExp(placeholder), 'g'),
              `[MISSING: ${fieldName.toUpperCase()}]`
            )
            console.warn(`❌ Could not map placeholder: ${placeholder}`)
          }
        })
      }

      // 7. Final summary
      console.log('=== REPLACEMENT SUMMARY ===')
      console.log(`Total replacements made: ${replacementCount}`)
      console.log(`Fields successfully mapped: ${replacementLog.length}`)
      console.log(`Unmapped placeholders: ${remainingPlaceholders.length}`)
      
      if (replacementLog.length > 0) {
        console.log('Replacement details:')
        replacementLog.forEach(log => {
          console.log(`  - ${log.field}: "${log.value}" (${log.count} times)`)
        })
      }

      console.log('=== END DYNAMIC TEMPLATE POPULATION DEBUG ===')

      return populatedContent
    } catch (error) {
      console.error('Error in dynamic template population:', error)
      throw new Error(`Failed to populate template: ${error.message}`)
    }
  }

  /**
   * Calculate string similarity for fuzzy matching
   */
  static calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  static levenshteinDistance(str1, str2) {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Helper method to escape regex special characters
   */
  static escapeRegExp(string) {
    return string.toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Store generated document in Supabase Storage with client ID folder structure
   */
  static async storeGeneratedDocument(clientId, taskId, templateId, fileName, htmlContent) {
    try {
      const supabase = await createServerSupabase()
      
      // Create file path: client_id/task_id/document_file
      const filePath = `${clientId}/${taskId}/${templateId}-${fileName}.html`
      
      // Convert HTML to buffer
      const fileBuffer = Buffer.from(htmlContent, 'utf8')
      
      // Upload to task-documents bucket (with hyphen, not underscore)
      const { data, error } = await supabase.storage
        .from('task-documents')
        .upload(filePath, fileBuffer, {
          contentType: 'text/html',
          upsert: true
        })

      if (error) {
        throw new Error(`Storage upload failed: ${error.message}`)
      }

      // Get download URL
      const { data: downloadData } = supabase.storage
        .from('task-documents')
        .getPublicUrl(filePath)

      return {
        success: true,
        path: filePath,
        downloadUrl: downloadData.publicUrl,
        fileSize: fileBuffer.length
      }
    } catch (error) {
      console.error('Error storing generated document:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Upload signed documents with client ID folder structure
   */
  static async uploadSignedDocuments(taskId, files) {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      if (!files || files.length === 0) {
        throw new Error('No files provided')
      }

      const supabase = await createServerSupabase()

      // Validate task exists and is in awaiting status, also get client ID
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id, status, signed_documents, client_id')
        .eq('id', taskId)
        .single()

      if (taskError) {
        throw new Error(`Failed to fetch task: ${taskError.message}`)
      }

      if (task.status !== 'awaiting') {
        throw new Error(`Task must be in 'awaiting' status to upload signed documents. Current status: ${task.status}`)
      }

      const uploadedFiles = []
      const errors = []

      // Process each file
      for (const file of files) {
        try {
          const fileName = `${Date.now()}-${file.name}`
          const filePath = `${task.client_id}/${taskId}/${fileName}` // client_id/task_id/file

          // Upload to signed-documents bucket (with hyphen)
          const { data, error } = await supabase.storage
            .from('signed-documents')
            .upload(filePath, file, {
              upsert: false
            })

          if (error) {
            errors.push(`Failed to upload ${file.name}: ${error.message}`)
            continue
          }

          // Get download URL
          const { data: downloadData } = supabase.storage
            .from('signed-documents')
            .getPublicUrl(filePath)

          uploadedFiles.push({
            originalName: file.name,
            fileName: fileName,
            filePath: filePath,
            downloadUrl: downloadData.publicUrl,
            uploadedAt: new Date().toISOString(),
            fileSize: file.size,
            fileType: file.type
          })
        } catch (error) {
          errors.push(`Failed to process ${file.name}: ${error.message}`)
        }
      }

      // Update task with uploaded files
      const existingSignedDocs = task.signed_documents || []
      const updatedSignedDocs = [...existingSignedDocs, ...uploadedFiles]

      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update({
          signed_documents: updatedSignedDocs,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update task: ${updateError.message}`)
      }

      console.log(`Uploaded ${uploadedFiles.length} signed documents for task ${taskId}`)

      return {
        success: true,
        task: updatedTask,
        uploadedFiles: uploadedFiles.length,
        totalSignedDocuments: updatedSignedDocs.length,
        errors: errors.length > 0 ? errors : null
      }
    } catch (error) {
      console.error('Error uploading signed documents:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Upload additional files with client ID folder structure
   */
  static async uploadAdditionalFiles(taskId, files, description = '') {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      if (!files || files.length === 0) {
        throw new Error('No files provided')
      }

      const supabase = await createServerSupabase()

      // Validate task exists and get client ID
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id, additional_files, client_id')
        .eq('id', taskId)
        .single()

      if (taskError) {
        throw new Error(`Failed to fetch task: ${taskError.message}`)
      }

      const uploadedFiles = []
      const errors = []

      // Process each file
      for (const file of files) {
        try {
          const fileName = `${Date.now()}-${file.name}`
          const filePath = `${task.client_id}/${taskId}/${fileName}` // client_id/task_id/file

          // Upload to additional-files bucket
          const { data, error } = await supabase.storage
            .from('additional-files')
            .upload(filePath, file, {
              upsert: false
            })

          if (error) {
            errors.push(`Failed to upload ${file.name}: ${error.message}`)
            continue
          }

          // Get download URL
          const { data: downloadData } = supabase.storage
            .from('additional-files')
            .getPublicUrl(filePath)

          uploadedFiles.push({
            originalName: file.name,
            fileName: fileName,
            filePath: filePath,
            downloadUrl: downloadData.publicUrl,
            uploadedAt: new Date().toISOString(),
            fileSize: file.size,
            fileType: file.type,
            description: description
          })
        } catch (error) {
          errors.push(`Failed to process ${file.name}: ${error.message}`)
        }
      }

      // Update task with uploaded files
      const existingAdditionalFiles = task.additional_files || []
      const updatedAdditionalFiles = [...existingAdditionalFiles, ...uploadedFiles]

      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update({
          additional_files: updatedAdditionalFiles,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update task: ${updateError.message}`)
      }

      console.log(`Uploaded ${uploadedFiles.length} additional files for task ${taskId}`)

      return {
        success: true,
        task: updatedTask,
        uploadedFiles: uploadedFiles.length,
        totalAdditionalFiles: updatedAdditionalFiles.length,
        errors: errors.length > 0 ? errors : null
      }
    } catch (error) {
      console.error('Error uploading additional files:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get document preview URL (opens in browser as HTML)
   */
  static getDocumentPreviewUrl(taskId, templateId) {
    return `/api/tasks/${taskId}/preview?templateId=${templateId}`
  }

  /**
   * Get document download URL (downloads as file)
   */
  static async downloadDocumentAsFile(taskId, templateId, format = 'html') {
    try {
      const response = await fetch(`/api/tasks/${taskId}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId,
          format
        })
      })

      if (!response.ok) {
        throw new Error('Failed to download document')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      
      return {
        success: true,
        downloadUrl: url,
        fileName: `document_${templateId}.${format}`
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Download generated document - UPDATED WITH PREVIEW AND DOWNLOAD OPTIONS
   */
  static async downloadDocument(taskId, templateId, options = {}) {
    try {
      if (!taskId || !templateId) {
        throw new Error('Task ID and Template ID are required')
      }

      const { preview = false, download = false } = options

      // If preview is requested, return preview URL
      if (preview) {
        return {
          success: true,
          previewUrl: this.getDocumentPreviewUrl(taskId, templateId),
          action: 'preview'
        }
      }

      // If download is requested, download as file
      if (download) {
        return await this.downloadDocumentAsFile(taskId, templateId)
      }

      // Default behavior - return preview URL (most common use case)
      return {
        success: true,
        previewUrl: this.getDocumentPreviewUrl(taskId, templateId),
        action: 'preview'
      }

    } catch (error) {
      console.error('Error with document action:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Download all generated documents - UPDATED WITH PREVIEW OPTIONS
   */
  static async downloadAllDocuments(taskId, options = {}) {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      const supabase = await createServerSupabase()

      // Fetch task to get document info
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id, generated_documents, client_name, service_name')
        .eq('id', taskId)
        .single()

      if (taskError) {
        throw new Error(`Failed to fetch task: ${taskError.message}`)
      }

      const generatedDocs = task.generated_documents?.filter(doc => doc.status === 'generated') || []

      if (generatedDocs.length === 0) {
        throw new Error('No generated documents available')
      }

      // Return preview URLs for all documents
      const documents = generatedDocs.map(doc => ({
        templateId: doc.templateId,
        templateName: doc.templateName,
        fileName: doc.fileName,
        previewUrl: this.getDocumentPreviewUrl(taskId, doc.templateId),
        downloadUrl: `/api/tasks/${taskId}/preview`, // For POST download
      }))

      return {
        success: true,
        documents,
        taskInfo: {
          id: taskId,
          clientName: task.client_name,
          serviceName: task.service_name
        }
      }
    } catch (error) {
      console.error('Error getting document URLs:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Download generated document - FIXED VERSION
   */
  static async downloadDocument(taskId, templateId) {
    try {
      if (!taskId || !templateId) {
        throw new Error('Task ID and Template ID are required')
      }

      const supabase = await createServerSupabase()

      // Fetch task to get document info
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id, generated_documents, status')
        .eq('id', taskId)
        .single()

      if (taskError) {
        throw new Error(`Failed to fetch task: ${taskError.message}`)
      }

      // Find the specific document
      const document = task.generated_documents?.find(doc => doc.templateId === templateId)
      
      if (!document) {
        throw new Error('Document not found in task')
      }

      if (document.status !== 'generated') {
        throw new Error(`Document is not ready for download. Status: ${document.status}`)
      }

      // Get download URL from storage with error handling - FIXED
      try {
        const { data: downloadData, error: downloadError } = await supabase.storage
          .from('task-documents')
          .createSignedUrl(document.storagePath, 3600) // 1 hour expiry

        // Check if downloadData exists and has signedUrl property
        if (downloadError || !downloadData || !downloadData.signedUrl) {
          console.error('Signed URL creation failed:', { downloadError, downloadData })
          
          // Fallback to public URL if signed URL fails
          const { data: publicUrlData } = supabase.storage
            .from('task-documents')
            .getPublicUrl(document.storagePath)

          if (publicUrlData && publicUrlData.publicUrl) {
            return {
              success: true,
              downloadUrl: publicUrlData.publicUrl,
              fileName: document.fileName,
              templateName: document.templateName,
              fallbackUsed: true
            }
          }

          throw new Error(`Failed to create any download URL: ${downloadError?.message || 'Unknown error'}`)
        }

        return {
          success: true,
          downloadUrl: downloadData.signedUrl,
          fileName: document.fileName,
          templateName: document.templateName
        }

      } catch (urlError) {
        console.error('Error with URL creation:', urlError)
        
        // Final fallback - try public URL
        const { data: publicUrlData } = supabase.storage
          .from('task-documents')
          .getPublicUrl(document.storagePath)

        if (publicUrlData && publicUrlData.publicUrl) {
          return {
            success: true,
            downloadUrl: publicUrlData.publicUrl,
            fileName: document.fileName,
            templateName: document.templateName,
            fallbackUsed: true
          }
        }

        throw new Error('Failed to create download URL with all methods')
      }

    } catch (error) {
      console.error('Error creating download URL:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Download all generated documents - FIXED VERSION
   */
  static async downloadAllDocuments(taskId) {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      const supabase = await createServerSupabase()

      // Fetch task to get document info
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id, generated_documents, client_name, service_name')
        .eq('id', taskId)
        .single()

      if (taskError) {
        throw new Error(`Failed to fetch task: ${taskError.message}`)
      }

      const generatedDocs = task.generated_documents?.filter(doc => doc.status === 'generated') || []

      if (generatedDocs.length === 0) {
        throw new Error('No generated documents available for download')
      }

      // Create signed URLs for all documents with error handling - FIXED
      const downloadUrls = []
      const errors = []

      for (const doc of generatedDocs) {
        try {
          const { data: downloadData, error: downloadError } = await supabase.storage
            .from('task-documents')
            .createSignedUrl(doc.storagePath, 3600)

          if (!downloadError && downloadData && downloadData.signedUrl) {
            downloadUrls.push({
              url: downloadData.signedUrl,
              fileName: doc.fileName,
              templateName: doc.templateName
            })
          } else {
            // Try fallback to public URL
            const { data: publicUrlData } = supabase.storage
              .from('task-documents')
              .getPublicUrl(doc.storagePath)

            if (publicUrlData && publicUrlData.publicUrl) {
              downloadUrls.push({
                url: publicUrlData.publicUrl,
                fileName: doc.fileName,
                templateName: doc.templateName,
                fallbackUsed: true
              })
            } else {
              errors.push(`Failed to create URL for ${doc.fileName}`)
            }
          }
        } catch (error) {
          console.error(`Error creating download URL for ${doc.fileName}:`, error)
          errors.push(`Error with ${doc.fileName}: ${error.message}`)
        }
      }

      if (downloadUrls.length === 0) {
        throw new Error(`Failed to create download URLs for any documents. Errors: ${errors.join(', ')}`)
      }

      return {
        success: true,
        documents: downloadUrls,
        taskInfo: {
          id: taskId,
          clientName: task.client_name,
          serviceName: task.service_name
        },
        errors: errors.length > 0 ? errors : null
      }
    } catch (error) {
      console.error('Error creating download URLs:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Delete uploaded file with correct bucket names
   */
  static async deleteUploadedFile(taskId, filePath, fileType = 'signed') {
    try {
      if (!taskId || !filePath) {
        throw new Error('Task ID and file path are required')
      }

      const supabase = await createServerSupabase()

      // Determine bucket based on file type (with correct hyphenated names)
      const bucket = fileType === 'additional' ? 'additional-files' : 'signed-documents'
      const fieldName = fileType === 'additional' ? 'additional_files' : 'signed_documents'

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from(bucket)
        .remove([filePath])

      if (deleteError) {
        throw new Error(`Failed to delete file: ${deleteError.message}`)
      }

      // Update task to remove file reference
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select(`id, ${fieldName}`)
        .eq('id', taskId)
        .single()

      if (taskError) {
        throw new Error(`Failed to fetch task: ${taskError.message}`)
      }

      const updatedFiles = (task[fieldName] || []).filter(file => file.filePath !== filePath)

      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update({
          [fieldName]: updatedFiles,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update task: ${updateError.message}`)
      }

      return {
        success: true,
        task: updatedTask
      }
    } catch (error) {
      console.error('Error deleting uploaded file:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Generate appropriate file name
   */
  static generateFileName(templateName, clientName) {
    // Clean up names for file system
    const cleanTemplateName = templateName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
    const cleanClientName = clientName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
    const timestamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    
    return `${cleanClientName}_${cleanTemplateName}_${timestamp}`
  }

  /**
   * Get file type validation rules
   */
  static getFileValidationRules() {
    return {
      signedDocuments: {
        allowedTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png'
        ],
        maxSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10
      },
      additionalFiles: {
        allowedTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/jpeg',
          'image/png',
          'text/plain'
        ],
        maxSize: 25 * 1024 * 1024, // 25MB
        maxFiles: 20
      }
    }
  }

  /**
   * Validate uploaded files
   */
  static validateFiles(files, fileType = 'signed') {
    const rules = this.getFileValidationRules()[fileType === 'additional' ? 'additionalFiles' : 'signedDocuments']
    const errors = []

    if (!files || files.length === 0) {
      return { valid: false, errors: ['No files provided'] }
    }

    if (files.length > rules.maxFiles) {
      errors.push(`Maximum ${rules.maxFiles} files allowed`)
    }

    files.forEach((file, index) => {
      if (file.size > rules.maxSize) {
        errors.push(`File ${index + 1} (${file.name}) exceeds maximum size of ${rules.maxSize / 1024 / 1024}MB`)
      }

      if (!rules.allowedTypes.includes(file.type)) {
        errors.push(`File ${index + 1} (${file.name}) has unsupported type: ${file.type}`)
      }
    })

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : null
    }
  }
}