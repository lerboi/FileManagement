// src/lib/services/signedDocumentStorageService.js
import { createServerSupabase } from '@/lib/supabase'

export class SignedDocumentStorageService {
  static getSignedDocumentPath(taskId, templateId, fileName = null) {
    const basePath = `task-${taskId}/template-${templateId}`
    return fileName ? `${basePath}/${fileName}` : basePath
  }

  static async checkSignedDocumentExists(taskId, templateId) {
    try {
      const supabase = await createServerSupabase()
      const folderPath = this.getSignedDocumentPath(taskId, templateId)
      
      const { data, error } = await supabase.storage
        .from('signed-documents')
        .list(folderPath)
      
      if (error) return { exists: false, files: [] }
      
      return {
        exists: data && data.length > 0,
        files: data || []
      }
    } catch (error) {
      console.error('Error checking signed document:', error)
      return { exists: false, files: [] }
    }
  }

  static async getSignedDocumentUrl(taskId, templateId, fileName) {
    try {
      const supabase = await createServerSupabase()
      const filePath = this.getSignedDocumentPath(taskId, templateId, fileName)
      
      const { data, error } = await supabase.storage
        .from('signed-documents')
        .createSignedUrl(filePath, 3600) // 1 hour expiry
      
      if (error) throw error
      return data.signedUrl
    } catch (error) {
      console.error('Error getting signed document URL:', error)
      return null
    }
  }

  static async uploadSignedDocument(taskId, templateId, file, originalFileName) {
    try {
      const supabase = await createServerSupabase()
      
      // Clean filename for storage
      const fileExtension = originalFileName.split('.').pop()
      const cleanFileName = `signed-document.${fileExtension}`
      
      const filePath = this.getSignedDocumentPath(taskId, templateId, cleanFileName)
      
      const { data, error } = await supabase.storage
        .from('signed-documents')
        .upload(filePath, file, {
          upsert: true // Replace if exists
        })
      
      if (error) throw error
      
      return {
        success: true,
        storagePath: filePath,
        fileName: cleanFileName,
        originalFileName
      }
    } catch (error) {
      console.error('Error uploading signed document:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  static async deleteSignedDocument(taskId, templateId, fileName) {
    try {
      const supabase = await createServerSupabase()
      const filePath = this.getSignedDocumentPath(taskId, templateId, fileName)
      
      const { error } = await supabase.storage
        .from('signed-documents')
        .remove([filePath])
      
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting signed document:', error)
      return { success: false, error: error.message }
    }
  }

  static async createSignedDocumentFolders(taskId, templateIds) {
    try {
      const supabase = await createServerSupabase()
      const results = []
      
      for (const templateId of templateIds) {
        const folderPath = this.getSignedDocumentPath(taskId, templateId, '.gitkeep')
        
        // Create a placeholder file to ensure folder exists
        const { error } = await supabase.storage
          .from('signed-documents')
          .upload(folderPath, new Blob(['']), { upsert: true })
        
        results.push({
          templateId,
          success: !error,
          error: error?.message
        })
      }
      
      return results
    } catch (error) {
      console.error('Error creating signed document folders:', error)
      return []
    }
  }
}