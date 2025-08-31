// CREATE NEW FILE: src/app/api/tasks/[id]/signed-status/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { SignedDocumentStorageService } from '@/lib/services/signedDocumentStorageService'

// GET - Check signed document status for all templates in a task
export async function GET(request, { params }) {
  try {
    await requireSession()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    // Get task to find template IDs
    const { TaskManagementService } = await import('@/lib/services/taskManagementService')
    const taskResult = await TaskManagementService.getTaskById(id, false)
    
    if (!taskResult.success) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const task = taskResult.task
    const templateIds = task.template_ids || []
    const generatedDocs = task.generated_documents || []
    
    // Check signed document status for each generated document
    const signedStatus = {}
    
    for (const doc of generatedDocs.filter(d => d.status === 'generated')) {
      const checkResult = await SignedDocumentStorageService.checkSignedDocumentExists(id, doc.templateId)
      
      if (checkResult.exists && checkResult.files.length > 0) {
        const file = checkResult.files[0]
        const downloadUrl = await SignedDocumentStorageService.getSignedDocumentUrl(id, doc.templateId, file.name)
        
        signedStatus[doc.templateId] = {
          exists: true,
          fileName: file.name,
          downloadUrl,
          uploadedAt: file.updated_at || file.created_at,
          fileSize: file.metadata?.size
        }
      } else {
        signedStatus[doc.templateId] = {
          exists: false
        }
      }
    }

    return NextResponse.json({
      success: true,
      taskId: id,
      signedStatus
    })
  } catch (error) {
    console.error('Error checking signed document status:', error)
    return NextResponse.json({ error: error.message || 'Failed to check signed document status' }, { status: 500 })
  }
}