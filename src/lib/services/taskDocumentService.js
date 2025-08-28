// src/lib/services/taskDocumentService.js
import { createServerSupabase } from '@/lib/supabase'

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

      if (task.status !== 'in_progress') {
        throw new Error(`Task must be in 'in_progress' status to generate documents. Current status: ${task.status}`)
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
        .select('id, name, html_content, field_mappings, custom_fields')
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
          
          // Store generated content in Supabase Storage
          const storageResult = await this.storeGeneratedDocument(
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
      let populatedContent = htmlContent

      // Replace client data fields
      const clientFields = {
        'client_first_name': clientData.first_name || '',
        'client_last_name': clientData.last_name || '',
        'client_full_name': `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim(),
        'client_email': clientData.email || '',
        'client_phone': clientData.phone || '',
        'client_address_line_1': clientData.address_line_1 || '',
        'client_address_line_2': clientData.address_line_2 || '',
        'client_city': clientData.city || '',
        'client_state': clientData.state || '',
        'client_postal_code': clientData.postal_code || '',
        'client_country': clientData.country || '',
        'current_date': new Date().toLocaleDateString(),
        'current_datetime': new Date().toLocaleString()
      }

      // Replace client field placeholders
      Object.entries(clientFields).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
        populatedContent = populatedContent.replace(regex, value)
      })

      // Replace custom field placeholders
      Object.entries(customFieldValues).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
        populatedContent = populatedContent.replace(regex, value || '')
      })

      // Handle field mappings if provided
      Object.entries(fieldMappings).forEach(([placeholder, fieldName]) => {
        const value = customFieldValues[fieldName] || clientFields[fieldName] || ''
        const regex = new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g')
        populatedContent = populatedContent.replace(regex, value)
      })

      return populatedContent
    } catch (error) {
      throw new Error(`Failed to populate template: ${error.message}`)
    }
  }

  /**
   * Store generated document in Supabase Storage
   */
  static async storeGeneratedDocument(taskId, templateId, fileName, htmlContent) {
    try {
      const supabase = await createServerSupabase()
      
      // Create file path
      const filePath = `${taskId}/${templateId}-${fileName}.html`
      
      // Convert HTML to buffer
      const fileBuffer = Buffer.from(htmlContent, 'utf8')
      
      // Upload to task_documents bucket
      const { data, error } = await supabase.storage
        .from('task_documents')
        .upload(filePath, fileBuffer, {
          contentType: 'text/html',
          upsert: true
        })

      if (error) {
        throw new Error(`Storage upload failed: ${error.message}`)
      }

      // Get download URL
      const { data: downloadData } = supabase.storage
        .from('task_documents')
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
   * Upload signed documents
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

      // Validate task exists and is in awaiting status
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id, status, signed_documents')
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
          const filePath = `${taskId}/${fileName}`

          // Upload to signed_documents bucket
          const { data, error } = await supabase.storage
            .from('signed_documents')
            .upload(filePath, file, {
              upsert: false
            })

          if (error) {
            errors.push(`Failed to upload ${file.name}: ${error.message}`)
            continue
          }

          // Get download URL
          const { data: downloadData } = supabase.storage
            .from('signed_documents')
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
   * Upload additional files
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

      // Validate task exists
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id, additional_files')
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
          const filePath = `${taskId}/${fileName}`

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
   * Download generated document
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

      // Get download URL from storage
      const { data: downloadData, error: downloadError } = supabase.storage
        .from('task_documents')
        .createSignedUrl(document.storagePath, 3600) // 1 hour expiry

      if (downloadError) {
        throw new Error(`Failed to create download URL: ${downloadError.message}`)
      }

      return {
        success: true,
        downloadUrl: downloadData.signedUrl,
        fileName: document.fileName,
        templateName: document.templateName
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
   * Download all generated documents as a ZIP
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

      // Create signed URLs for all documents
      const downloadUrls = []
      for (const doc of generatedDocs) {
        const { data: downloadData, error: downloadError } = supabase.storage
          .from('task_documents')
          .createSignedUrl(doc.storagePath, 3600)

        if (!downloadError && downloadData) {
          downloadUrls.push({
            url: downloadData.signedUrl,
            fileName: doc.fileName,
            templateName: doc.templateName
          })
        }
      }

      return {
        success: true,
        documents: downloadUrls,
        taskInfo: {
          id: taskId,
          clientName: task.client_name,
          serviceName: task.service_name
        }
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
   * Delete uploaded file
   */
  static async deleteUploadedFile(taskId, filePath, fileType = 'signed') {
    try {
      if (!taskId || !filePath) {
        throw new Error('Task ID and file path are required')
      }

      const supabase = await createServerSupabase()

      // Determine bucket based on file type
      const bucket = fileType === 'additional' ? 'additional-files' : 'signed_documents'
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