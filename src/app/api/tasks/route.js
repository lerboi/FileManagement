// src/app/api/tasks/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { TaskManagementService } from '@/lib/services/taskManagementService'
import { TaskWorkflowService } from '@/lib/services/taskWorkflowService'

// GET - Fetch all tasks with filtering and pagination
export async function GET(request) {
  try {
    // Check authentication
    await requireSession()

    const { searchParams } = new URL(request.url)
    
    const options = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
      status: searchParams.get('status') || 'all',
      clientId: searchParams.get('clientId') || null,
      serviceId: searchParams.get('serviceId') || null,
      search: searchParams.get('search') || null,
      sortBy: searchParams.get('sortBy') || 'created_at',
      sortOrder: searchParams.get('sortOrder') || 'desc'
    }

    // Validate pagination parameters
    if (options.page < 1) options.page = 1
    if (options.limit < 1 || options.limit > 100) options.limit = 10

    const result = await TaskManagementService.getAllTasks(options)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tasks: result.tasks,
      pagination: result.pagination,
      filters: {
        status: options.status,
        clientId: options.clientId,
        serviceId: options.serviceId,
        search: options.search
      }
    })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

// POST - Create a new task and automatically generate documents
export async function POST(request) {
  try {
    // Check authentication
    await requireSession()

    const taskData = await request.json()

    // Basic validation
    if (!taskData.client_id) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      )
    }

    if (!taskData.service_id) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      )
    }

    console.log('Creating task with automatic document generation...')

    // Step 1: Create the task
    const createResult = await TaskManagementService.createTask(taskData)

    if (!createResult.success) {
      return NextResponse.json(
        { error: createResult.error },
        { status: 400 }
      )
    }

    const createdTask = createResult.task
    console.log(`Task created successfully: ${createdTask.id}`)

    // Step 2: Automatically generate documents
    let finalTask = createdTask
    let generationWarnings = []
    let documentsGenerated = 0

    try {
      console.log(`Starting automatic document generation for task: ${createdTask.id}`)
      
      const generateResult = await TaskWorkflowService.startDocumentGeneration(createdTask.id)
      
      if (generateResult.success) {
        finalTask = generateResult.task
        documentsGenerated = generateResult.documentsGenerated || 0
        console.log(`Successfully generated ${documentsGenerated} documents for task: ${createdTask.id}`)
        
        if (generateResult.warnings && generateResult.warnings.length > 0) {
          generationWarnings = generateResult.warnings
          console.warn('Document generation warnings:', generationWarnings)
        }
      } else {
        // Document generation failed, but task was created
        console.error('Document generation failed:', generateResult.error)
        generationWarnings.push(`Document generation failed: ${generateResult.error}`)
        
        // Check if it's a partial generation failure
        if (generateResult.partialGeneration && generateResult.task) {
          finalTask = generateResult.task
        }
      }
    } catch (generateError) {
      console.error('Error during automatic document generation:', generateError)
      generationWarnings.push(`Document generation error: ${generateError.message}`)
    }

    // Prepare response
    const response = {
      success: true,
      task: finalTask,
      documentsGenerated,
      message: documentsGenerated > 0 
        ? `Task created successfully and ${documentsGenerated} documents generated automatically`
        : 'Task created successfully, but document generation failed'
    }

    // Add warnings from both task creation and document generation
    const allWarnings = []
    if (createResult.validation && createResult.validation.warnings) {
      allWarnings.push(...createResult.validation.warnings)
    }
    if (generationWarnings.length > 0) {
      allWarnings.push(...generationWarnings)
    }

    if (allWarnings.length > 0) {
      response.warnings = allWarnings
    }

    // Return appropriate status code
    if (documentsGenerated === 0 && generationWarnings.length > 0) {
      // Task created but generation failed - return 207 Multi-Status
      return NextResponse.json(response, { status: 207 })
    } else {
      // Full success
      return NextResponse.json(response, { status: 201 })
    }

  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create task' },
      { status: 500 }
    )
  }
}