// src/lib/services/serviceTemplateService.js
import { createServerSupabase } from '@/lib/supabase'

export class ServiceTemplateService {
  
  // Get all active templates available for service selection
  static async getActiveTemplatesForSelection(supabase) {
    try {
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
        has_placeholder_values: template.custom_fields && Object.keys(template.custom_fields).length > 0
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
  static async validateTemplateSelection(supabase, templateIds) {
    if (!templateIds || !Array.isArray(templateIds) || templateIds.length === 0) {
      return {
        valid: false,
        error: 'At least one template must be selected',
        templates: []
      }
    }
    
    try {
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
      
      // Get aggregated placeholder values needed
      const aggregatedPlaceholderValues = this.aggregatePlaceholderValues(templates || [])
      
      let warnings = []
      if (inactiveTemplates.length > 0) {
        warnings.push(`${inactiveTemplates.length} selected template(s) are not active`)
      }
      
      return {
        valid: missingIds.length === 0,
        error: missingIds.length > 0 ? `Templates not found: ${missingIds.join(', ')}` : null,
        templates: templates || [],
        placeholderValues: aggregatedPlaceholderValues,
        warnings,
        stats: {
          total: templateIds.length,
          found: foundIds.length,
          missing: missingIds.length,
          active: (templates || []).filter(t => t.status === 'active').length,
          inactive: inactiveTemplates.length,
          totalPlaceholderValues: aggregatedPlaceholderValues.length
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
  
  // Get aggregated placeholder values from multiple templates
  static async getAggregatedCustomFields(supabase, templateIds) {
    if (!templateIds || templateIds.length === 0) {
      return {
        success: true,
        placeholderValues: [],
        valuesByTemplate: {},
        stats: { totalValues: 0, uniqueValues: 0, conflicts: [] }
      }
    }
    
    try {
      const { data: templates, error } = await supabase
        .from('document_templates')
        .select('id, name, custom_fields')
        .in('id', templateIds)
        .eq('status', 'active') // Only get active templates
      
      if (error) {
        throw new Error(`Failed to fetch template placeholder values: ${error.message}`)
      }
      
      const aggregatedValues = this.aggregatePlaceholderValues(templates || [])
      const valuesByTemplate = this.getValuesByTemplate(templates || [])
      const conflicts = this.detectValueConflicts(templates || [])
      
      return {
        success: true,
        placeholderValues: aggregatedValues,
        valuesByTemplate,
        stats: {
          totalValues: this.getTotalValueCount(templates || []),
          uniqueValues: aggregatedValues.length,
          conflicts: conflicts.length,
          templatesWithValues: (templates || []).filter(t => t.custom_fields && Object.keys(t.custom_fields).length > 0).length
        },
        conflicts
      }
    } catch (error) {
      console.error('Error aggregating placeholder values:', error)
      return {
        success: false,
        error: error.message,
        placeholderValues: []
      }
    }
  }

  // Get placeholder values organized by template
  static getValuesByTemplate(templates) {
    const valuesByTemplate = {}
    
    templates.forEach(template => {
      valuesByTemplate[template.id] = {
        templateName: template.name,
        values: template.custom_fields || {}
      }
    })
    
    return valuesByTemplate
  }

  // Detect conflicts between placeholder values with same names but different values
  static detectValueConflicts(templates) {
    const valueDefinitions = new Map() // Map of placeholder name -> array of definitions
    const conflicts = []
    
    templates.forEach(template => {
      if (template.custom_fields && typeof template.custom_fields === 'object') {
        Object.entries(template.custom_fields).forEach(([placeholderName, value]) => {
          const key = placeholderName.toLowerCase()
          
          if (!valueDefinitions.has(key)) {
            valueDefinitions.set(key, [{
              value,
              templateId: template.id,
              templateName: template.name
            }])
          } else {
            valueDefinitions.get(key).push({
              value,
              templateId: template.id,
              templateName: template.name
            })
          }
        })
      }
    })
    
    // Check for conflicts (same placeholder name, different values)
    valueDefinitions.forEach((definitions, placeholderName) => {
      if (definitions.length > 1) {
        // Check if all values are the same
        const firstValue = definitions[0].value
        const hasConflict = definitions.some(def => def.value !== firstValue)
        
        if (hasConflict) {
          conflicts.push({
            placeholderName,
            definitions: definitions.map(def => ({
              templateId: def.templateId,
              templateName: def.templateName,
              value: def.value
            }))
          })
        }
      }
    })
    
    return conflicts
  }

  // Get total count of all placeholder values across templates
  static getTotalValueCount(templates) {
    return templates.reduce((total, template) => {
      return total + (template.custom_fields ? Object.keys(template.custom_fields).length : 0)
    }, 0)
  }
  
  // Aggregate placeholder values from multiple templates (deduplicate by placeholder name)
  static aggregatePlaceholderValues(templates) {
    const valueMap = new Map()
    const valueSources = new Map() // Track which templates contribute each value
    
    templates.forEach(template => {
      if (template.custom_fields && typeof template.custom_fields === 'object') {
        Object.entries(template.custom_fields).forEach(([placeholderName, value]) => {
          const key = placeholderName.toLowerCase()
          
          if (!valueMap.has(key)) {
            // First occurrence of this placeholder
            valueMap.set(key, {
              placeholderName,
              value,
              sourceTemplates: [{ id: template.id, name: template.name }]
            })
            valueSources.set(key, [template.id])
          } else {
            // Placeholder already exists, add to sources
            const existingValue = valueMap.get(key)
            existingValue.sourceTemplates.push({ id: template.id, name: template.name })
            valueSources.set(key, [...valueSources.get(key), template.id])
          }
        })
      }
    })
    
    return Array.from(valueMap.values())
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
  
  // Get templates by type for organized selection
  static async getTemplatesByType(supabase) {
    try {
      const result = await this.getActiveTemplatesForSelection(supabase)
      
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
  static async getServiceGenerationPreview(supabase, templateIds) {
    try {
      const validation = await this.validateTemplateSelection(supabase, templateIds)
      
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        }
      }
      
      const placeholderValuesResult = await this.getAggregatedCustomFields(supabase, templateIds)
      
      return {
        success: true,
        preview: {
          documentsToGenerate: validation.templates.length,
          templates: validation.templates.map(t => ({
            id: t.id,
            name: t.name,
            type: t.template_type
          })),
          placeholderValuesRequired: placeholderValuesResult.placeholderValues.length,
          placeholderValues: placeholderValuesResult.placeholderValues,
          warnings: validation.warnings || [],
          conflicts: placeholderValuesResult.conflicts || [],
          estimatedValues: placeholderValuesResult.stats.totalValues
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