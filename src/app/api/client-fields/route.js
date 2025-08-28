// CREATE NEW FILE: src/app/api/client-fields/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ClientFieldsService } from '@/lib/services/clientFieldsService'

// GET - Get client table columns and cache status
export async function GET(request) {
  try {
    // Check authentication
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const includeColumns = searchParams.get('includeColumns') !== 'false'
    const cacheOnly = searchParams.get('cacheOnly') === 'true'

    let columns = null
    let cacheStatus = ClientFieldsService.getCacheStatus()

    if (includeColumns && !cacheOnly) {
      const columnsResult = await ClientFieldsService.getClientTableColumns()
      columns = columnsResult.success ? columnsResult.columns : null
      
      // Update cache status after fetch
      cacheStatus = ClientFieldsService.getCacheStatus()
    }

    return NextResponse.json({
      success: true,
      cacheStatus: {
        ...cacheStatus,
        ageMinutes: cacheStatus.age ? Math.round(cacheStatus.age / (1000 * 60)) : null
      },
      columns: columns
    })
  } catch (error) {
    console.error('Error in client fields API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch client fields information' },
      { status: 500 }
    )
  }
}

// POST - Refresh client fields cache
export async function POST(request) {
  try {
    // Check authentication
    await requireAuth()

    const { action } = await request.json()

    if (action === 'clearCache') {
      ClientFieldsService.clearCache()
      return NextResponse.json({
        success: true,
        message: 'Client fields cache cleared successfully'
      })
    }

    if (action === 'refreshCache') {
      // Clear cache and fetch fresh data
      ClientFieldsService.clearCache()
      const columnsResult = await ClientFieldsService.getClientTableColumns()
      
      return NextResponse.json({
        success: columnsResult.success,
        message: columnsResult.success 
          ? `Cache refreshed with ${columnsResult.columns.length} columns` 
          : 'Failed to refresh cache',
        columns: columnsResult.columns,
        cacheStatus: ClientFieldsService.getCacheStatus(),
        error: columnsResult.error
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "clearCache" or "refreshCache"' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in client fields POST:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process client fields request' },
      { status: 500 }
    )
  }
}

// DELETE - Clear cache
export async function DELETE(request) {
  try {
    // Check authentication
    await requireAuth()

    ClientFieldsService.clearCache()
    
    return NextResponse.json({
      success: true,
      message: 'Client fields cache cleared successfully'
    })
  } catch (error) {
    console.error('Error clearing client fields cache:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to clear cache' },
      { status: 500 }
    )
  }
}