// src/app/api/fields/test/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { FieldSchemaService } from '@/lib/services/fieldSchemaService'
import { createServiceSupabase } from '@/lib/supabase'

// GET - Test schema discovery methods
export async function GET(request) {
  try {
    // Check authentication
    await requireAuth()
    
    console.log('=== Schema Discovery Test Started ===')
    
    const supabase = createServiceSupabase()
    const testResults = {
      timestamp: new Date().toISOString(),
      methods: {},
      finalSchema: null,
      recommendations: []
    }

    // Test Method 1: PostgreSQL RPC Function
    console.log('Testing PostgreSQL RPC method...')
    try {
      const { data, error } = await supabase.rpc('get_client_schema')
      testResults.methods.postgresqlRPC = {
        success: !error && data && data.length > 0,
        error: error?.message || null,
        fieldCount: data?.length || 0,
        sampleFields: data?.slice(0, 3)?.map(f => f.column_name) || [],
        rawResponse: data?.slice(0, 2) || null
      }
      
      if (!error && data && data.length > 0) {
        console.log(`PostgreSQL RPC: SUCCESS (${data.length} fields)`)
        testResults.recommendations.push('✅ PostgreSQL RPC method works - this is the preferred method')
      } else {
        console.log(`PostgreSQL RPC: FAILED - ${error?.message || 'No data'}`)
        testResults.recommendations.push('❌ PostgreSQL RPC method failed - you need to create the database function')
      }
    } catch (rpcError) {
      console.log(`PostgreSQL RPC: ERROR - ${rpcError.message}`)
      testResults.methods.postgresqlRPC = {
        success: false,
        error: rpcError.message,
        fieldCount: 0
      }
    }

    // Test Method 2: Sample Data Inference
    console.log('Testing sample data inference method...')
    try {
      const { data: sampleData, error: sampleError } = await supabase
        .from('clients')
        .select('*')
        .limit(1)
        .maybeSingle()

      const hasData = !sampleError && sampleData && Object.keys(sampleData).length > 0
      testResults.methods.sampleInference = {
        success: hasData,
        error: sampleError?.message || null,
        fieldCount: hasData ? Object.keys(sampleData).length : 0,
        sampleFields: hasData ? Object.keys(sampleData).slice(0, 5) : [],
        sampleRecord: hasData ? Object.fromEntries(
          Object.entries(sampleData).slice(0, 3).map(([k, v]) => [k, typeof v === 'string' ? v.substring(0, 20) + '...' : v])
        ) : null
      }
      
      if (hasData) {
        console.log(`Sample inference: SUCCESS (${Object.keys(sampleData).length} fields)`)
        testResults.recommendations.push('✅ Sample data inference works - good fallback method')
      } else {
        console.log(`Sample inference: FAILED - ${sampleError?.message || 'No data in clients table'}`)
        testResults.recommendations.push('⚠️ Sample data inference failed - your clients table might be empty')
      }
    } catch (sampleError) {
      console.log(`Sample inference: ERROR - ${sampleError.message}`)
      testResults.methods.sampleInference = {
        success: false,
        error: sampleError.message,
        fieldCount: 0
      }
    }

    // Test Method 3: Configuration-based Schema
    console.log('Testing configuration-based method...')
    try {
      const configSchema = await FieldSchemaService.getConfigurableClientSchema()
      testResults.methods.configurationBased = {
        success: true,
        error: null,
        fieldCount: configSchema.length,
        sampleFields: configSchema.slice(0, 5).map(f => f.name),
        hasEnvironmentConfig: !!process.env.CLIENT_SCHEMA_CONFIG
      }
      console.log(`Configuration-based: SUCCESS (${configSchema.length} fields)`)
      testResults.recommendations.push('✅ Configuration-based method works - reliable fallback')
    } catch (configError) {
      console.log(`Configuration-based: ERROR - ${configError.message}`)
      testResults.methods.configurationBased = {
        success: false,
        error: configError.message,
        fieldCount: 0
      }
    }

    // Test the actual FieldSchemaService method
    console.log('Testing actual FieldSchemaService...')
    try {
      const finalSchema = await FieldSchemaService.getClientTableSchema()
      testResults.finalSchema = {
        success: true,
        fieldCount: finalSchema.length,
        fields: finalSchema.map(f => ({
          name: f.name,
          type: f.type,
          category: f.category,
          computed: f.computed || false
        })),
        categories: [...new Set(finalSchema.map(f => f.category))].sort()
      }
      
      const metadata = FieldSchemaService.getSchemaMetadata()
      testResults.finalSchema.metadata = metadata
      
      console.log(`Final schema: SUCCESS (${finalSchema.length} fields using ${metadata.discoveryMethod})`)
      testResults.recommendations.push(`✅ Final schema generated with ${finalSchema.length} fields using ${metadata.discoveryMethod} method`)
      
    } catch (schemaError) {
      console.log(`Final schema: ERROR - ${schemaError.message}`)
      testResults.finalSchema = {
        success: false,
        error: schemaError.message
      }
      testResults.recommendations.push('❌ FieldSchemaService completely failed')
    }

    // Generate setup instructions based on test results
    if (!testResults.methods.postgresqlRPC?.success) {
      testResults.recommendations.push('')
      testResults.recommendations.push('🔧 TO ENABLE POSTGRESQL RPC METHOD:')
      testResults.recommendations.push('1. Go to your Supabase SQL Editor')
      testResults.recommendations.push('2. Run the SQL function provided in the artifacts')
      testResults.recommendations.push('3. This will enable the most reliable schema discovery method')
    }

    if (!testResults.methods.sampleInference?.success && testResults.methods.sampleInference?.error?.includes('empty')) {
      testResults.recommendations.push('')
      testResults.recommendations.push('📝 TO ENABLE SAMPLE INFERENCE METHOD:')
      testResults.recommendations.push('1. Add at least one record to your clients table')
      testResults.recommendations.push('2. This will allow schema inference from actual data')
    }

    console.log('=== Schema Discovery Test Completed ===')
    
    return NextResponse.json({
      success: true,
      testResults,
      summary: {
        workingMethods: Object.values(testResults.methods).filter(m => m.success).length,
        totalMethods: Object.keys(testResults.methods).length,
        finalSchemaSuccess: testResults.finalSchema?.success || false,
        finalFieldCount: testResults.finalSchema?.fieldCount || 0
      }
    })
    
  } catch (error) {
    console.error('Error in schema discovery test:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        recommendations: [
          '❌ Schema discovery test failed completely',
          '🔧 Check your Supabase connection and permissions',
          '📋 Verify the clients table exists in your database'
        ]
      },
      { status: 500 }
    )
  }
}

// POST - Force refresh schema cache
export async function POST(request) {
  try {
    await requireAuth()
    
    console.log('Force refreshing schema cache...')
    const refreshedSchema = await FieldSchemaService.refreshSchema()
    const metadata = FieldSchemaService.getSchemaMetadata()
    
    return NextResponse.json({
      success: true,
      message: 'Schema cache refreshed successfully',
      schema: {
        fieldCount: refreshedSchema.length,
        discoveryMethod: metadata.discoveryMethod,
        timestamp: metadata.lastDiscovery,
        categories: [...new Set(refreshedSchema.map(f => f.category))].sort()
      }
    })
    
  } catch (error) {
    console.error('Error refreshing schema:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    )
  }
}