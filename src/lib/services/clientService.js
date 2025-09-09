// src/lib/services/clientService.js
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase'

export class ClientService {

  // Get all clients with pagination and search
  static async getAllClients(page = 1, limit = 10, search = '') {
    try {
      const supabase = await createServerSupabase()

      let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      // Add search functionality
      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
      }

      // Add pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        throw new Error(`Failed to fetch clients: ${error.message}`)
      }

      return {
        clients: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    } catch (error) {
      console.error('Error fetching clients:', error)
      throw error
    }
  }

  // Get a single client by ID with client_info
  static async getClientById(id) {
    try {
      const supabase = await createServerSupabase()

      // Fetch client data with client_info using left join
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          client_info (
            id,
            additional_notes,
            created_at,
            updated_at
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        throw new Error(`Failed to fetch client: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('Error fetching client:', error)
      throw error
    }
  }

  // Create a new client with client_info
  static async createClient(clientData) {
    try {
      const supabase = await createServerSupabase()

      // Extract client_info data from clientData
      const { additional_notes, ...mainClientData } = clientData

      // Start a transaction by creating client first
      const { data: clientResult, error: clientError } = await supabase
        .from('clients')
        .insert([mainClientData])
        .select()
        .single()

      if (clientError) {
        throw new Error(`Failed to create client: ${clientError.message}`)
      }

      // Create corresponding client_info record
      const { data: clientInfoResult, error: clientInfoError } = await supabase
        .from('client_info')
        .insert([{
          client_id: clientResult.id,
          additional_notes: additional_notes || null
        }])
        .select()
        .single()

      if (clientInfoError) {
        // If client_info creation fails, we should ideally rollback the client creation
        // For now, log the error but return the client data
        console.error('Failed to create client_info:', clientInfoError)
      }

      // Return client with client_info data
      return {
        ...clientResult,
        client_info: clientInfoResult || { additional_notes: null }
      }
    } catch (error) {
      console.error('Error creating client:', error)
      throw error
    }
  }

  // Update an existing client and client_info
  static async updateClient(id, clientData) {
    try {
      const supabase = await createServerSupabase()

      // Extract client_info data from clientData
      const { additional_notes, ...mainClientData } = clientData

      // Update main client data
      const { data: clientResult, error: clientError } = await supabase
        .from('clients')
        .update(mainClientData)
        .eq('id', id)
        .select()
        .single()

      if (clientError) {
        throw new Error(`Failed to update client: ${clientError.message}`)
      }

      // Update client_info data
      if (additional_notes !== undefined) {
        const { data: clientInfoResult, error: clientInfoError } = await supabase
          .from('client_info')
          .update({ additional_notes })
          .eq('client_id', id)
          .select()
          .single()

        if (clientInfoError) {
          console.error('Failed to update client_info:', clientInfoError)
        }

        // Return client with updated client_info data
        return {
          ...clientResult,
          client_info: clientInfoResult || { additional_notes }
        }
      }

      return clientResult
    } catch (error) {
      console.error('Error updating client:', error)
      throw error
    }
  }

  // Delete a client (client_info will be deleted automatically due to CASCADE)
  static async deleteClient(id) {
    try {
      const supabase = await createServerSupabase()

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)

      if (error) {
        throw new Error(`Failed to delete client: ${error.message}`)
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting client:', error)
      throw error
    }
  }

  // Get client statistics
  static async getClientStats() {
    try {
      const supabase = await createServerSupabase()

      const { data, error } = await supabase
        .from('clients')
        .select('status, client_type')

      if (error) {
        throw new Error(`Failed to fetch client stats: ${error.message}`)
      }

      const stats = {
        total: data.length,
        active: data.filter(c => c.status === 'active').length,
        inactive: data.filter(c => c.status === 'inactive').length,
        prospects: data.filter(c => c.status === 'prospect').length,
        individuals: data.filter(c => c.client_type === 'individual').length,
        corporates: data.filter(c => c.client_type === 'corporate').length,
        trusts: data.filter(c => c.client_type === 'trust').length
      }

      return stats
    } catch (error) {
      console.error('Error fetching client stats:', error)
      throw error
    }
  }

  // Update client with additional documents (used by ClientDocumentService)
  static async updateClientDocuments(clientId, additionalDocuments) {
    try {
      const supabase = await createServerSupabase()

      const { data: updatedClient, error } = await supabase
        .from('clients')
        .update({
          additional_documents: additionalDocuments,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to update client documents: ${error.message}`)
      }

      return updatedClient
    } catch (error) {
      console.error('Error updating client documents:', error)
      throw error
    }
  }
}