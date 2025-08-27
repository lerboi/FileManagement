// src/lib/services/serviceTemplateService.js
import { createServerSupabase } from '@/lib/supabase'

export class ServiceTemplateService {
  
  // Get all active templates available for service selection
  static async getActiveTemplatesForSelection() {
    try {
      const supabase = await createServerSupabase()
      
      const { data: templates, error } = await supabase
        .from('document_templates')
        .select('id, name, description, template_type, custom_fields, created_at, updated_at')
        .eq('status', 'active')
        .order('name', { ascending: true })
      
      if (error) {
        throw new Error(`Failed to fetch active templates: ${error.message}`)
      }
      
      // Add metadata for each template
      const templatesWithMeta = (templates || []).map(template => ({
        ...template,
        custom_field_count: template.custom_fields ? template.custom_fields.length : 0,
        has_custom_fields: template.custom_fields && template.custom_fields.length > 0
      }))
      
      return {
        success: true,
        templates: templatesWithMeta,
        total: templatesWithMeta.length
      }
    } catch (error) {
      console.error('Error fetching active templates:', error)
      return {
        success: false,
        error: error.message,
        templates: []
      }
    }
  }
  
  // Validate a selection of template IDs
  static async validateTemplateSelection(templateIds) {
    if (!templateIds || !Array.isArray(templateIds) || templateIds.length === 0) {
      return {
        valid: false,
        error: 'At least one template must be selected',
        templates: [],
        customFields: []
      }
    }
    
    try {
      const supabase = await createServerSupabase()
      
      const { data: templates, error } = await supabase
        .from('document_templates')
        .select('id, name, description, status, template_type, custom_fields')
        .in('id', templateIds)
      
      if (error) {
        throw new Error(`Failed to validate templates: ${error.message}`)
      }
      
      const foundIds = (templates || []).map(t => t.id)
      const missingIds = templateIds.filter(id => !foundIds.includes(id))
      const inactiveTemplates = (templates || []).filter(t => t.status !== 'active')
      
      // Get aggregated custom fields
      const aggregatedFields = this.aggregateCustomFields(templates || [])
      
      let warnings = []
      if (inactiveTemplates.length > 0) {
        warnings.push(`${inactiveTemplates.length} selected template(s) are not active`)
      }
      
      return {
        valid: missingIds.length === 0,
        error: missingIds.length > 0 ? `Templates not found: ${missingIds.join(', ')}` : null,
        templates: templates || [],
        customFields: aggregatedFields,
        warnings,
        stats: {
          total: templateIds.length,
          found: foundIds.length,
          missing: missingIds.length,
          active: (templates || []).filter(t => t.status === 'active').length,
          inactive: inactiveTemplates.length,
          totalCustomFields: aggregatedFields.length
        }
      }
    } catch (error) {
      console.error('Error validating template selection:', error)
      return {
        valid: false,
        error: error.message,
        templates: []
      }
    }
  }
  
  // Get aggregated custom fields from multiple templates
  static async getAggregatedCustomFields(templateIds) {
    if (!templateIds || templateIds.length === 0) {
      return {
        success: true,
        customFields: [],
        fieldsByTemplate: {},
        stats: { totalFields: 0, uniqueFields: 0, conflicts: [] }
      }
    }
    
    try {
      const supabase = await createServerSupabase()
      
      const { data: templates, error } = await supabase
        .from('document_templates')
        .select('id, name, custom_fields')
        .in('id', templateIds)
        .eq('status', 'active') // Only get active templates
      
      if (error) {
        throw new Error(`Failed to fetch template custom fields: ${error.message}`)
      }
      
      const aggregatedFields = this.aggregateCustomFields(templates || [])
      const fieldsByTemplate = this.getFieldsByTemplate(templates || [])
      const conflicts = this.detectFieldConflicts(templates || [])
      
      return {
        success: true,
        customFields: aggregatedFields,
        fieldsByTemplate,
        stats: {
          totalFields: this.getTotalFieldCount(templates || []),
          uniqueFields: aggregatedFields.length,
          conflicts: conflicts.length,
          templatesWithFields: (templates || []).filter(t => t.custom_fields && t.custom_fields.length > 0).length
        },
        conflicts
      }
    } catch (error) {
      console.error('Error aggregating custom fields:', error)
      return {
        success: false,
        error: error.message,
        customFields: []
      }
    }
  }
  
