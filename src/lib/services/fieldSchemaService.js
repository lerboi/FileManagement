// src/lib/services/fieldSchemaService.js (Enhanced Version)
import { createServiceSupabase } from '@/lib/supabase'

export class FieldSchemaService {
  static fieldCache = new Map()
  static cacheExpiry = 5 * 60 * 1000 // 5 minutes

  /**
   * Dynamically discover client table structure using multiple strategies
   */
  static async getClientTableSchema() {
    const cacheKey = 'client_schema'
    const cached = this.fieldCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data
    }

    console.log('Fetching client table schema...')
    let schema = []
    let discoveryMethod = 'unknown'

    try {
      const supabase = createServiceSupabase()
      
      // Strategy 1: Use PostgreSQL function (if available)
      try {
        console.log('Attempting PostgreSQL function method...')
        const { data, error } = await supabase.rpc('get_client_schema')

        if (!error && data && data.length > 0) {
          console.log('PostgreSQL function method succeeded')
          schema = data.map(col => ({
            name: col.column_name,
            type: this.mapPostgresTypeToDisplayType(col.data_type),
            nullable: col.is_nullable === 'YES',
            hasDefault: col.column_default !== null,
            category: this.categorizeField(col.column_name),
            label: this.generateFieldLabel(col.column_name),
            description: this.generateFieldDescription(col.column_name, col.data_type)
          }))
          discoveryMethod = 'postgresql_function'
        }
      } catch (rpcError) {
        console.warn('PostgreSQL function method failed:', rpcError.message)
      }

      // Strategy 2: Sample-based inference (if PostgreSQL function failed)
      if (schema.length === 0) {
        try {
          console.log('Attempting sample-based inference method...')
          const { data: sampleData, error: sampleError } = await supabase
            .from('clients')
            .select('*')
            .limit(1)
            .maybeSingle()

          if (!sampleError && sampleData) {
            console.log('Sample-based inference method succeeded')
            schema = Object.keys(sampleData)
              .filter(key => !['id', 'created_at', 'updated_at'].includes(key))
              .map(columnName => ({
                name: columnName,
                type: this.inferTypeFromValue(sampleData[columnName]),
                nullable: true, // Conservative assumption
                hasDefault: false, // Conservative assumption
                category: this.categorizeField(columnName),
                label: this.generateFieldLabel(columnName),
                description: this.generateFieldDescription(columnName, this.inferTypeFromValue(sampleData[columnName]))
              }))
            discoveryMethod = 'sample_based'
          }
        } catch (sampleError) {
          console.warn('Sample-based inference method failed:', sampleError.message)
        }
      }

      // Strategy 3: Configuration-based schema (if all else fails)
      if (schema.length === 0) {
        console.log('Using configuration-based schema')
        schema = await this.getConfigurableClientSchema()
        discoveryMethod = 'configuration_based'
      }

      // Add computed fields
      const computedFields = await this.getComputedFields(schema)
      const fullSchema = [...schema, ...computedFields]

      // Cache the result with metadata
      this.fieldCache.set(cacheKey, {
        data: fullSchema,
        timestamp: Date.now(),
        discoveryMethod,
        sourceRecordCount: schema.length
      })

      console.log(`Schema discovery completed using ${discoveryMethod} method with ${fullSchema.length} fields`)
      return fullSchema

    } catch (error) {
      console.error('All schema discovery methods failed:', error)
      return this.getFallbackSchema()
    }
  }

  /**
   * Get configurable client schema that can be customized
   * This reads from environment variables or a config file
   */
  static async getConfigurableClientSchema() {
    // Try to load from environment variable or config
    const configSchema = process.env.CLIENT_SCHEMA_CONFIG
    
    if (configSchema) {
      try {
        const parsedConfig = JSON.parse(configSchema)
        return parsedConfig.map(field => ({
          ...field,
          category: this.categorizeField(field.name),
          label: this.generateFieldLabel(field.name),
          description: this.generateFieldDescription(field.name, field.type)
        }))
      } catch (error) {
        console.warn('Failed to parse CLIENT_SCHEMA_CONFIG:', error)
      }
    }

    // Default comprehensive schema
    return [
      // Personal Information
      { name: 'first_name', type: 'string', nullable: false },
      { name: 'last_name', type: 'string', nullable: false },
      { name: 'middle_name', type: 'string', nullable: true },
      { name: 'date_of_birth', type: 'date', nullable: true },
      { name: 'gender', type: 'string', nullable: true },
      { name: 'title', type: 'string', nullable: true },

      // Contact Information
      { name: 'email', type: 'string', nullable: true },
      { name: 'phone', type: 'string', nullable: true },
      { name: 'mobile', type: 'string', nullable: true },
      { name: 'address_line_1', type: 'string', nullable: true },
      { name: 'address_line_2', type: 'string', nullable: true },
      { name: 'city', type: 'string', nullable: true },
      { name: 'state', type: 'string', nullable: true },
      { name: 'postal_code', type: 'string', nullable: true },
      { name: 'country', type: 'string', nullable: true },

      // Professional Information
      { name: 'occupation', type: 'string', nullable: true },
      { name: 'company', type: 'string', nullable: true },
      { name: 'job_title', type: 'string', nullable: true },
      { name: 'work_email', type: 'string', nullable: true },
      { name: 'work_phone', type: 'string', nullable: true },

      // System Fields
      { name: 'status', type: 'string', nullable: false },
      { name: 'client_type', type: 'string', nullable: false },
      { name: 'notes', type: 'text', nullable: true }
    ].map(field => ({
      ...field,
      hasDefault: field.nullable === false,
      category: this.categorizeField(field.name),
      label: this.generateFieldLabel(field.name),
      description: this.generateFieldDescription(field.name, field.type)
    }))
  }

  /**
   * Infer data type from a sample value
   */
  static inferTypeFromValue(value) {
    if (value === null || value === undefined) {
      return 'string' // Default assumption
    }
    
    if (typeof value === 'boolean') {
      return 'boolean'
    }
    
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'number' : 'number'
    }
    
    if (typeof value === 'string') {
      // Check if it looks like a date
      if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return 'date'
      }
      
      if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        return 'datetime'
      }
      
      // Check if it looks like an email
      if (value.includes('@') && value.includes('.') && value.indexOf('@') < value.lastIndexOf('.')) {
        return 'email'
      }
      
      // Check if it looks like a UUID
      if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return 'uuid'
      }

      // Check if it looks like a phone number
      if (value.match(/^[\+]?[1-9][\d\s\-\(\)]+$/)) {
        return 'phone'
      }
      
      // Check if it's very long text
      if (value.length > 255) {
        return 'text'
      }
      
      return 'string'
    }
    
    if (typeof value === 'object') {
      return 'json'
    }
    
    return 'string'
  }

  /**
   * Get computed/derived fields that can be calculated from base fields
   */
  static async getComputedFields(baseFields) {
    const computed = []

    // Check if we have name fields
    const hasFirstName = baseFields.some(f => f.name === 'first_name')
    const hasLastName = baseFields.some(f => f.name === 'last_name')
    const hasMiddleName = baseFields.some(f => f.name === 'middle_name')
    
    if (hasFirstName && hasLastName) {
      let formula = 'first_name + " " + last_name'
      if (hasMiddleName) {
        formula = 'first_name + " " + middle_name + " " + last_name'
      }
      
      computed.push({
        name: 'full_name',
        type: 'string',
        computed: true,
        formula: formula,
        label: 'Full Name',
        description: 'Complete client name',
        category: 'personal'
      })
    }

    // Check for address fields
    const addressFields = ['address_line_1', 'address_line_2', 'city', 'state', 'postal_code', 'country']
    const hasAddressFields = addressFields.some(field => baseFields.some(f => f.name === field))
    
    if (hasAddressFields) {
      computed.push({
        name: 'full_address',
        type: 'string',
        computed: true,
        formula: 'buildAddress(address_line_1, address_line_2, city, state, postal_code, country)',
        label: 'Full Address',
        description: 'Complete formatted address',
        category: 'contact'
      })
    }

    // Always add date/time computed fields
    computed.push(
      {
        name: 'current_date',
        type: 'date',
        computed: true,
        formula: 'new Date().toLocaleDateString()',
        label: 'Current Date',
        description: 'Today\'s date',
        category: 'system'
      },
      {
        name: 'current_year',
        type: 'number',
        computed: true,
        formula: 'new Date().getFullYear()',
        label: 'Current Year',
        description: 'Current year',
        category: 'system'
      },
      {
        name: 'current_datetime',
        type: 'datetime',
        computed: true,
        formula: 'new Date().toLocaleString()',
        label: 'Current Date & Time',
        description: 'Current date and time',
        category: 'system'
      }
    )

    return computed
  }

  /**
   * Map PostgreSQL data types to display-friendly types
   */
  static mapPostgresTypeToDisplayType(pgType) {
    const typeMap = {
      'character varying': 'string',
      'varchar': 'string',
      'text': 'text',
      'integer': 'number',
      'bigint': 'number',
      'numeric': 'number',
      'decimal': 'number',
      'real': 'number',
      'double precision': 'number',
      'boolean': 'boolean',
      'date': 'date',
      'timestamp': 'datetime',
      'timestamp without time zone': 'datetime',
      'timestamp with time zone': 'datetime',
      'timestamptz': 'datetime',
      'time': 'time',
      'uuid': 'uuid',
      'json': 'json',
      'jsonb': 'json'
    }
    
    return typeMap[pgType.toLowerCase()] || 'string'
  }

  /**
   * Categorize fields for better organization
   */
  static categorizeField(fieldName) {
    const categories = {
      personal: ['first_name', 'last_name', 'full_name', 'middle_name', 'date_of_birth', 'gender', 'title', 'age'],
      contact: ['email', 'phone', 'mobile', 'address_line_1', 'address_line_2', 'city', 'state', 'postal_code', 'country', 'full_address', 'zip', 'zipcode'],
      professional: ['occupation', 'company', 'job_title', 'department', 'work_phone', 'work_email', 'employer', 'position'],
      financial: ['income', 'net_worth', 'account_number', 'bank_name', 'tax_id', 'ssn', 'salary', 'assets'],
      legal: ['citizenship', 'passport_number', 'drivers_license', 'legal_status', 'id_number'],
      relationship: ['spouse_name', 'emergency_contact', 'relationship_manager', 'referral_source', 'next_of_kin'],
      preferences: ['preferred_language', 'communication_preference', 'timezone', 'preferred_contact_method'],
      system: ['status', 'client_type', 'created_at', 'updated_at', 'current_date', 'current_year', 'current_datetime', 'active', 'archived'],
      custom: []
    }

    for (const [category, fields] of Object.entries(categories)) {
      if (fields.some(field => fieldName.toLowerCase().includes(field.toLowerCase()) || field.toLowerCase().includes(fieldName.toLowerCase()))) {
        return category
      }
    }

    // Check for custom patterns
    if (fieldName.startsWith('custom_') || fieldName.includes('_custom') || fieldName.startsWith('ext_')) {
      return 'custom'
    }

    return 'other'
  }

  /**
   * Generate human-readable labels from field names
   */
  static generateFieldLabel(fieldName) {
    // Handle special cases first
    const specialCases = {
      'ssn': 'SSN',
      'tax_id': 'Tax ID',
      'id': 'ID',
      'uuid': 'UUID',
      'url': 'URL',
      'dob': 'Date of Birth',
      'poc': 'Point of Contact',
      'mgr': 'Manager',
      'dept': 'Department',
      'addr': 'Address',
      'tel': 'Telephone',
      'fax': 'Fax',
      'mobile': 'Mobile Phone'
    }

    if (specialCases[fieldName.toLowerCase()]) {
      return specialCases[fieldName.toLowerCase()]
    }

    // Convert snake_case to Title Case
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  /**
   * Generate descriptions for fields
   */
  static generateFieldDescription(fieldName, dataType) {
    const descriptions = {
      // Personal
      first_name: 'Client\'s first name',
      last_name: 'Client\'s last name',
      full_name: 'Client\'s complete name',
      middle_name: 'Client\'s middle name or initial',
      date_of_birth: 'Client\'s date of birth',
      gender: 'Client\'s gender',
      title: 'Client\'s title (Mr., Mrs., Dr., etc.)',
      
      // Contact
      email: 'Primary email address',
      phone: 'Primary phone number',
      mobile: 'Mobile phone number',
      address_line_1: 'Primary address line',
      address_line_2: 'Secondary address line (apt, suite, etc.)',
      city: 'City name',
      state: 'State or province',
      postal_code: 'Postal or ZIP code',
      country: 'Country name',
      full_address: 'Complete formatted address',
      
      // Professional
      occupation: 'Job title or profession',
      company: 'Employer or company name',
      work_email: 'Work email address',
      work_phone: 'Work phone number',
      job_title: 'Official job title',
      
      // System
      status: 'Client status (active, inactive, etc.)',
      client_type: 'Type of client (individual, corporate, trust)',
      current_date: 'Current date',
      current_year: 'Current year',
      current_datetime: 'Current date and time'
    }

    if (descriptions[fieldName]) {
      return descriptions[fieldName]
    }

    // Generate description based on field name and type
    const label = this.generateFieldLabel(fieldName)
    const typeDescriptions = {
      string: 'text information',
      text: 'detailed text information',
      number: 'numeric value',
      date: 'date value',
      datetime: 'date and time value',
      boolean: 'yes/no value',
      email: 'email address',
      phone: 'phone number'
    }

    return `Client's ${label.toLowerCase()} ${typeDescriptions[dataType] || 'information'}`
  }

  /**
   * Get available fields formatted for AI services
   */
  static async getAvailableFieldsForAI() {
    const schema = await this.getClientTableSchema()
    
    return schema.map(field => ({
      name: field.name,
      label: field.label,
      description: field.description,
      type: field.type,
      computed: field.computed || false,
      category: field.category
    }))
  }

  /**
   * Validate field name against current schema
   */
  static async isValidField(fieldName) {
    const schema = await this.getClientTableSchema()
    return schema.some(field => field.name === fieldName)
  }

  /**
   * Get fields by category
   */
  static async getFieldsByCategory(category) {
    const schema = await this.getClientTableSchema()
    return schema.filter(field => field.category === category)
  }

  /**
   * Get fallback schema if dynamic discovery fails
   */
  static getFallbackSchema() {
    console.warn('Using fallback schema - dynamic discovery failed completely')
    return [
      // Personal
      { name: 'first_name', type: 'string', label: 'First Name', description: 'Client\'s first name', category: 'personal' },
      { name: 'last_name', type: 'string', label: 'Last Name', description: 'Client\'s last name', category: 'personal' },
      { name: 'full_name', type: 'string', label: 'Full Name', description: 'Complete client name', category: 'personal', computed: true },
      
      // Contact
      { name: 'email', type: 'string', label: 'Email', description: 'Primary email address', category: 'contact' },
      { name: 'phone', type: 'string', label: 'Phone', description: 'Primary phone number', category: 'contact' },
      { name: 'address_line_1', type: 'string', label: 'Address Line 1', description: 'Primary address', category: 'contact' },
      { name: 'city', type: 'string', label: 'City', description: 'City name', category: 'contact' },
      { name: 'postal_code', type: 'string', label: 'Postal Code', description: 'ZIP/postal code', category: 'contact' },
      { name: 'country', type: 'string', label: 'Country', description: 'Country name', category: 'contact' },
      
      // Professional
      { name: 'occupation', type: 'string', label: 'Occupation', description: 'Job title or profession', category: 'professional' },
      { name: 'company', type: 'string', label: 'Company', description: 'Employer or company name', category: 'professional' },
      
      // System
      { name: 'current_date', type: 'date', label: 'Current Date', description: 'Today\'s date', category: 'system', computed: true },
      { name: 'current_year', type: 'number', label: 'Current Year', description: 'Current year', category: 'system', computed: true }
    ]
  }

  /**
   * Clear field cache (useful after schema changes)
   */
  static clearCache() {
    this.fieldCache.clear()
  }

  /**
   * Get schema discovery metadata
   */
  static getSchemaMetadata() {
    const cached = this.fieldCache.get('client_schema')
    return {
      isCached: !!cached,
      lastDiscovery: cached?.timestamp ? new Date(cached.timestamp) : null,
      discoveryMethod: cached?.discoveryMethod || 'unknown',
      fieldCount: cached?.data?.length || 0,
      cacheExpiry: this.cacheExpiry
    }
  }

  /**
   * Force refresh schema (clears cache and re-discovers)
   */
  static async refreshSchema() {
    this.clearCache()
    return await this.getClientTableSchema()
  }

  /**
   * Test schema discovery methods
   */
  static async testSchemaDiscovery() {
    const results = {
      postgresqlFunction: { success: false, error: null, fieldCount: 0 },
      sampleBased: { success: false, error: null, fieldCount: 0 },
      configurationBased: { success: false, error: null, fieldCount: 0 }
    }

    const supabase = createServiceSupabase()

    // Test PostgreSQL function method
    try {
      const { data, error } = await supabase.rpc('get_client_schema')
      if (!error && data && data.length > 0) {
        results.postgresqlFunction.success = true
        results.postgresqlFunction.fieldCount = data.length
      } else {
        results.postgresqlFunction.error = error?.message || 'No data returned'
      }
    } catch (error) {
      results.postgresqlFunction.error = error.message
    }

    // Test sample-based method
    try {
      const { data: sampleData, error: sampleError } = await supabase
        .from('clients')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (!sampleError && sampleData) {
        results.sampleBased.success = true
        results.sampleBased.fieldCount = Object.keys(sampleData).length
      } else {
        results.sampleBased.error = sampleError?.message || 'No sample data'
      }
    } catch (error) {
      results.sampleBased.error = error.message
    }

    // Test configuration-based method
    try {
      const configSchema = await this.getConfigurableClientSchema()
      results.configurationBased.success = true
      results.configurationBased.fieldCount = configSchema.length
    } catch (error) {
      results.configurationBased.error = error.message
    }

    return results
  }
}