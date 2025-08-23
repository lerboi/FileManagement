// src/lib/services/schemaMigrationService.js
import { createServiceSupabase } from '@/lib/supabase'
import { FieldSchemaService } from './fieldSchemaService'
import { DocumentProcessingService } from './documentProcessingService'

export class SchemaMigrationService {
  
  /**
   * Analyze impact of schema changes on existing templates
   */
  static async analyzeSchemaChanges(oldSchema, newSchema) {
    const changes = {
      added: [],
      removed: [],
      renamed: [],
      typeChanged: []
    }
    
    const oldFieldNames = oldSchema.map(f => f.name)
    const newFieldNames = newSchema.map(f => f.name)
    
    // Find added fields
    changes.added = newSchema.filter(field => !oldFieldNames.includes(field.name))
    
    // Find removed fields
    changes.removed = oldSchema.filter(field => !newFieldNames.includes(field.name))
    
    // Find type changes
    changes.typeChanged = newSchema.filter(newField => {
      const oldField = oldSchema.find(f => f.name === newField.name)
      return oldField && oldField.type !== newField.type
    }).map(newField => ({
      ...newField,
      oldType: oldSchema.find(f => f.name === newField.name).type
    }))
    
    // Detect potential renames (removed field with similar added field)
    const potentialRenames = []
    changes.removed.forEach(removedField => {
      const similarAdded = changes.added.find(addedField => 
        this.calculateFieldSimilarity(removedField.name, addedField.name) > 0.6
      )
      if (similarAdded) {
        potentialRenames.push({
          oldField: removedField,
          newField: similarAdded,
          similarity: this.calculateFieldSimilarity(removedField.name, similarAdded.name)
        })
      }
    })
    
    changes.potentialRenames = potentialRenames
    
    return changes
  }
  
  /**
   * Calculate similarity between field names (for rename detection)
   */
  static calculateFieldSimilarity(name1, name2) {
    const longer = name1.length > name2.length ? name1 : name2
    const shorter = name1.length > name2.length ? name2 : name1
    
    if (longer.length === 0) return 1.0
    
    const distance = this.levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
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
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }
  
