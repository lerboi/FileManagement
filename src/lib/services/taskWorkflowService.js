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
    if (!taskId) {
      throw new Error('Task ID is required')
    }

    console.log(`Starting document generation for task: ${taskId}`)

    // Step 1: Mark documents for generation and update status
    const markResult = await TaskDocumentService.markDocumentsForGeneration(taskId)
    
    if (!markResult.success) {
      throw new Error(markResult.error)
    }

    // Step 2: Generate actual documents (HTML population)
    const generateResult = await TaskDocumentService.generateDocuments(taskId)
    
    if (!generateResult.success) {
      // If generation fails, we keep the task in awaiting status with error
      return {
        success: false,
        error: generateResult.error,
        task: markResult.task,
        partialGeneration: true
      }
    }

    // Step 3: Create signed document folders for generated templates
    try {
      const { SignedDocumentStorageService } = await import('@/lib/services/signedDocumentStorageService')
      const templateIds = generateResult.task.template_ids || []
      
      console.log(`Creating signed document folders for task: ${taskId}`)
      await SignedDocumentStorageService.createSignedDocumentFolders(taskId, templateIds)
    } catch (folderError) {
      console.error('Error creating signed document folders:', folderError)
      // Don't fail the entire process if folder creation fails
      // Just log the error and continue
    }

    console.log(`Document generation completed for task: ${taskId}`)

    return {
      success: true,
      task: generateResult.task,
      documentsGenerated: generateResult.generatedDocuments,
      warnings: generateResult.errors
    }
  } catch (error) {
    console.error('Error in document generation workflow:', error)
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
      const validationResult = this.validateTaskCompletion(task)
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
  static validateTaskCompletion(task) {
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

    // Check if signed documents were uploaded
    const signedDocs = task.signed_documents || []
    
    if (signedDocs.length === 0) {
      return {
        valid: false,
        error: 'No signed documents have been uploaded. Please upload signed documents before completing the task.'
      }
    }

    // Optional: Check if all generated documents have corresponding signed versions
    // This could be configurable business logic
    const requireAllDocumentsSigned = false // Make this configurable
    
    if (requireAllDocumentsSigned && signedDocs.length < successfulDocs.length) {
      return {
        valid: false,
        error: `All generated documents must be signed. Generated: ${successfulDocs.length}, Signed: ${signedDocs.length}`
      }
    }

    return { valid: true }
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