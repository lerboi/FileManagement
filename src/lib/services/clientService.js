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

  // Get a single client by ID
  static async getClientById(id) {
    try {
      const supabase = await createServerSupabase()

      const { data, error } = await supabase
        .from('clients')
        .select('*')
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

  // Create a new client
  static async createClient(clientData) {
    try {
      const supabase = await createServerSupabase()

      const { data, error } = await supabase
        .from('clients')
        .insert([clientData])
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to create client: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('Error creating client:', error)
      throw error
    }
  }

  // Update an existing client
  static async updateClient(id, clientData) {
    try {
      const supabase = await createServerSupabase()

      const { data, error } = await supabase
        .from('clients')
        .update(clientData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to update client: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('Error updating client:', error)
      throw error
    }
  }

  // Delete a client
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
}