// CREATE NEW FILE: src/lib/services/clientFieldsService.js
import { createServerSupabase } from '@/lib/supabase'

export class ClientFieldsService {
  // Cache for client table columns to avoid repeated DB calls
  static _clientColumnsCache = null
  static _cacheTimestamp = null
  static CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Get client table columns from database with caching
   */
  static async getClientTableColumns() {
    try {
      // Check if we have valid cached data
      if (
        this._clientColumnsCache && 
        this._cacheTimestamp && 
        Date.now() - this._cacheTimestamp < this.CACHE_DURATION
      ) {
        return {
          success: true,
          columns: this._clientColumnsCache
        }
      }

      const supabase = await createServerSupabase()

      // Query PostgreSQL information_schema to get column information
      const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', 'clients')
        .eq('table_schema', 'public')
        .order('ordinal_position')

      if (error) {
        // Fallback: try to infer columns from a sample client record
        console.warn('Failed to query information_schema, using fallback method:', error.message)
        return await this.getClientColumnsFallback()
      }

      // Process columns and cache
      const columns = data.map(col => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        default: col.column_default
      }))

      // Cache the results
      this._clientColumnsCache = columns
      this._cacheTimestamp = Date.now()

      console.log(`Cached ${columns.length} client table columns`)

      return {
        success: true,
        columns: columns
      }
    } catch (error) {
      console.error('Error fetching client table columns:', error)
      return await this.getClientColumnsFallback()
    }
  }

  /**
   * Fallback method to get columns by analyzing a sample client record
   */
  static async getClientColumnsFallback() {
    try {
      const supabase = await createServerSupabase()

      // Get a sample client record to infer columns
      const { data: sampleClient, error } = await supabase
        .from('clients')
        .select('*')
        .limit(1)
        .single()

      if (error || !sampleClient) {
        console.error('Fallback failed, using default columns:', error?.message)
        return {
          success: false,
          columns: this.getDefaultClientColumns()
        }
      }

      // Extract column names from the sample record
      const columns = Object.keys(sampleClient).map(columnName => ({
        name: columnName,
        type: this.inferDataType(sampleClient[columnName]),
        nullable: sampleClient[columnName] === null,
        default: null
      }))

      // Cache the results
      this._clientColumnsCache = columns
      this._cacheTimestamp = Date.now()

      console.log(`Fallback: inferred ${columns.length} client columns from sample record`)

      return {
        success: true,
        columns: columns
      }
    } catch (error) {
      console.error('Fallback method failed:', error)
      return {
        success: false,
        columns: this.getDefaultClientColumns()
      }
    }
  }

  /**
   * Infer data type from sample value
   */
  static inferDataType(value) {
    if (value === null) return 'unknown'
    if (typeof value === 'string') {
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) return 'date'
      if (value.includes('@')) return 'email'
      return 'text'
    }
    if (typeof value === 'number') return 'numeric'
    if (typeof value === 'boolean') return 'boolean'
    if (value instanceof Date) return 'date'
    return 'unknown'
  }

  /**
   * Default columns as fallback (based on your schema)
   */
  static getDefaultClientColumns() {
    return [
      { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      { name: 'first_name', type: 'text', nullable: false, default: null },
      { name: 'last_name', type: 'text', nullable: false, default: null },
      { name: 'email', type: 'text', nullable: true, default: null },
      { name: 'phone', type: 'text', nullable: true, default: null },
      { name: 'address_line_1', type: 'text', nullable: true, default: null },
      { name: 'address_line_2', type: 'text', nullable: true, default: null },
      { name: 'city', type: 'text', nullable: true, default: null },
      { name: 'state', type: 'text', nullable: true, default: null },
      { name: 'postal_code', type: 'text', nullable: true, default: null },
      { name: 'country', type: 'text', nullable: true, default: 'Singapore' },
      { name: 'date_of_birth', type: 'date', nullable: true, default: null },
      { name: 'occupation', type: 'text', nullable: true, default: null },
      { name: 'company', type: 'text', nullable: true, default: null },
      { name: 'notes', type: 'text', nullable: true, default: null },
      { name: 'status', type: 'text', nullable: true, default: 'active' },
      { name: 'client_type', type: 'text', nullable: true, default: 'individual' },
      { name: 'created_at', type: 'timestamp', nullable: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp', nullable: true, default: 'now()' }
    ]
  }

  /**
   * Generate field mappings from client data dynamically
   */
  static async generateClientFieldMappings(clientData) {
    try {
      const columnsResult = await this.getClientTableColumns()
      const columns = columnsResult.columns

      const fieldMappings = {}

      // Process each column dynamically
      columns.forEach(column => {
        const columnName = column.name
        const columnValue = clientData[columnName]

        // Add the field with its exact column name
        fieldMappings[columnName] = this.formatFieldValue(columnValue, column.type)

        // Add common variations for templates
        fieldMappings[`client_${columnName}`] = fieldMappings[columnName]

        // Add special cases for common template patterns
        if (columnName === 'first_name' && clientData.last_name) {
          fieldMappings['full_name'] = `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim()
          fieldMappings['client_full_name'] = fieldMappings['full_name']
          fieldMappings['client_name'] = fieldMappings['full_name']
        }

        // Build address variations
        if (['address_line_1', 'address_line_2', 'city', 'state', 'postal_code', 'country'].includes(columnName)) {
          if (!fieldMappings['full_address']) {
            fieldMappings['full_address'] = this.buildFullAddress(clientData)
            fieldMappings['client_address'] = fieldMappings['full_address']
            fieldMappings['address'] = fieldMappings['full_address']
          }
        }
      })

      // Add common computed fields
      fieldMappings['current_date'] = this.formatFieldValue(new Date(), 'date')
      fieldMappings['today'] = fieldMappings['current_date']
      fieldMappings['current_datetime'] = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      fieldMappings['current_year'] = new Date().getFullYear().toString()
      fieldMappings['year'] = fieldMappings['current_year']

      return {
        success: true,
        fieldMappings: fieldMappings,
        columnsUsed: columns.length
      }
    } catch (error) {
      console.error('Error generating client field mappings:', error)
      
      // Return minimal mappings as fallback
      return {
        success: false,
        fieldMappings: {
          'first_name': clientData.first_name || '',
          'last_name': clientData.last_name || '',
          'full_name': `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim(),
          'email': clientData.email || '',
          'current_date': this.formatFieldValue(new Date(), 'date')
        },
        error: error.message
      }
    }
  }

  /**
   * Format field value based on type
   */
  static formatFieldValue(value, type) {
    if (value === null || value === undefined) return ''

    switch (type) {
      case 'date':
      case 'timestamp':
        return this.formatDate(value)
      case 'boolean':
        return value ? 'Yes' : 'No'
      case 'numeric':
        return value.toString()
      default:
        return value.toString()
    }
  }

  /**
   * Format date consistently
   */
  static formatDate(date) {
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch (error) {
      console.error('Date formatting error:', error)
      return 'Invalid Date'
    }
  }

  /**
   * Build full address from client data
   */
  static buildFullAddress(client) {
    const addressParts = []
    
    if (client.address_line_1) addressParts.push(client.address_line_1)
    if (client.address_line_2) addressParts.push(client.address_line_2)
    if (client.city) addressParts.push(client.city)
    if (client.state) addressParts.push(client.state)
    if (client.postal_code) addressParts.push(client.postal_code)
    if (client.country) addressParts.push(client.country)
    
    return addressParts.join(', ')
  }

  /**
   * Clear cache (useful for testing or when schema changes)
   */
  static clearCache() {
    this._clientColumnsCache = null
    this._cacheTimestamp = null
    console.log('Client columns cache cleared')
  }

  /**
   * Get cache status
   */
  static getCacheStatus() {
    return {
      cached: !!this._clientColumnsCache,
      timestamp: this._cacheTimestamp,
      age: this._cacheTimestamp ? Date.now() - this._cacheTimestamp : null,
      columns: this._clientColumnsCache?.length || 0
    }
  }
}