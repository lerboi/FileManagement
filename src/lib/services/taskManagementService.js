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
        status = null,
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
          clients!inner(
            id,
            first_name,
            last_name,
            email
          ),
          services!inner(
            id,
            name,
            description
          )
        `)

      // Apply filters
      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      if (clientId) {
        query = query.eq('client_id', clientId)
      }

      if (serviceId) {
        query = query.eq('service_id', serviceId)
      }

      // Apply search
      if (search) {
        query = query.or(`
          service_name.ilike.%${search}%,
          client_name.ilike.%${search}%,
          notes.ilike.%${search}%
        `)
      }

      // Apply sorting
      const validSortFields = ['created_at', 'updated_at', 'status', 'client_name', 'service_name']
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at'
      const order = sortOrder === 'asc' ? 'asc' : 'desc'
      
      query = query.order(sortField, { ascending: order === 'asc' })

      // Apply pagination
      const offset = (page - 1) * limit
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        throw new Error(`Failed to fetch tasks: ${error.message}`)
      }

      // Get total count for pagination
      const { count: totalCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })

      return {
        success: true,
        tasks: data || [],
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
          hasMore: (page * limit) < (totalCount || 0)
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
   * Get a single task by ID with full details
   */
  static async getTaskById(taskId, includeDocuments = true) {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      const supabase = await createServerSupabase()

      let selectFields = `
        *,
        clients!inner(
          id,
          first_name,
          last_name,
          email,
          phone,
          address_line_1,
          address_line_2,
          city,
          state,
          postal_code,
          country
        ),
        services!inner(
          id,
          name,
          description,
          template_ids
        )
      `

      const { data, error } = await supabase
        .from('tasks')
        .select(selectFields)
        .eq('id', taskId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Task not found')
        }
        throw new Error(`Failed to fetch task: ${error.message}`)
      }

      // If including documents, fetch template details
      if (includeDocuments && data.services.template_ids) {
        const { data: templates, error: templatesError } = await supabase
          .from('document_templates')
          .select('id, name, description, template_type, status, custom_fields')
          .in('id', data.services.template_ids)

        if (!templatesError) {
          data.templates = templates || []
        }
      }

      return {
        success: true,
        task: data
      }
    } catch (error) {
      console.error('Error fetching task:', error)
      return {
        success: false,
        error: error.message,
        task: null
      }
    }
  }

  /**
   * Create a new task
   */
  static async createTask(taskData) {
    try {
      const {
        client_id,
        service_id,
        custom_field_values = {},
        notes = '',
        priority = 'normal',
        assigned_to = null
      } = taskData

      // Validation
      if (!client_id) {
        throw new Error('Client ID is required')
      }

      if (!service_id) {
        throw new Error('Service ID is required')
      }

      const supabase = await createServerSupabase()

      // Fetch and validate client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, first_name, last_name, email')
        .eq('id', client_id)
        .single()

      if (clientError || !client) {
        throw new Error('Invalid client ID')
      }

      // Fetch and validate service
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('id, name, description, template_ids, is_active')
        .eq('id', service_id)
        .single()

      if (serviceError || !service) {
        throw new Error('Invalid service ID')
      }

      if (!service.is_active) {
        throw new Error('Service is not active')
      }

      if (!service.template_ids || service.template_ids.length === 0) {
        throw new Error('Service has no templates configured')
      }

      // Validate custom fields against service templates
      const validationResult = await this.validateCustomFields(service.template_ids, custom_field_values)
      if (!validationResult.valid) {
        throw new Error(`Custom field validation failed: ${validationResult.error}`)
      }

      // Create client data snapshot
      const clientDataSnapshot = {
        id: client.id,
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
        full_name: `${client.first_name} ${client.last_name}`,
        snapshot_date: new Date().toISOString()
      }

      // Create task record
      const taskRecord = {
        client_id,
        service_id,
        status: 'in_progress',
        service_name: service.name,
        service_description: service.description,
        template_ids: service.template_ids,
        custom_field_values: custom_field_values || {},
        generated_documents: [],
        signed_documents: [],
        additional_files: [],
        client_data_snapshot: clientDataSnapshot,
        client_name: `${client.first_name} ${client.last_name}`,
        notes,
        priority,
        assigned_to,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert(taskRecord)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to create task: ${error.message}`)
      }

      console.log(`Task created successfully: ${data.id} for client ${client.first_name} ${client.last_name}`)

      return {
        success: true,
        task: data,
        validation: validationResult
      }
    } catch (error) {
      console.error('Error creating task:', error)
      return {
        success: false,
        error: error.message,
        task: null
      }
    }
  }

  /**
   * Update a task
   */
  static async updateTask(taskId, updates) {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      const supabase = await createServerSupabase()

      // Validate task exists
      const { data: existingTask, error: fetchError } = await supabase
        .from('tasks')
        .select('id, status, service_id')
        .eq('id', taskId)
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          throw new Error('Task not found')
        }
        throw new Error(`Failed to fetch task: ${fetchError.message}`)
      }

      // Prepare allowed update fields
      const allowedFields = [
        'status', 'custom_field_values', 'generated_documents', 
        'signed_documents', 'additional_files', 'notes', 
        'priority', 'assigned_to', 'generation_completed_at',
        'generation_error', 'completed_at'
      ]

      const filteredUpdates = {}
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key) && updates[key] !== undefined) {
          filteredUpdates[key] = updates[key]
        }
      })

      // Add updated timestamp
      filteredUpdates.updated_at = new Date().toISOString()

      // Validate status transitions
      if (filteredUpdates.status && filteredUpdates.status !== existingTask.status) {
        const validTransition = this.validateStatusTransition(existingTask.status, filteredUpdates.status)
        if (!validTransition.valid) {
          throw new Error(validTransition.error)
        }
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(filteredUpdates)
        .eq('id', taskId)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to update task: ${error.message}`)
      }

      return {
        success: true,
        task: data
      }
    } catch (error) {
      console.error('Error updating task:', error)
      return {
        success: false,
        error: error.message,
        task: null
      }
    }
  }

  /**
   * Delete a task
   */
  static async deleteTask(taskId) {
    try {
      if (!taskId) {
        throw new Error('Task ID is required')
      }

      const supabase = await createServerSupabase()

      // Fetch task details before deletion
      const { data: task, error: fetchError } = await supabase
        .from('tasks')
        .select('id, client_name, service_name, status')
        .eq('id', taskId)
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          throw new Error('Task not found')
        }
        throw new Error(`Failed to fetch task: ${fetchError.message}`)
      }

      // Check if task can be deleted (business logic)
      if (task.status === 'completed') {
        throw new Error('Cannot delete completed tasks')
      }

      // Delete the task
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (deleteError) {
        throw new Error(`Failed to delete task: ${deleteError.message}`)
      }

      console.log(`Task deleted: ${taskId} (${task.client_name} - ${task.service_name})`)

      return {
        success: true,
        deletedTask: {
          id: task.id,
          client_name: task.client_name,
          service_name: task.service_name
        }
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      return {
        success: false,
        error: error.message,
        deletedTask: null
      }
    }
  }

  /**
   * Validate custom fields against service templates
   */
  static async validateCustomFields(templateIds, customFieldValues) {
    try {
      const supabase = await createServerSupabase()

      // Fetch templates and their custom fields
      const { data: templates, error } = await supabase
        .from('document_templates')
        .select('id, name, custom_fields')
        .in('id', templateIds)

      if (error) {
        throw new Error(`Failed to fetch templates: ${error.message}`)
      }

      // Aggregate all required custom fields
      const requiredFields = new Map()
      const allFields = new Map()

      templates.forEach(template => {
        const customFields = template.custom_fields || []
        customFields.forEach(field => {
          const fieldKey = field.name || field.label
          allFields.set(fieldKey, field)
          
          if (field.required) {
            requiredFields.set(fieldKey, {
              ...field,
              templateName: template.name,
              templateId: template.id
            })
          }
        })
      })

      // Validate required fields are provided
      const missingFields = []
      for (const [fieldName, fieldConfig] of requiredFields) {
        if (!customFieldValues[fieldName] || 
            (typeof customFieldValues[fieldName] === 'string' && !customFieldValues[fieldName].trim())) {
          missingFields.push({
            name: fieldName,
            label: fieldConfig.label || fieldName,
            templateName: fieldConfig.templateName
          })
        }
      }

      if (missingFields.length > 0) {
        return {
          valid: false,
          error: `Missing required fields: ${missingFields.map(f => f.label).join(', ')}`,
          missingFields,
          requiredFields: Array.from(requiredFields.values()),
          allFields: Array.from(allFields.values())
        }
      }

      return {
        valid: true,
        requiredFields: Array.from(requiredFields.values()),
        allFields: Array.from(allFields.values()),
        providedFields: Object.keys(customFieldValues)
      }
    } catch (error) {
      console.error('Error validating custom fields:', error)
      return {
        valid: false,
        error: error.message
      }
    }
  }

  /**
   * Validate status transitions
   */
  static validateStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      'in_progress': ['awaiting', 'completed'], // Can skip awaiting if needed
      'awaiting': ['completed', 'in_progress'], // Can go back to in_progress
      'completed': [] // Cannot change from completed
    }

    const allowedNextStatuses = validTransitions[currentStatus] || []
    
    if (!allowedNextStatuses.includes(newStatus)) {
      return {
        valid: false,
        error: `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowedNextStatuses.join(', ')}`
      }
    }

    return { valid: true }
  }

  /**
   * Get task statistics
   */
  static async getTaskStatistics() {
    try {
      const supabase = await createServerSupabase()

      // Get total counts by status
      const { data: statusCounts, error: statusError } = await supabase
        .from('tasks')
        .select('status')

      if (statusError) {
        throw new Error(`Failed to fetch task statistics: ${statusError.message}`)
      }

      const stats = {
        total: statusCounts.length,
        in_progress: statusCounts.filter(t => t.status === 'in_progress').length,
        awaiting: statusCounts.filter(t => t.status === 'awaiting').length,
        completed: statusCounts.filter(t => t.status === 'completed').length
      }

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: recentTasks, error: recentError } = await supabase
        .from('tasks')
        .select('created_at, completed_at, status')
        .gte('created_at', thirtyDaysAgo.toISOString())

      if (!recentError && recentTasks) {
        stats.recentlyCreated = recentTasks.length
        stats.recentlyCompleted = recentTasks.filter(t => 
          t.completed_at && new Date(t.completed_at) >= thirtyDaysAgo
        ).length
      }

      return stats
    } catch (error) {
      console.error('Error fetching task statistics:', error)
      return {
        total: 0,
        in_progress: 0,
        awaiting: 0,
        completed: 0,
        recentlyCreated: 0,
        recentlyCompleted: 0
      }
    }
  }
}