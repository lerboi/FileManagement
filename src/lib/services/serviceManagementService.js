// src/lib/services/serviceManagementService.js
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase'

export class ServiceManagementService {
  
  // Get all services with template count and validation
  static async getAllServices(includeInactive = false) {
    try {
      const supabase = await createServerSupabase()
      
      let query = supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (!includeInactive) {
        query = query.eq('is_active', true)
      }
      
      const { data: services, error } = await query
      
      if (error) {
        throw new Error(`Failed to fetch services: ${error.message}`)
      }
      
      // Add template count and validation for each service
      const servicesWithMeta = await Promise.all(
        (services || []).map(async (service) => {
          const templateCount = service.template_ids ? service.template_ids.length : 0
          const validation = await this.validateServiceTemplates(service.template_ids || [])
          
          return {
            ...service,
            template_count: templateCount,
            validation: validation,
            has_inactive_templates: validation.inactiveTemplates.length > 0,
            has_missing_templates: validation.missingTemplates.length > 0
          }
        })
      )
      
      return {
        success: true,
        services: servicesWithMeta
      }
    } catch (error) {
      console.error('Error fetching services:', error)
      return {
        success: false,
        error: error.message,
        services: []
      }
    }
  }
  
  // Get a single service with full template details
  static async getServiceById(id, includeTemplateDetails = true) {
    try {
      const supabase = await createServerSupabase()
      
      const { data: service, error } = await supabase
        .from('services')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Service not found')
        }
        throw new Error(`Failed to fetch service: ${error.message}`)
      }
      
      let serviceWithDetails = { ...service }
      
      if (includeTemplateDetails && service.template_ids && service.template_ids.length > 0) {
        // Get full template details
        const { data: templates, error: templatesError } = await supabase
          .from('document_templates')
          .select('id, name, description, status, template_type, custom_fields')
          .in('id', service.template_ids)
        
        if (templatesError) {
          console.warn('Error fetching template details:', templatesError)
          serviceWithDetails.templates = []
        } else {
          serviceWithDetails.templates = templates || []
        }
        
        // Validate templates
        serviceWithDetails.validation = await this.validateServiceTemplates(service.template_ids)
      }
      