  // Aggregate custom fields from multiple templates (deduplicate by name)
  static aggregateCustomFields(templates) {
    const fieldMap = new Map()
    const fieldSources = new Map() // Track which templates contribute each field
    
    templates.forEach(template => {
      if (template.custom_fields && Array.isArray(template.custom_fields)) {
        template.custom_fields.forEach(field => {
          if (field.name) {
            const key = field.name.toLowerCase()
            
            if (!fieldMap.has(key)) {
              // First occurrence of this field
              fieldMap.set(key, {
                ...field,
                sourceTemplates: [{ id: template.id, name: template.name }]
              })
              fieldSources.set(key, [template.id])
            } else {
              // Field already exists, add to sources
              const existingField = fieldMap.get(key)
              existingField.sourceTemplates.push({ id: template.id, name: template.name })
              fieldSources.set(key, [...fieldSources.get(key), template.id])
            }
          }
        })
      }
    })
    
    return Array.from(fieldMap.values())
  }
  
  // Get custom fields organized by template
  static getFieldsByTemplate(templates) {
    const fieldsByTemplate = {}
    
    templates.forEach(template => {
      fieldsByTemplate[template.id] = {
        templateName: template.name,
        fields: template.custom_fields || []
      }
    })
    
    return fieldsByTemplate
  }
  
  // Detect conflicts between custom fields with same names but different definitions
  static detectFieldConflicts(templates) {
    const fieldDefinitions = new Map() // Map of field name -> array of definitions
    const conflicts = []
    
    templates.forEach(template => {
      if (template.custom_fields && Array.isArray(template.custom_fields)) {
        template.custom_fields.forEach(field => {
          if (field.name) {
            const key = field.name.toLowerCase()
            
            if (!fieldDefinitions.has(key)) {
              fieldDefinitions.set(key, [{
                ...field,
                templateId: template.id,
                templateName: template.name
              }])
            } else {
              fieldDefinitions.get(key).push({
                ...field,
                templateId: template.id,
                templateName: template.name
              })
            }
          }
        })
      }
    })
    
    // Check for conflicts (same name, different type or other properties)
    fieldDefinitions.forEach((definitions, fieldName) => {
      if (definitions.length > 1) {
        // Check if all definitions are the same
        const firstDef = definitions[0]
        const hasConflict = definitions.some(def => 
          def.type !== firstDef.type ||
          def.required !== firstDef.required ||
          def.label !== firstDef.label
        )
        
        if (hasConflict) {
          conflicts.push({
            fieldName,
            definitions: definitions.map(def => ({
              templateId: def.templateId,
              templateName: def.templateName,
              type: def.type,
              required: def.required,
              label: def.label
            }))
          })
        }
      }
    })
    
    return conflicts
  }
  
  // Get total count of all custom fields across templates
  static getTotalFieldCount(templates) {
    return templates.reduce((total, template) => {
      return total + (template.custom_fields ? template.custom_fields.length : 0)
    }, 0)
  }
  
  // Get templates by type for organized selection
  static async getTemplatesByType() {
    try {
      const result = await this.getActiveTemplatesForSelection()
      
      if (!result.success) {
        return result
      }
      
      const templatesByType = {}
      result.templates.forEach(template => {
        const type = template.template_type || 'other'
        if (!templatesByType[type]) {
          templatesByType[type] = []
        }
        templatesByType[type].push(template)
      })
      
      return {
        success: true,
        templatesByType,
        types: Object.keys(templatesByType).sort(),
        totalTemplates: result.templates.length
      }
    } catch (error) {
      console.error('Error grouping templates by type:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  // Get service generation preview (what will be created)
  static async getServiceGenerationPreview(templateIds) {
    try {
      const validation = await this.validateTemplateSelection(templateIds)
      
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        }
      }
      
      const customFieldsResult = await this.getAggregatedCustomFields(templateIds)
      
      return {
        success: true,
        preview: {
          documentsToGenerate: validation.templates.length,
          templates: validation.templates.map(t => ({
            id: t.id,
            name: t.name,
            type: t.template_type
          })),
          customFieldsRequired: customFieldsResult.customFields.length,
          customFields: customFieldsResult.customFields,
          warnings: validation.warnings || [],
          conflicts: customFieldsResult.conflicts || [],
          estimatedFields: customFieldsResult.stats.totalFields
        }
      }
    } catch (error) {
      console.error('Error generating service preview:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}