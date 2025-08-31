// src/app/api/services/[id]/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { ServiceManagementService } from '@/lib/services/serviceManagementService'

// GET - Fetch a single service by ID
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireSession()
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const includeTemplateDetails = searchParams.get('includeTemplateDetails') !== 'false'
    
    const service = await ServiceManagementService.getServiceById(id, includeTemplateDetails)
    
    return NextResponse.json(service, { status: 200 })
  } catch (error) {
    console.error('Error fetching service:', error)
    
    if (error.message === 'Service not found') {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch service' },
      { status: 500 }
    )
  }
}

// PUT - Update a service
export async function PUT(request, { params }) {
  try {
    // Check authentication
    await requireSession()
    
    const { id } = await params
    const updates = await request.json()
    
    if (!id) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      )
    }
    
    const result = await ServiceManagementService.updateService(id, updates)
    
    if (!result.success) {
      if (result.error === 'Service not found') {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        )
      }
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
    
    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update service' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a service
export async function DELETE(request, { params }) {
  try {
    // Check authentication
    await requireSession()
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      )
    }
    
    const result = await ServiceManagementService.deleteService(id)
    
    if (!result.success) {
      if (result.error === 'Service not found') {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Service deleted successfully',
      deletedService: result.deletedService
    }, { status: 200 })
  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete service' },
      { status: 500 }
    )
  }
}