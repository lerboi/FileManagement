// src/app/api/services/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ServiceManagementService } from '@/lib/services/serviceManagementService'

// GET - Fetch all services
export async function GET(request) {
  try {
    // Check authentication
    await requireAuth()
    
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    
    const result = await ServiceManagementService.getAllServices(includeInactive)
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      services: result.services
    })
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch services' },
      { status: 500 }
    )
  }
}

// POST - Create a new service
export async function POST(request) {
  try {
    // Check authentication
    await requireAuth()
    
    const serviceData = await request.json()
    
    // Basic validation
    if (!serviceData.name || !serviceData.name.trim()) {
      return NextResponse.json(
        { error: 'Service name is required' },
        { status: 400 }
      )
    }
    
    if (!serviceData.template_ids || !Array.isArray(serviceData.template_ids) || serviceData.template_ids.length === 0) {
      return NextResponse.json(
        { error: 'At least one template must be selected' },
        { status: 400 }
      )
    }
    
    const result = await ServiceManagementService.createService(serviceData)
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }
    
    const response = {
      success: true,
      service: result.service
    }
    
    if (result.warnings && result.warnings.length > 0) {
      response.warnings = result.warnings
    }
    
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create service' },
      { status: 500 }
    )
  }
}