// src/lib/services/clientDocumentService.js
import { createServerSupabase } from '@/lib/supabase'

export class ClientDocumentService {
  /**
   * Upload additional documents for a client
   */
  static async uploadClientDocuments(clientId, files, description = '') {
    try {
      if (!clientId) {
        throw new Error('Client ID is required')
      }

      if (!files || files.length === 0) {
        throw new Error('No files provided')
      }

      const supabase = await createServerSupabase()

      // Validate client exists
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, first_name, last_name, additional_documents')
        .eq('id', clientId)
        .single()

      if (clientError) {
        throw new Error(`Failed to fetch client: ${clientError.message}`)
      }

      const uploadedFiles = []
      const errors = []

      // Process each file
      for (const file of files) {
        try {
          const fileName = `${Date.now()}-${file.name}`
          const filePath = `${clientId}/general/${fileName}`

          // Upload to client-documents bucket
          const { data, error } = await supabase.storage
            .from('client-documents')
            .upload(filePath, file, {
              upsert: false
            })

          if (error) {
            errors.push(`Failed to upload ${file.name}: ${error.message}`)
            continue
          }

          // Create signed URL
          const { data: signedUrlData, error: urlError } = await supabase.storage
            .from('client-documents')
            .createSignedUrl(filePath, 3600) // 1 hour expiry

          let downloadUrl = null
          if (!urlError && signedUrlData?.signedUrl) {
            downloadUrl = signedUrlData.signedUrl
          } else {
            // Fallback to public URL
            const { data: publicUrlData } = supabase.storage
              .from('client-documents')
              .getPublicUrl(filePath)
            downloadUrl = publicUrlData?.publicUrl
          }

          uploadedFiles.push({
            id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            originalName: file.name,
            fileName: fileName,
            filePath: filePath,
            downloadUrl: downloadUrl,
            uploadedAt: new Date().toISOString(),
            fileSize: file.size,
            fileType: file.type,
            description: description
          })
        } catch (error) {
          errors.push(`Failed to process ${file.name}: ${error.message}`)
        }
      }

      // Update client with uploaded files
      const existingDocuments = client.additional_documents || []
      const updatedDocuments = [...existingDocuments, ...uploadedFiles]

      const { data: updatedClient, error: updateError } = await supabase
        .from('clients')
        .update({
          additional_documents: updatedDocuments,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update client: ${updateError.message}`)
      }

      console.log(`Uploaded ${uploadedFiles.length} documents for client ${clientId}`)

      return {
        success: true,
        client: updatedClient,
        uploadedFiles: uploadedFiles.length,
        totalDocuments: updatedDocuments.length,
        errors: errors.length > 0 ? errors : null
      }
    } catch (error) {
      console.error('Error uploading client documents:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get all documents for a client
   */
  static async getClientDocuments(clientId) {
    try {
      if (!clientId) {
        throw new Error('Client ID is required')
      }

      const supabase = await createServerSupabase()

      const { data: client, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, additional_documents')
        .eq('id', clientId)
        .single()

      if (error) {
        throw new Error(`Failed to fetch client documents: ${error.message}`)
      }

      const documents = client.additional_documents || []

      // Update signed URLs for documents that need fresh URLs
      const documentsWithFreshUrls = await Promise.all(
        documents.map(async (doc) => {
          try {
            const { data: signedUrlData, error: urlError } = await supabase.storage
              .from('client-documents')
              .createSignedUrl(doc.filePath, 3600)

            if (!urlError && signedUrlData?.signedUrl) {
              return { ...doc, downloadUrl: signedUrlData.signedUrl }
            }
            
            // Fallback to existing URL or public URL
            return doc
          } catch (error) {
            console.warn(`Failed to refresh URL for ${doc.fileName}:`, error)
            return doc
          }
        })
      )

      return {
        success: true,
        documents: documentsWithFreshUrls,
        clientInfo: {
          id: client.id,
          name: `${client.first_name} ${client.last_name}`
        }
      }
    } catch (error) {
      console.error('Error fetching client documents:', error)
      return {
        success: false,
        error: error.message,
        documents: []
      }
    }
  }

  /**
   * Delete a client document
   */
  static async deleteClientDocument(clientId, documentId) {
    try {
      if (!clientId || !documentId) {
        throw new Error('Client ID and Document ID are required')
      }

      const supabase = await createServerSupabase()

      // Get current client data
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('additional_documents')
        .eq('id', clientId)
        .single()

      if (clientError) {
        throw new Error(`Failed to fetch client: ${clientError.message}`)
      }

      const documents = client.additional_documents || []
      const documentToDelete = documents.find(doc => doc.id === documentId)

      if (!documentToDelete) {
        throw new Error('Document not found')
      }

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('client-documents')
        .remove([documentToDelete.filePath])

      if (deleteError) {
        console.warn('Failed to delete file from storage:', deleteError.message)
        // Continue with database update even if storage deletion fails
      }

      // Update client record
      const updatedDocuments = documents.filter(doc => doc.id !== documentId)

      const { data: updatedClient, error: updateError } = await supabase
        .from('clients')
        .update({
          additional_documents: updatedDocuments,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update client: ${updateError.message}`)
      }

      return {
        success: true,
        deletedDocument: documentToDelete,
        remainingDocuments: updatedDocuments.length
      }
    } catch (error) {
      console.error('Error deleting client document:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get download URL for a specific document
   */
  static async getDocumentDownloadUrl(clientId, documentId) {
    try {
      if (!clientId || !documentId) {
        throw new Error('Client ID and Document ID are required')
      }

      const supabase = await createServerSupabase()

      // Get client documents
      const { data: client, error } = await supabase
        .from('clients')
        .select('additional_documents')
        .eq('id', clientId)
        .single()

      if (error) {
        throw new Error(`Failed to fetch client: ${error.message}`)
      }

      const documents = client.additional_documents || []
      const document = documents.find(doc => doc.id === documentId)

      if (!document) {
        throw new Error('Document not found')
      }

      // Create fresh signed URL
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(document.filePath, 3600)

      if (urlError || !signedUrlData?.signedUrl) {
        // Fallback to public URL
        const { data: publicUrlData } = supabase.storage
          .from('client-documents')
          .getPublicUrl(document.filePath)

        if (publicUrlData?.publicUrl) {
          return {
            success: true,
            downloadUrl: publicUrlData.publicUrl,
            fileName: document.originalName,
            fallbackUsed: true
          }
        }

        throw new Error('Failed to create download URL')
      }

      return {
        success: true,
        downloadUrl: signedUrlData.signedUrl,
        fileName: document.originalName
      }
    } catch (error) {
      console.error('Error getting download URL:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Validate client document files
   */
  static validateClientDocuments(files) {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain'
    ]
    const maxSize = 25 * 1024 * 1024 // 25MB
    const maxFiles = 10

    const errors = []

    if (!files || files.length === 0) {
      return { valid: false, errors: ['No files provided'] }
    }

    if (files.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`)
    }

    files.forEach((file, index) => {
      if (file.size > maxSize) {
        errors.push(`File ${index + 1} (${file.name}) exceeds maximum size of ${maxSize / 1024 / 1024}MB`)
      }

      if (!allowedTypes.includes(file.type)) {
        errors.push(`File ${index + 1} (${file.name}) has unsupported type: ${file.type}`)
      }
    })

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : null
    }
  }

  /**
   * Get client document statistics
   */
  static async getClientDocumentStats(clientId) {
    try {
      const result = await this.getClientDocuments(clientId)
      
      if (!result.success) {
        throw new Error(result.error)
      }

      const documents = result.documents
      const totalSize = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0)
      const fileTypes = documents.reduce((types, doc) => {
        const type = doc.fileType || 'unknown'
        types[type] = (types[type] || 0) + 1
        return types
      }, {})

      return {
        totalDocuments: documents.length,
        totalSize: totalSize,
        averageSize: documents.length > 0 ? Math.round(totalSize / documents.length) : 0,
        fileTypes: fileTypes,
        oldestDocument: documents.length > 0 ? 
          documents.reduce((oldest, doc) => 
            new Date(doc.uploadedAt) < new Date(oldest.uploadedAt) ? doc : oldest
          ) : null,
        newestDocument: documents.length > 0 ?
          documents.reduce((newest, doc) => 
            new Date(doc.uploadedAt) > new Date(newest.uploadedAt) ? doc : newest
          ) : null
      }
    } catch (error) {
      console.error('Error getting document stats:', error)
      throw error
    }
  }
}