      return serviceWithDetails
    } catch (error) {
      console.error('Error fetching service:', error)
      throw error
    }
  }
  
  // Create a new service
  static async createService(serviceData) {
    try {
      const supabase = await createServerSupabase()
      
      // Validation
      if (!serviceData.name || !serviceData.name.trim()) {
        throw new Error('Service name is required')
      }
      
      if (!serviceData.template_ids || serviceData.template_ids.length === 0) {
        throw new Error('At least one template must be selected for the service')
      }
      
      // Validate templates exist and are active
      const templateValidation = await this.validateServiceTemplates(serviceData.template_ids)
      if (templateValidation.missingTemplates.length > 0) {
        throw new Error(`Templates not found: ${templateValidation.missingTemplates.join(', ')}`)
      }
      
      // Warn about inactive templates but don't block creation
      if (templateValidation.inactiveTemplates.length > 0) {
        console.warn(`Service created with inactive templates: ${templateValidation.inactiveTemplates.join(', ')}`)
      }
      
      const { data, error } = await supabase
        .from('services')
        .insert([{
          name: serviceData.name.trim(),
          description: serviceData.description?.trim() || null,
          template_ids: serviceData.template_ids,
          is_active: serviceData.is_active !== undefined ? serviceData.is_active : true
        }])
        .select()
        .single()
      
      if (error) {
        throw new Error(`Failed to create service: ${error.message}`)
      }
      
      return {
        success: true,
        service: data,
        warnings: templateValidation.inactiveTemplates.length > 0 ? 
          [`Service created with ${templateValidation.inactiveTemplates.length} inactive templates`] : []
      }
    } catch (error) {
      console.error('Error creating service:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  // Update an existing service
  static async updateService(id, updates) {
    try {
      const supabase = await createServerSupabase()
      
      // Validation
      if (updates.name !== undefined && (!updates.name || !updates.name.trim())) {
        throw new Error('Service name cannot be empty')
      }
      
      if (updates.template_ids !== undefined) {
        if (!Array.isArray(updates.template_ids) || updates.template_ids.length === 0) {
          throw new Error('At least one template must be selected for the service')
        }
        
        // Validate templates
        const templateValidation = await this.validateServiceTemplates(updates.template_ids)
        if (templateValidation.missingTemplates.length > 0) {
          throw new Error(`Templates not found: ${templateValidation.missingTemplates.join(', ')}`)
        }
      }
      
      // Prepare update data
      const updateData = {}
      if (updates.name !== undefined) updateData.name = updates.name.trim()
      if (updates.description !== undefined) updateData.description = updates.description?.trim() || null
      if (updates.template_ids !== undefined) updateData.template_ids = updates.template_ids
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active
      
      const { data, error } = await supabase
        .from('services')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Service not found')
        }
        throw new Error(`Failed to update service: ${error.message}`)
      }
      
      // Check for warnings
      let warnings = []
      if (updates.template_ids) {
        const templateValidation = await this.validateServiceTemplates(updates.template_ids)
        if (templateValidation.inactiveTemplates.length > 0) {
          warnings.push(`Service updated with ${templateValidation.inactiveTemplates.length} inactive templates`)
        }
      }
      
      return {
        success: true,
        service: data,
        warnings
      }
    } catch (error) {
      console.error('Error updating service:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  // Delete a service
  static async deleteService(id) {
    try {
      const supabase = await createServerSupabase()
      
      // Check if service exists
      const { data: existingService, error: fetchError } = await supabase
        .from('services')
        .select('id, name')
        .eq('id', id)
        .single()
      
      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          throw new Error('Service not found')
        }
        throw new Error(`Failed to verify service: ${fetchError.message}`)
      }
      
      // TODO: Check if service is used by any active tasks (when tasks are implemented)
      // This would prevent deletion of services that are actively being used
      
      const { error: deleteError } = await supabase
        .from('services')
        .delete()
        .eq('id', id)
      
      if (deleteError) {
        throw new Error(`Failed to delete service: ${deleteError.message}`)
      }
      
      return {
        success: true,
        deletedService: existingService
      }
    } catch (error) {
      console.error('Error deleting service:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  // Validate service templates (check if they exist and are active)
  static async validateServiceTemplates(templateIds) {
    if (!templateIds || templateIds.length === 0) {
      return {
        valid: false,
        activeTemplates: [],
        inactiveTemplates: [],
        missingTemplates: [],
        totalTemplates: 0
      }
    }
    
    try {
      const supabase = await createServerSupabase()
      
      const { data: templates, error } = await supabase
        .from('document_templates')
        .select('id, name, status')
        .in('id', templateIds)
      
      if (error) {
        console.error('Error validating templates:', error)
        return {
          valid: false,
          activeTemplates: [],
          inactiveTemplates: [],
          missingTemplates: templateIds,
          totalTemplates: templateIds.length
        }
      }
      
      const foundTemplateIds = (templates || []).map(t => t.id)
      const activeTemplates = (templates || []).filter(t => t.status === 'active')
      const inactiveTemplates = (templates || []).filter(t => t.status !== 'active')
      const missingTemplates = templateIds.filter(id => !foundTemplateIds.includes(id))
      
      return {
        valid: missingTemplates.length === 0,
        activeTemplates: activeTemplates.map(t => ({ id: t.id, name: t.name })),
        inactiveTemplates: inactiveTemplates.map(t => ({ id: t.id, name: t.name, status: t.status })),
        missingTemplates,
        totalTemplates: templateIds.length,
        foundTemplates: templates || []
      }
    } catch (error) {
      console.error('Error in template validation:', error)
      return {
        valid: false,
        activeTemplates: [],
        inactiveTemplates: [],
        missingTemplates: templateIds,
        totalTemplates: templateIds.length
      }
    }
  }
  
  // Get service statistics
  static async getServiceStatistics() {
    try {
      const supabase = await createServerSupabase()
      
      const { data: services, error } = await supabase
        .from('services')
        .select('id, is_active, template_ids')
      
      if (error) {
        throw new Error(`Failed to fetch service statistics: ${error.message}`)
      }
      
      const totalServices = services.length
      const activeServices = services.filter(s => s.is_active).length
      const inactiveServices = totalServices - activeServices
      const totalTemplatesInServices = services.reduce((sum, s) => 
        sum + (s.template_ids ? s.template_ids.length : 0), 0
      )
      const averageTemplatesPerService = totalServices > 0 ? 
        Math.round(totalTemplatesInServices / totalServices * 10) / 10 : 0
      
      return {
        totalServices,
        activeServices,
        inactiveServices,
        totalTemplatesInServices,
        averageTemplatesPerService
      }
    } catch (error) {
      console.error('Error getting service statistics:', error)
      throw error
    }
  }
}