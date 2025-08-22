// src/app/api/clients/route.js
import { NextResponse } from 'next/server'
import { ClientService } from '@/lib/services/clientService'
import { requireAuth } from '@/lib/auth'

// GET - Fetch all clients with pagination and search
export async function GET(request) {
  try {
    // Check authentication
    await requireAuth()
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 10
    const search = searchParams.get('search') || ''
    
    const result = await ClientService.getAllClients(page, limit, search)
    
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch clients' },
      { status: 500 }
    )
  }
}

// POST - Create a new client
export async function POST(request) {
  try {
    // Check authentication
    await requireAuth()
    
    const clientData = await request.json()
    
    // Basic validation
    if (!clientData.first_name || !clientData.last_name) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      )
    }
    
    const newClient = await ClientService.createClient(clientData)
    
    return NextResponse.json(newClient, { status: 201 })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create client' },
      { status: 500 }
    )
  }
}