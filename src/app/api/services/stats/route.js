// src/app/api/services/stats/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ServiceManagementService } from '@/lib/services/serviceManagementService'

// GET - Get service statistics
export async function GET(request) {
  try {
    // Check authentication
    await requireAuth()
    
    const stats = await ServiceManagementService.getServiceStatistics()
    
    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('Error fetching service statistics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch service statistics' },
      { status: 500 }
    )
  }
}