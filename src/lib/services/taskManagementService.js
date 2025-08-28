// src/lib/services/taskManagementService.js
import { createServerSupabase } from '@/lib/supabase'

export class TaskManagementService {
  /**
   * Get all tasks with filtering and pagination
   */
  static async getAllTasks(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status = 'all',
        clientId = null,
        serviceId = null,
        search = null,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = options

      const supabase = await createServerSupabase()
      
      let query = supabase
        .from('tasks')
        .select(`
          *,
          clients!inner(first_name, last_name, email, phone),
          services!inner(name, description)
        `, { count: 'exact' })

      // Apply filters
      if (status !== 'all') {
        query = query.eq('status', status)
      }

      if (clientId) {
        query = query.eq('client_id', clientId)
      }

      if (serviceId) {
        query = query.eq('service_id', serviceId)
      }

      if (search) {
        query = query.or(`client_name.ilike.%${search}%,service_name.ilike.%${search}%,notes.ilike.%${search}%`)
      }

      // Apply sorting
      const ascending = sortOrder === 'asc'
      query = query.order(sortBy, { ascending })

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        throw new Error(`Failed to fetch tasks: ${error.message}`)
      }

      return {
        success: true,
        tasks: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
      return {
        success: false,
        error: error.message,
        tasks: [],
        pagination: null
      }
    }
  }

  /**
   * Get task by ID
   */
  static async getTaskById(taskId, includeDocuments = true) {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      const supabase = await createServerSupabase()

      const { data: task, error } = await supabase
        .from('tasks')
        .select(`
          *,
          clients!inner(*),
          services!inner(*)
        `)
        .eq('id', taskId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'Task not found'
          }
        }
        throw new Error(`Failed to fetch task: ${error.message}`)
      }

      return {
        success: true,
        task
      }
    } catch (error) {
      console.error('Error fetching task by ID:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Create new task
   */
  static async createTask(taskData) {
    try {
      const supabase = await createServerSupabase()

      // Fetch client and service data for validation and snapshot
      const [clientResult, serviceResult] = await Promise.all([
        supabase.from('clients').select('*').eq('id', taskData.client_id).single(),
        supabase.from('services').select('*').eq('id', taskData.service_id).single()
      ])

      if (clientResult.error) {
        throw new Error(`Failed to fetch client: ${clientResult.error.message}`)
      }

      if (serviceResult.error) {
        throw new Error(`Failed to fetch service: ${serviceResult.error.message}`)
      }

      const client = clientResult.data
      const service = serviceResult.data

      // Prepare task data
      const newTaskData = {
        client_id: taskData.client_id,
        service_id: taskData.service_id,
        status: 'in_progress',
        service_name: service.name,
        service_description: service.description,
        template_ids: service.template_ids,
        template_names: [], // Will be populated when templates are fetched
        custom_field_values: taskData.custom_field_values || {},
        generated_documents: [],
        signed_documents: [],
        additional_files: [],
        client_data_snapshot: client,
        client_name: `${client.first_name} ${client.last_name}`,
        notes: taskData.notes || null,
        priority: taskData.priority || 'normal',
        assigned_to: taskData.assigned_to || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Create task
      const { data: createdTask, error: createError } = await supabase
        .from('tasks')
        .insert([newTaskData])
        .select()
        .single()

      if (createError) {
        throw new Error(`Failed to create task: ${createError.message}`)
      }

      console.log(`Task created successfully: ${createdTask.id}`)

      return {
        success: true,
        task: createdTask
      }
    } catch (error) {
      console.error('Error creating task:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Update task
   */
  static async updateTask(taskId, updates) {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      const supabase = await createServerSupabase()

      // Add updated timestamp
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data: updatedTask, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Task not found')
        }
        throw new Error(`Failed to update task: ${error.message}`)
      }

      return {
        success: true,
        task: updatedTask
      }
    } catch (error) {
      console.error('Error updating task:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Delete task and all related data
   */
  static async deleteTask(taskId) {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      const supabase = await createServerSupabase()

      // First, get the task to access client_id and file paths
      const { data: task, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return {
            success: false,
            error: 'Task not found'
          }
        }
        throw new Error(`Failed to fetch task: ${fetchError.message}`)
      }

      const clientId = task.client_id

      // Delete files from storage buckets
      const fileDeletionResults = await this.deleteTaskFiles(clientId, taskId, task)

      // Delete generated documents from database
      const { error: generatedDocsError } = await supabase
        .from('generated_documents')
        .delete()
        .match({ 
          client_id: task.client_id,
          // You might want to add a task_id field to generated_documents table for better linking
        })

      if (generatedDocsError) {
        console.warn('Error deleting generated documents:', generatedDocsError.message)
      }

      // Delete the task record
      const { data: deletedTask, error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .select()
        .single()

      if (deleteError) {
        throw new Error(`Failed to delete task: ${deleteError.message}`)
      }

      console.log(`Task deleted successfully: ${taskId}`)

      return {
        success: true,
        deletedTask,
        fileDeletionResults,
        message: 'Task and all related data deleted successfully'
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Delete all files associated with a task from storage
   */
  static async deleteTaskFiles(clientId, taskId, task) {
    const supabase = await createServerSupabase()
    const results = {
      generatedDocuments: { success: 0, failed: 0, errors: [] },
      signedDocuments: { success: 0, failed: 0, errors: [] },
      additionalFiles: { success: 0, failed: 0, errors: [] }
    }

    try {
      // Delete generated documents from task-documents bucket
      const generatedDocs = task.generated_documents || []
      for (const doc of generatedDocs) {
        if (doc.storagePath) {
          const { error } = await supabase.storage
            .from('task-documents')
            .remove([doc.storagePath])
          
          if (error) {
            results.generatedDocuments.failed++
            results.generatedDocuments.errors.push(`Failed to delete ${doc.fileName}: ${error.message}`)
          } else {
            results.generatedDocuments.success++
          }
        }
      }

      // Delete signed documents from signed-documents bucket
      const signedDocs = task.signed_documents || []
      for (const doc of signedDocs) {
        if (doc.filePath) {
          const { error } = await supabase.storage
            .from('signed-documents')
            .remove([doc.filePath])
          
          if (error) {
            results.signedDocuments.failed++
            results.signedDocuments.errors.push(`Failed to delete ${doc.originalName}: ${error.message}`)
          } else {
            results.signedDocuments.success++
          }
        }
      }

      // Delete additional files from additional-files bucket
      const additionalFiles = task.additional_files || []
      for (const file of additionalFiles) {
        if (file.filePath) {
          const { error } = await supabase.storage
            .from('additional-files')
            .remove([file.filePath])
          
          if (error) {
            results.additionalFiles.failed++
            results.additionalFiles.errors.push(`Failed to delete ${file.originalName}: ${error.message}`)
          } else {
            results.additionalFiles.success++
          }
        }
      }

      // Try to delete the entire client folder for this task (cleanup empty folders)
      try {
        await supabase.storage.from('task-documents').remove([`${clientId}/${taskId}/`])
        await supabase.storage.from('signed-documents').remove([`${clientId}/${taskId}/`])
        await supabase.storage.from('additional-files').remove([`${clientId}/${taskId}/`])
      } catch (error) {
        // Folder deletion might fail if not empty, which is fine
        console.log('Folder cleanup completed (some folders may remain if not empty)')
      }

    } catch (error) {
      console.error('Error during file deletion:', error)
    }

    return results
  }

  /**
   * Get task statistics
   */
  static async getTaskStatistics() {
    try {
      const supabase = await createServerSupabase()

      const { data, error } = await supabase
        .from('tasks')
        .select('status')

      if (error) {
        throw new Error(`Failed to fetch task statistics: ${error.message}`)
      }

      const stats = {
        total: data.length,
        in_progress: data.filter(t => t.status === 'in_progress').length,
        awaiting: data.filter(t => t.status === 'awaiting').length,
        completed: data.filter(t => t.status === 'completed').length,
        by_status: {}
      }

      // Count by status
      data.forEach(task => {
        stats.by_status[task.status] = (stats.by_status[task.status] || 0) + 1
      })

      return stats
    } catch (error) {
      console.error('Error fetching task statistics:', error)
      throw error
    }
  }
}

// Fixed TaskDocumentService download methods
export class TaskDocumentServiceFixed {
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

      // Get download URL from storage with correct bucket name - FIXED
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from('task-documents')
        .createSignedUrl(document.storagePath, 3600) // 1 hour expiry

      // Check if downloadData exists and has signedUrl property
      if (downloadError || !downloadData || !downloadData.signedUrl) {
        console.error('Download error details:', { downloadError, downloadData })
        
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

        throw new Error(`Failed to create download URL: ${downloadError?.message || 'Unknown error'}`)
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

      // Create signed URLs for all documents - FIXED
      const downloadUrls = []
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
            // Fallback to public URL
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
            }
          }
        } catch (error) {
          console.error(`Error creating download URL for ${doc.fileName}:`, error)
        }
      }

      if (downloadUrls.length === 0) {
        throw new Error('Failed to create download URLs for any documents')
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
}