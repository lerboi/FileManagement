// src/app/api/clients/[id]/route.js
import { NextResponse } from 'next/server'
import { ClientService } from '@/lib/services/clientService'
import { requireAuth } from '@/lib/auth'

// GET - Fetch a single client by ID
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireAuth()
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      )
    }
    
    const client = await ClientService.getClientById(id)
    
    return NextResponse.json(client, { status: 200 })
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch client' },
      { status: 500 }
    )
  }
}

// PUT - Update a client
export async function PUT(request, { params }) {
  try {
    // Check authentication
    await requireAuth()
    
    const { id } = await params
    const clientData = await request.json()
    
    if (!id) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      )
    }
    
    const updatedClient = await ClientService.updateClient(id, clientData)
    
    return NextResponse.json(updatedClient, { status: 200 })
  } catch (error) {
    console.error('Error updating client:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update client' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a client
export async function DELETE(request, { params }) {
  try {
    // Check authentication
    await requireAuth()
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      )
    }
    
    await ClientService.deleteClient(id)
    
    return NextResponse.json(
      { message: 'Client deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting client:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete client' },
      { status: 500 }
    )
  }
}