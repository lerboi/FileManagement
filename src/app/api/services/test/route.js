// src/app/api/services/test/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { ServiceManagementService } from '@/lib/services/serviceManagementService'
import { ServiceTemplateService } from '@/lib/services/serviceTemplateService'

// GET - Test all service system components
export async function GET(request) {
  try {
    // Check authentication
    await requireSession()
    
    console.log('=== Service System Test Started ===')
    
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: {},
      summary: {
        passed: 0,
        failed: 0,
        warnings: []
      }
    }

    // Test 1: Database Connection and Services Table
    console.log('Testing database connection...')
    try {
      const servicesResult = await ServiceManagementService.getAllServices(true)
      testResults.tests.databaseConnection = {
        success: servicesResult.success,
        serviceCount: servicesResult.services?.length || 0,
        error: servicesResult.error || null
      }
      
      if (servicesResult.success) {
        console.log(`✅ Database connection successful (${servicesResult.services.length} services found)`)
        testResults.summary.passed++
      } else {
        console.log(`❌ Database connection failed: ${servicesResult.error}`)
        testResults.summary.failed++
      }
    } catch (error) {
      console.log(`❌ Database connection error: ${error.message}`)
      testResults.tests.databaseConnection = {
        success: false,
        error: error.message
      }
      testResults.summary.failed++
    }

    // Test 2: Active Templates Fetching
    console.log('Testing active templates fetching...')
    try {
      const templatesResult = await ServiceTemplateService.getActiveTemplatesForSelection()
      testResults.tests.activeTemplates = {
        success: templatesResult.success,
        templateCount: templatesResult.templates?.length || 0,
        error: templatesResult.error || null
      }
      
      if (templatesResult.success) {
        console.log(`✅ Active templates fetch successful (${templatesResult.templates.length} templates)`)
        testResults.summary.passed++
        
        if (templatesResult.templates.length === 0) {
          testResults.summary.warnings.push('No active templates found - you may need to activate some templates first')
        }
      } else {
        console.log(`❌ Active templates fetch failed: ${templatesResult.error}`)
        testResults.summary.failed++
      }
    } catch (error) {
      console.log(`❌ Active templates fetch error: ${error.message}`)
      testResults.tests.activeTemplates = {
        success: false,
        error: error.message
      }
      testResults.summary.failed++
    }

    // Test 3: Template Validation (if templates exist)
    if (testResults.tests.activeTemplates?.success && testResults.tests.activeTemplates.templateCount > 0) {
      console.log('Testing template validation...')
      try {
        // Get first few template IDs for testing
        const templatesResult = await ServiceTemplateService.getActiveTemplatesForSelection()
        const testTemplateIds = templatesResult.templates.slice(0, 2).map(t => t.id)
        
        const validationResult = await ServiceTemplateService.validateTemplateSelection(testTemplateIds)
        testResults.tests.templateValidation = {
          success: validationResult.valid,
          testedTemplates: testTemplateIds.length,
          foundTemplates: validationResult.templates?.length || 0,
          customFields: validationResult.customFields?.length || 0,
          error: validationResult.error || null
        }
        
        if (validationResult.valid) {
          console.log(`✅ Template validation successful (${testTemplateIds.length} templates tested)`)
          testResults.summary.passed++
        } else {
          console.log(`❌ Template validation failed: ${validationResult.error}`)
          testResults.summary.failed++
        }
      } catch (error) {
        console.log(`❌ Template validation error: ${error.message}`)
        testResults.tests.templateValidation = {
          success: false,
          error: error.message
        }
        testResults.summary.failed++
      }
    } else {
      testResults.tests.templateValidation = {
        success: false,
        skipped: true,
        reason: 'No active templates available for testing'
      }
    }

    // Test 4: Service Statistics
    console.log('Testing service statistics...')
    try {
      const statsResult = await ServiceManagementService.getServiceStatistics()
      testResults.tests.serviceStatistics = {
        success: true,
        stats: statsResult
      }
      
      console.log(`✅ Service statistics successful`)
      testResults.summary.passed++
    } catch (error) {
      console.log(`❌ Service statistics error: ${error.message}`)
      testResults.tests.serviceStatistics = {
        success: false,
        error: error.message
      }
      testResults.summary.failed++
    }

    // Test 5: Custom Fields Aggregation (if templates with custom fields exist)
    console.log('Testing custom fields aggregation...')
    try {
      const templatesResult = await ServiceTemplateService.getActiveTemplatesForSelection()
      const templatesWithCustomFields = templatesResult.templates?.filter(t => t.has_custom_fields) || []
      
      if (templatesWithCustomFields.length > 0) {
        const testTemplateIds = templatesWithCustomFields.slice(0, 2).map(t => t.id)
        const customFieldsResult = await ServiceTemplateService.getAggregatedCustomFields(testTemplateIds)
        
        testResults.tests.customFieldsAggregation = {
          success: customFieldsResult.success,
          testedTemplates: testTemplateIds.length,
          aggregatedFields: customFieldsResult.customFields?.length || 0,
          conflicts: customFieldsResult.conflicts?.length || 0,
          error: customFieldsResult.error || null
        }
        
        if (customFieldsResult.success) {
          console.log(`✅ Custom fields aggregation successful`)
          testResults.summary.passed++
        } else {
          console.log(`❌ Custom fields aggregation failed: ${customFieldsResult.error}`)
          testResults.summary.failed++
        }
      } else {
        testResults.tests.customFieldsAggregation = {
          success: false,
          skipped: true,
          reason: 'No templates with custom fields found'
        }
        testResults.summary.warnings.push('No templates with custom fields found for testing')
      }
    } catch (error) {
      console.log(`❌ Custom fields aggregation error: ${error.message}`)
      testResults.tests.customFieldsAggregation = {
        success: false,
        error: error.message
      }
      testResults.summary.failed++
    }

    // Generate recommendations based on test results
    const recommendations = []
    
    if (testResults.tests.activeTemplates?.templateCount === 0) {
      recommendations.push('🔧 Activate some document templates to enable service creation')
    }
    
    if (testResults.tests.customFieldsAggregation?.skipped) {
      recommendations.push('📝 Add custom fields to your templates to test full service functionality')
    }
    
    if (testResults.summary.failed === 0) {
      recommendations.push('✅ All systems operational - ready to create services!')
    } else {
      recommendations.push('⚠️ Some tests failed - check the detailed results above')
    }

    console.log('=== Service System Test Completed ===')
    
    return NextResponse.json({
      success: true,
      testResults: {
        ...testResults,
        recommendations,
        systemReady: testResults.summary.failed === 0 && testResults.tests.activeTemplates?.templateCount > 0
      }
    })
    
  } catch (error) {
    console.error('Error in service system test:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        recommendations: [
          '❌ Service system test failed completely',
          '🔧 Check your Supabase connection and database schema',
          '📋 Ensure the services table has been created'
        ]
      },
      { status: 500 }
    )
  }
}