  /**
   * Find all templates affected by schema changes
   */
  static async findAffectedTemplates(schemaChanges) {
    try {
      const supabase = createServiceSupabase()
      
      const { data: templates, error } = await supabase
        .from('document_templates')
        .select('id, name, field_mappings, html_content, status')
      
      if (error) throw error
      
      const affectedTemplates = []
      
      templates.forEach(template => {
        if (!template.field_mappings) return
        
        const templateIssues = {
          templateId: template.id,
          templateName: template.name,
          status: template.status,
          issues: []
        }
        
        // Check for removed fields
        Object.entries(template.field_mappings).forEach(([placeholder, fieldName]) => {
          const removedField = schemaChanges.removed.find(f => f.name === fieldName)
          if (removedField) {
            templateIssues.issues.push({
              type: 'field_removed',
              placeholder,
              fieldName,
              severity: 'high'
            })
          }
          
          const typeChanged = schemaChanges.typeChanged.find(f => f.name === fieldName)
          if (typeChanged) {
            templateIssues.issues.push({
              type: 'field_type_changed',
              placeholder,
              fieldName,
              oldType: typeChanged.oldType,
              newType: typeChanged.type,
              severity: 'medium'
            })
          }
        })
        
        if (templateIssues.issues.length > 0) {
          affectedTemplates.push(templateIssues)
        }
      })
      
      return {
        success: true,
        affectedTemplates,
        totalAffected: affectedTemplates.length,
        highSeverityCount: affectedTemplates.filter(t => 
          t.issues.some(i => i.severity === 'high')
        ).length
      }
    } catch (error) {
      console.error('Error finding affected templates:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Auto-migrate templates based on schema changes
   */
  static async autoMigrateTemplates(migrationPlan) {
    const results = {
      successful: [],
      failed: [],
      skipped: []
    }
    
    try {
      const supabase = createServiceSupabase()
      
      for (const templateMigration of migrationPlan) {
        try {
          // Get current template
          const { data: template, error: fetchError } = await supabase
            .from('document_templates')
            .select('*')
            .eq('id', templateMigration.templateId)
            .single()
          
          if (fetchError) throw fetchError
          
          // Apply migrations
          let updatedMappings = { ...template.field_mappings }
          let updatedHtml = template.html_content
          let migrationLog = []
          
          templateMigration.actions.forEach(action => {
            switch (action.type) {
              case 'rename_field':
                // Update field mappings
                Object.keys(updatedMappings).forEach(placeholder => {
                  if (updatedMappings[placeholder] === action.oldFieldName) {
                    updatedMappings[placeholder] = action.newFieldName
                    migrationLog.push(`Renamed ${action.oldFieldName} to ${action.newFieldName}`)
                  }
                })
                
                // Update HTML content
                const oldPlaceholderRegex = new RegExp(`\\{\\{${this.escapeRegExp(action.oldFieldName)}\\}\\}`, 'g')
                updatedHtml = updatedHtml.replace(oldPlaceholderRegex, `{{${action.newFieldName}}}`)
                break
                
              case 'remove_field':
                // Remove from mappings
                Object.keys(updatedMappings).forEach(placeholder => {
                  if (updatedMappings[placeholder] === action.fieldName) {
                    delete updatedMappings[placeholder]
                    migrationLog.push(`Removed field ${action.fieldName}`)
                  }
                })
                
                // Replace in HTML with placeholder indicating removal
                const removePlaceholderRegex = new RegExp(`\\{\\{${this.escapeRegExp(action.fieldName)}\\}\\}`, 'g')
                updatedHtml = updatedHtml.replace(removePlaceholderRegex, `[${action.fieldName.toUpperCase()}_REMOVED]`)
                break
                
              case 'update_field_type':
                // Log type change (no action needed unless specific handling required)
                migrationLog.push(`Field ${action.fieldName} type changed from ${action.oldType} to ${action.newType}`)
                break
            }
          })
          
          // Update template in database
          const { data: updatedTemplate, error: updateError } = await supabase
            .from('document_templates')
            .update({
              field_mappings: updatedMappings,
              html_content: updatedHtml,
              migration_log: migrationLog,
              updated_at: new Date().toISOString()
            })
            .eq('id', templateMigration.templateId)
            .select()
            .single()
          
          if (updateError) throw updateError
          
          results.successful.push({
            templateId: templateMigration.templateId,
            templateName: template.name,
            changes: migrationLog,
            updatedTemplate
          })
          
        } catch (error) {
          console.error(`Error migrating template ${templateMigration.templateId}:`, error)
          results.failed.push({
            templateId: templateMigration.templateId,
            error: error.message
          })
        }
      }
      
      return {
        success: true,
        results
      }
    } catch (error) {
      console.error('Error in auto-migration:', error)
      return {
        success: false,
        error: error.message,
        results
      }
    }
  }
  
  /**
   * Generate migration plan based on schema changes
   */
  static generateMigrationPlan(affectedTemplates, schemaChanges, userChoices = {}) {
    const migrationPlan = []
    
    affectedTemplates.forEach(template => {
      const templateActions = []
      
      template.issues.forEach(issue => {
        switch (issue.type) {
          case 'field_removed':
            // Check if user provided a rename mapping
            const renameChoice = userChoices.renames && userChoices.renames[issue.fieldName]
            if (renameChoice) {
              templateActions.push({
                type: 'rename_field',
                oldFieldName: issue.fieldName,
                newFieldName: renameChoice,
                placeholder: issue.placeholder
              })
            } else {
              // Remove the field
              templateActions.push({
                type: 'remove_field',
                fieldName: issue.fieldName,
                placeholder: issue.placeholder
              })
            }
            break
            
          case 'field_type_changed':
            templateActions.push({
              type: 'update_field_type',
              fieldName: issue.fieldName,
              oldType: issue.oldType,
              newType: issue.newType,
              placeholder: issue.placeholder
            })
            break
        }
      })
      
      if (templateActions.length > 0) {
        migrationPlan.push({
          templateId: template.templateId,
          templateName: template.templateName,
          actions: templateActions
        })
      }
    })
    
    return migrationPlan
  }
  
  /**
   * Create backup of templates before migration
   */
  static async backupTemplates(templateIds) {
    try {
      const supabase = createServiceSupabase()
      
      const { data: templates, error } = await supabase
        .from('document_templates')
        .select('*')
        .in('id', templateIds)
      
      if (error) throw error
      
      // Save backup with timestamp
      const backupData = {
        timestamp: new Date().toISOString(),
        templates: templates,
        reason: 'schema_migration'
      }
      
      const { data: backup, error: backupError } = await supabase
        .from('template_backups')
        .insert([backupData])
        .select()
        .single()
      
      if (backupError) throw backupError
      
      return {
        success: true,
        backupId: backup.id,
        templatesBackedUp: templates.length
      }
    } catch (error) {
      console.error('Error creating template backup:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Utility function to escape regex special characters
   */
  static escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}