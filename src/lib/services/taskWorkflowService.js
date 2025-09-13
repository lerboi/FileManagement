// src/lib/services/taskWorkflowService.js
import { createServerSupabase } from '@/lib/supabase'
import { TaskManagementService } from './taskManagementService'
import { TaskDocumentService } from './taskDocumentService'

export class TaskWorkflowService {
  /**
   * Start document generation process (in_progress → awaiting)
   */
  static async startDocumentGeneration(taskId) {
    try {
      const supabase = await createServerSupabase()

      // Get the task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()

      if (taskError) {
        throw new Error(`Failed to fetch task: ${taskError.message}`)
      }

      console.log('Task status check:', {
        taskId,
        currentStatus: task.status,
        isDraft: task.is_draft
      })

      // Allow generation for both 'in_progress' and non-draft tasks that haven't generated documents yet
      const allowedStatuses = ['in_progress']
      const hasExistingDocuments = task.generated_documents && task.generated_documents.length > 0

      if (!allowedStatuses.includes(task.status)) {
        // If task is not draft and has no existing documents, allow generation anyway
        if (task.is_draft) {
          throw new Error('Cannot generate documents for draft tasks. Please finalize the task first.')
        }
        
        if (hasExistingDocuments && task.status === 'awaiting') {
          console.log('Task already has generated documents, proceeding with regeneration...')
        } else {
          console.log(`Allowing document generation for task with status: ${task.status}`)
        }
      }

      if (!task.template_ids || task.template_ids.length === 0) {
        throw new Error('No templates found for this task')
      }

      console.log(`Starting DOCX document generation for ${task.template_ids.length} templates`)

      // Update task status to awaiting (regardless of current status, except if already completed)
      if (task.status !== 'completed') {
        const { error: statusUpdateError } = await supabase
          .from('tasks')
          .update({
            status: 'awaiting',
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId)

        if (statusUpdateError) {
          throw new Error(`Failed to update task status: ${statusUpdateError.message}`)
        }
      }

      const generatedDocuments = []
      const errors = []
      let successCount = 0

      // Generate DOCX documents for each template
      for (const templateId of task.template_ids) {
        try {
          console.log(`Generating DOCX document for template: ${templateId}`)
          
          // Call DocxtemplaterService directly instead of making HTTP request
          const { DocxtemplaterService } = await import('./docxtemplaterService')
          const result = await DocxtemplaterService.generateDocument(
            templateId,
            task.client_id,
            task.custom_field_values || {}
          )

          if (!result.success) {
            throw new Error(result.error)
          }

          // Store DOCX file in task-documents bucket
          const storagePath = `${task.client_id}/${taskId}/${templateId}_${result.fileName}`
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('task-documents')
            .upload(storagePath, result.buffer, {
              contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              upsert: true
            })

          if (uploadError) {
            throw new Error(`Failed to store DOCX document: ${uploadError.message}`)
          }

          // Get template name from the result (DocxtemplaterService already has this)
          const templateName = result.document.original_template_name

          // Add document info to generated documents array
          generatedDocuments.push({
            templateId,
            templateName,
            fileName: result.fileName.replace('.docx', ''),
            status: 'generated',
            generatedAt: new Date().toISOString(),
            storagePath,
            fileType: 'docx',
            fileSize: result.buffer.byteLength
          })

          successCount++

        } catch (error) {
          console.error(`Error generating DOCX document for template ${templateId}:`, error)
          
          // Get template name for error display
          let templateName = `Template ${templateId}`
          try {
            const { data: templateData } = await supabase
              .from('document_templates')
              .select('name')
              .eq('id', templateId)
              .single()
            
            if (templateData) {
              templateName = templateData.name
            }
          } catch (nameError) {
            console.warn('Could not fetch template name for error display')
          }

          // Add failed document to the array
          generatedDocuments.push({
            templateId,
            templateName,
            status: 'failed',
            error: error.message,
            generatedAt: new Date().toISOString(),
            fileType: 'docx'
          })
          
          errors.push(`${templateName}: ${error.message}`)
        }
      }

      // Update task with generation results
      const updateData = {
        generated_documents: generatedDocuments,
        generation_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // If all documents failed, add error
      if (successCount === 0) {
        updateData.generation_error = `All DOCX document generation failed: ${errors.join('; ')}`
      } else if (errors.length > 0) {
        // Partial success - store warnings
        updateData.generation_error = `Partial DOCX generation failure: ${errors.join('; ')}`
      } else {
        // Clear any previous errors
        updateData.generation_error = null
      }

      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update task with generation results: ${updateError.message}`)
      }

      console.log(`DOCX document generation completed. Success: ${successCount}, Failures: ${errors.length}`)

      // Return result
      if (successCount === 0) {
        return {
          success: false,
          error: `All DOCX document generation failed: ${errors.join('; ')}`,
          task: updatedTask,
          partialGeneration: false
        }
      } else if (errors.length > 0) {
        return {
          success: true,
          task: updatedTask,
          documentsGenerated: successCount,
          warnings: errors,
          partialGeneration: true
        }
      } else {
        return {
          success: true,
          task: updatedTask,
          documentsGenerated: successCount
        }
      }

    } catch (error) {
      console.error('Error in DOCX document generation process:', error)

      // Try to update task with error status
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
        console.error('Failed to update task with error:', updateError)
      }

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Complete task workflow (awaiting → completed)
   */
  static async completeTask(taskId, completionData = {}) {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      const supabase = await createServerSupabase()

      // Fetch current task state
      const taskResult = await TaskManagementService.getTaskById(taskId)
      if (!taskResult.success) {
        throw new Error(taskResult.error)
      }

      const task = taskResult.task

      // Validate task can be completed
      const validationResult = await this.validateTaskCompletion(task)
      if (!validationResult.valid) {
        throw new Error(validationResult.error)
      }

      // Update task to completed status
      const updateData = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        ...completionData
      }

      const updateResult = await TaskManagementService.updateTask(taskId, updateData)
      if (!updateResult.success) {
        throw new Error(updateResult.error)
      }

      // Update client data with task completion info
      const clientUpdateResult = await this.updateClientDataOnCompletion(task, updateResult.task)
      
      console.log(`Task completed successfully: ${taskId}`)

      return {
        success: true,
        task: updateResult.task,
        clientUpdated: clientUpdateResult.success,
        clientUpdateWarnings: clientUpdateResult.warnings
      }
    } catch (error) {
      console.error('Error completing task:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Retry failed document generation
   */
  static async retryDocumentGeneration(taskId) {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      const supabase = await createServerSupabase()

      // Reset task to in_progress and clear error states
      const resetResult = await TaskManagementService.updateTask(taskId, {
        status: 'in_progress',
        generated_documents: [],
        generation_error: null,
        generation_completed_at: null
      })

      if (!resetResult.success) {
        throw new Error(resetResult.error)
      }

      // Start generation process again
      return await this.startDocumentGeneration(taskId)
    } catch (error) {
      console.error('Error retrying document generation:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Validate if task can be completed
   */
  static async validateTaskCompletion(task) {
    // Check task status
    if (task.status !== 'awaiting') {
      return {
        valid: false,
        error: `Task must be in 'awaiting' status to complete. Current status: ${task.status}`
      }
    }

    // Check if documents were generated successfully
    const generatedDocs = task.generated_documents || []
    const successfulDocs = generatedDocs.filter(doc => doc.status === 'generated')
    
    if (successfulDocs.length === 0) {
      return {
        valid: false,
        error: 'No documents have been successfully generated'
      }
    }

    // Check if all generated documents have corresponding signed versions
    const { SignedDocumentStorageService } = await import('@/lib/services/signedDocumentStorageService')
    const missingSignedDocs = []
    
    for (const doc of successfulDocs) {
      const checkResult = await SignedDocumentStorageService.checkSignedDocumentExists(task.id, doc.templateId)
      if (!checkResult.exists || checkResult.files.length === 0) {
        missingSignedDocs.push({
          templateId: doc.templateId,
          templateName: doc.templateName
        })
      }
    }

    if (missingSignedDocs.length > 0) {
      const missingNames = missingSignedDocs.map(doc => doc.templateName).join(', ')
      return {
        valid: false,
        error: `Missing signed documents for: ${missingNames}. Please upload all signed documents before completing the task.`,
        missingSignedDocs
      }
    }

    return { 
      valid: true,
      signedDocumentCount: successfulDocs.length
    }
  }

  /**
   * Update client data when task is completed
   */
  static async updateClientDataOnCompletion(originalTask, completedTask) {
    try {
      const supabase = await createServerSupabase()

      // Prepare client update data
      const clientUpdateData = {
        updated_at: new Date().toISOString()
      }

      // Add task-specific completion data
      // This will be template-specific and configurable
      const completionData = this.extractClientCompletionData(originalTask, completedTask)
      
      // For now, we'll add basic completion tracking
      const existingCompletions = originalTask.clients.task_completions || []
      const newCompletion = {
        taskId: completedTask.id,
        serviceName: completedTask.service_name,
        completedAt: completedTask.completed_at,
        templateIds: completedTask.template_ids,
        documentsGenerated: completedTask.generated_documents?.length || 0,
        signedDocuments: completedTask.signed_documents?.length || 0
      }

      // Update client record - this will be adapted when client schema is finalized
      const { data, error } = await supabase
        .from('clients')
        .update({
          ...clientUpdateData,
          // Add completion tracking (adapt this based on final client schema)
          task_completions: [...existingCompletions, newCompletion],
          last_service_date: completedTask.completed_at
        })
        .eq('id', originalTask.client_id)
        .select()
        .single()

      if (error) {
        console.warn('Failed to update client data:', error.message)
        return {
          success: false,
          error: error.message,
          warnings: ['Client data update failed but task was completed successfully']
        }
      }

      console.log(`Client data updated for task completion: ${originalTask.client_id}`)

      return {
        success: true,
        updatedClient: data
      }
    } catch (error) {
      console.error('Error updating client data:', error)
      return {
        success: false,
        error: error.message,
        warnings: ['Client data update failed but task was completed successfully']
      }
    }
  }

  /**
   * Extract client-specific completion data from task
   * This will be expanded based on template requirements
   */
  static extractClientCompletionData(originalTask, completedTask) {
    const completionData = {}

    // Extract custom field values that should be saved to client
    const customFields = originalTask.custom_field_values || {}
    
    // Template-specific data extraction
    // This will be configured per template type
    const templateSpecificData = this.extractTemplateSpecificData(
      completedTask.template_ids,
      customFields
    )

    return {
      ...completionData,
      ...templateSpecificData,
      lastTaskCompletedAt: completedTask.completed_at,
      lastServiceUsed: completedTask.service_name
    }
  }

  /**
   * Extract template-specific data for client updates
   * This will be expanded based on different template types
   */
  static extractTemplateSpecificData(templateIds, customFieldValues) {
    const templateData = {}

    // Example: Trust-specific data extraction
    if (templateIds.some(id => this.isTrustTemplate(id))) {
      templateData.trust_type = customFieldValues.trust_type || null
      templateData.trust_amount = customFieldValues.trust_amount || null
      templateData.trust_established_date = new Date().toISOString()
    }

    // Example: Will-specific data extraction
    if (templateIds.some(id => this.isWillTemplate(id))) {
      templateData.will_created_date = new Date().toISOString()
      templateData.executor_name = customFieldValues.executor_name || null
    }

    // Add more template-specific extractions as needed

    return templateData
  }

  /**
   * Template type detection helpers
   * These will be improved with proper template categorization
   */
  static isTrustTemplate(templateId) {
    // This should be determined by template metadata
    // For now, placeholder logic
    return false
  }

  static isWillTemplate(templateId) {
    // This should be determined by template metadata
    // For now, placeholder logic
    return false
  }

  /**
   * Get task workflow status and available actions
   */
  static getTaskWorkflowStatus(task) {
    const status = {
      currentStatus: task.status,
      canGenerateDocuments: false,
      canUploadSigned: false,
      canComplete: false,
      canRetry: false,
      requiredActions: [],
      availableActions: []
    }

    switch (task.status) {
      case 'in_progress':
        status.canGenerateDocuments = true
        status.requiredActions.push('Generate documents to proceed')
        status.availableActions.push({
          action: 'generateDocuments',
          label: 'Generate Documents',
          description: 'Create documents from templates'
        })
        break

      case 'awaiting':
        const hasGeneratedDocs = task.generated_documents?.some(doc => doc.status === 'generated')
        const hasSignedDocs = task.signed_documents?.length > 0

        if (hasGeneratedDocs) {
          status.canUploadSigned = true
          status.availableActions.push({
            action: 'downloadDocuments',
            label: 'Download Documents',
            description: 'Download generated documents for signing'
          })
          
          if (!hasSignedDocs) {
            status.requiredActions.push('Upload signed documents to complete')
          }
          
          status.availableActions.push({
            action: 'uploadSigned',
            label: 'Upload Signed Documents',
            description: 'Upload signed versions of documents'
          })
        }

        if (hasSignedDocs) {
          status.canComplete = true
          status.availableActions.push({
            action: 'completeTask',
            label: 'Complete Task',
            description: 'Mark task as completed'
          })
        }

        if (task.generation_error) {
          status.canRetry = true
          status.availableActions.push({
            action: 'retryGeneration',
            label: 'Retry Generation',
            description: 'Retry document generation'
          })
        }
        break

      case 'completed':
        status.availableActions.push({
          action: 'downloadDocuments',
          label: 'Download Documents',
          description: 'Download all task documents'
        })
        break
    }

    return status
  }

  /**
   * Get task progress information
   */
  static getTaskProgress(task) {
    const totalSteps = 4
    let currentStep = 1
    let completedSteps = 0
    const steps = [
      { name: 'Task Created', completed: true, current: false },
      { name: 'Documents Generated', completed: false, current: false },
      { name: 'Documents Signed', completed: false, current: false },
      { name: 'Task Completed', completed: false, current: false }
    ]

    switch (task.status) {
      case 'in_progress':
        currentStep = 1
        completedSteps = 1
        steps[1].current = true
        break

      case 'awaiting':
        const hasGeneratedDocs = task.generated_documents?.some(doc => doc.status === 'generated')
        const hasSignedDocs = task.signed_documents?.length > 0

        if (hasGeneratedDocs) {
          completedSteps = 2
          steps[1].completed = true
          
          if (hasSignedDocs) {
            completedSteps = 3
            steps[2].completed = true
            steps[3].current = true
            currentStep = 4
          } else {
            steps[2].current = true
            currentStep = 3
          }
        } else {
          completedSteps = 1
          steps[1].current = true
          currentStep = 2
        }
        break

      case 'completed':
        completedSteps = 4
        currentStep = 4
        steps.forEach(step => { step.completed = true; step.current = false })
        break
    }

    return {
      currentStep,
      totalSteps,
      completedSteps,
      progress: Math.round((completedSteps / totalSteps) * 100),
      steps
    }
  }

  /**
   * Bulk status update for multiple tasks
   */
  static async bulkUpdateTaskStatus(taskIds, newStatus, updateData = {}) {
    try {
      if (!taskIds || taskIds.length === 0) {
        throw new Error('Task IDs are required')
      }

      const supabase = await createServerSupabase()
      const results = []
      const errors = []

      for (const taskId of taskIds) {
        try {
          const result = await TaskManagementService.updateTask(taskId, {
            status: newStatus,
            ...updateData
          })
          
          if (result.success) {
            results.push(result.task)
          } else {
            errors.push({ taskId, error: result.error })
          }
        } catch (error) {
          errors.push({ taskId, error: error.message })
        }
      }

      return {
        success: errors.length === 0,
        updated: results.length,
        errors: errors.length > 0 ? errors : null,
        tasks: results
      }
    } catch (error) {
      console.error('Error in bulk status update:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}