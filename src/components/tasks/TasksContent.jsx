// src/components/tasks/TasksContent.jsx
'use client'

import { useState, useEffect } from 'react'
import TaskCard from './TaskCard'
import TaskCreationModal from './TaskCreationModal'
import TaskDetailModal from './TaskDetailModal'

export default function TasksContent() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilters, setStatusFilters] = useState({
    in_progress: true,
    awaiting: true,
    completed: false
  })
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [generating, setGenerating] = useState(false)
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [editingDraft, setEditingDraft] = useState(null)

  const limit = 10 // Tasks per page

  // Fetch tasks from API
  useEffect(() => {
    fetchTasks()
  }, [currentPage, searchTerm, statusFilters, sortBy, sortOrder, showCompletedTasks])

  const fetchTasks = async () => {
    setLoading(true)
    setError('')
    
    try {
      // Build status filter array from checkboxes
      const activeStatuses = Object.keys(statusFilters).filter(status => statusFilters[status])
      const statusParam = showCompletedTasks ? 'completed' : activeStatuses.join(',')
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        status: statusParam,
        search: searchTerm,
        sortBy,
        sortOrder
      })

      const response = await fetch(`/api/tasks?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch tasks')
      }
      
      const data = await response.json()
      
      if (data.success) {
        setTasks(data.tasks || [])
        setPagination(data.pagination)
      } else {
        throw new Error(data.error || 'Failed to fetch tasks')
      }
    } catch (error) {
      setError(error.message)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1) // Reset to first page when searching
  }

  const handleStatusFilterChange = (status) => {
    setStatusFilters(prev => ({
      ...prev,
      [status]: !prev[status]
    }))
    setShowCompletedTasks(false)
    setCurrentPage(1)
  }

  const handleCreateTask = () => {
    setEditingDraft(null) // Clear any existing draft
    setShowCreateModal(true)
  }

  const handleTaskCreated = async (newTask) => {
    try {
      // Set generating state
      setGenerating(true)
      
      // Automatically generate documents for the new task
      const generateResponse = await fetch(`/api/tasks/${newTask.id}/generate`, {
        method: 'POST'
      })

      let generatedTask = newTask
      
      if (generateResponse.ok) {
        const generateData = await generateResponse.json()
        if (generateData.success) {
          generatedTask = generateData.task
          showSuccessMessage(`Task created and ${generateData.documentsGenerated} documents generated successfully!`)
        } else {
          console.error('Document generation failed:', generateData.error)
          showWarningMessage(`Task created successfully, but document generation failed: ${generateData.error}`)
        }
      } else {
        console.error('Document generation request failed')
        showWarningMessage('Task created successfully, but document generation failed')
      }
      
      // Update tasks list with the generated task
      setTasks(prev => [generatedTask, ...prev.slice(1)]) // Replace first item (optimistic update)
      
      // Open the task detail modal automatically
      setSelectedTask(generatedTask)
      setShowDetailModal(true)
      
    } catch (error) {
      console.error('Error during task creation flow:', error)
      showWarningMessage('Task created successfully, but there was an issue with document generation')
      
      // Still open the detail modal with the original task
      setSelectedTask(newTask)
      setShowDetailModal(true)
    } finally {
      setGenerating(false)
      // Refresh the full tasks list to ensure consistency
      setTimeout(() => {
        fetchTasks()
      }, 1000)
    }
  }

  const handleTaskUpdated = (updatedTask) => {
    // Update the specific task in the tasks array
    setTasks(prev => prev.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ))
    
    // Update the selected task if it's the same one
    if (selectedTask && selectedTask.id === updatedTask.id) {
      setSelectedTask(updatedTask)
    }
  }

  const showSuccessMessage = (message) => {
    const successDiv = document.createElement('div')
    successDiv.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50'
    successDiv.textContent = message
    document.body.appendChild(successDiv)
    
    setTimeout(() => {
      if (document.body.contains(successDiv)) {
        document.body.removeChild(successDiv)
      }
    }, 5000) // Show for 5 seconds for longer messages
  }

  const showWarningMessage = (message) => {
    const warningDiv = document.createElement('div')
    warningDiv.className = 'fixed top-4 right-4 bg-yellow-600 text-white px-4 py-2 rounded shadow-lg z-50'
    warningDiv.textContent = message
    document.body.appendChild(warningDiv)
    
    setTimeout(() => {
      if (document.body.contains(warningDiv)) {
        document.body.removeChild(warningDiv)
      }
    }, 5000)
  }

  const handleDeleteTask = (task) => {
    setTaskToDelete(task)
    setShowDeleteModal(true)
  }

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/tasks/${taskToDelete.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete task')
      }

      // Remove task from state
      setTasks(prev => prev.filter(t => t.id !== taskToDelete.id))
      
      // Show success message
      showSuccessMessage(`Task "${taskToDelete.service_name}" for ${taskToDelete.client_name} deleted successfully`)
      
      // Log file deletion summary
      if (data.fileDeletionSummary) {
        console.log('Files deleted:', data.fileDeletionSummary)
      }

    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete task: ' + error.message)
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
      setTaskToDelete(null)
    }
  }

  const handleViewCompletedTasks = () => {
    setShowCompletedTasks(true)
    setCurrentPage(1)
  }

  const handleBackToActiveTasks = () => {
    setShowCompletedTasks(false)
    setCurrentPage(1)
  }

  const handleEditDraft = (draftTask) => {
    setEditingDraft(draftTask)
    setShowCreateModal(true)
  }

  const handleViewTask = (task) => {
    // Only open detail modal for non-draft tasks
    if (!task.is_draft) {
      setSelectedTask(task)
      setShowDetailModal(true)
    }
  }

  // Stats calculation from actual tasks data
  const stats = [
    {
      name: 'Total Tasks',
      value: pagination?.total || 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      color: 'text-gray-600'
    },
    {
      name: 'Drafts',
      value: tasks.filter(t => t.status === 'in_progress').length,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-purple-600'
    },
    {
      name: 'Awaiting',
      value: tasks.filter(t => t.status === 'awaiting').length,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-yellow-600'
    },
    {
      name: 'Completed',
      value: '-',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-green-600'
    }
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {showCompletedTasks ? 'Completed Tasks' : 'Tasks'}
          </h1>
          <p className="text-gray-600">
            {showCompletedTasks 
              ? 'View and manage completed task records'
              : 'Manage document generation and distribution workflows'
            }
          </p>
          {showCompletedTasks && (
            <button
              onClick={handleBackToActiveTasks}
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mt-2"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Active Tasks
            </button>
          )}
        </div>
        {!showCompletedTasks && (
          <button
            onClick={handleCreateTask}
            disabled={generating}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Task
              </>
            )}
          </button>
        )}
      </div>

      {/* Document Generation Status - Show when generating */}
      {generating && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="text-blue-800">
              <p className="font-medium">Generating Documents</p>
              <p className="text-sm">Creating task and generating documents automatically...</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`p-2 bg-gray-100 rounded-lg ${stat.color}`}>
                  {stat.icon}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">{stat.name}</p>
              {stat.name === 'Completed' && !showCompletedTasks && (
                <button
                  onClick={handleViewCompletedTasks}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  View All
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search tasks by service, client, or notes..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Filter Button */}
            {!showCompletedTasks ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowFilterModal(true)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 2v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                  </svg>
                  Status Filters
                  {Object.values(statusFilters).filter(Boolean).length < 3 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {Object.values(statusFilters).filter(Boolean).length}
                    </span>
                  )}
                </button>
              </div>
            ) : (
              <div className="lg:w-48">
                <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm text-gray-700">
                  Showing: Completed Tasks
                </div>
              </div>
            )}
            
            {/* Sort */}
            <div className="lg:w-48">
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-')
                  setSortBy(field)
                  setSortOrder(order)
                  setCurrentPage(1)
                }}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="created_at-desc">Newest First</option>
                <option value="created_at-asc">Oldest First</option>
                <option value="client_name-asc">Client A-Z</option>
                <option value="client_name-desc">Client Z-A</option>
                <option value="service_name-asc">Service A-Z</option>
                <option value="status-asc">Status</option>
                <option value="priority-desc">Priority</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-lg shadow-sm border">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading tasks...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <div className="text-red-600 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Tasks</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchTasks}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No tasks found</h3>
            <p className="mt-1 text-sm text-gray-600">
              {searchTerm || Object.values(statusFilters).some(v => v !== (statusFilters.in_progress || statusFilters.awaiting))
                ? 'Try adjusting your search or filter criteria.' 
                : 'Get started by creating your first task.'
              }
            </p>
            {!searchTerm && statusFilters.in_progress && statusFilters.awaiting && !statusFilters.completed && (
              <div className="mt-6">
                <button
                  onClick={handleCreateTask}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Your First Task
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={{ ...task, is_draft: task.is_draft }}
                onView={handleViewTask}
                onEditDraft={handleEditDraft}
                onRetry={(task) => console.log('Retry task:', task)}
                onDownload={(task) => console.log('Download task:', task)}
                onDelete={handleDeleteTask}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing page <span className="font-medium">{pagination.page}</span> of{' '}
              <span className="font-medium">{pagination.totalPages}</span>{' '}
              (<span className="font-medium">{pagination.total}</span> total tasks)
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || loading}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            {/* Page numbers */}
            <div className="flex space-x-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const pageNum = i + 1
                const isActive = pageNum === currentPage
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    disabled={loading}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-50 border border-gray-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              
              {pagination.totalPages > 5 && (
                <>
                  <span className="px-2 py-2 text-gray-500">...</span>
                  <button
                    onClick={() => setCurrentPage(pagination.totalPages)}
                    disabled={currentPage === pagination.totalPages || loading}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    {pagination.totalPages}
                  </button>
                </>
              )}
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.totalPages))}
              disabled={currentPage === pagination.totalPages || loading}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      <TaskCreationModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setEditingDraft(null) // Clear editing draft when modal closes
        }}
        onTaskCreated={handleTaskCreated}
        editingDraft={editingDraft}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        task={selectedTask}
        onTaskUpdated={handleTaskUpdated}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && taskToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Delete Task</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-2">
                Are you sure you want to delete this task?
              </p>
              <div className="bg-gray-50 rounded-md p-3 mb-3">
                <p className="text-sm font-medium text-gray-900">{taskToDelete.service_name}</p>
                <p className="text-sm text-gray-600">Client: {taskToDelete.client_name}</p>
                <p className="text-xs text-gray-500">
                  Created: {new Date(taskToDelete.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-red-800">
                    <p className="font-medium">This action cannot be undone</p>
                    <p>This will permanently delete:</p>
                    <ul className="list-disc list-inside mt-1 text-xs">
                      <li>The task record and all its data</li>
                      <li>All generated documents</li>
                      <li>All uploaded signed documents</li>
                      <li>All additional files</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setTaskToDelete(null)
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteTask}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400 flex items-center justify-center"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete Task'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Status Filters</h3>
              <button
                onClick={() => setShowFilterModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">Select which task statuses to display:</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-900">In Progress</span>
                  </div>
                  <input
                    id="modal-filter-in-progress"
                    type="checkbox"
                    checked={statusFilters.in_progress}
                    onChange={() => handleStatusFilterChange('in_progress')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-900">Awaiting</span>
                  </div>
                  <input
                    id="modal-filter-awaiting"
                    type="checkbox"
                    checked={statusFilters.awaiting}
                    onChange={() => handleStatusFilterChange('awaiting')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-900">Completed</span>
                  </div>
                  <input
                    id="modal-filter-completed"
                    type="checkbox"
                    checked={statusFilters.completed}
                    onChange={() => handleStatusFilterChange('completed')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-2 border-t border-gray-200">
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setStatusFilters({ in_progress: true, awaiting: true, completed: false })
                      setCurrentPage(1)
                    }}
                    className="flex-1 px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                  >
                    Active Only
                  </button>
                  <button
                    onClick={() => {
                      setStatusFilters({ in_progress: true, awaiting: true, completed: true })
                      setCurrentPage(1)
                    }}
                    className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100"
                  >
                    Show All
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-600">
                {Object.values(statusFilters).filter(Boolean).length} status{Object.values(statusFilters).filter(Boolean).length !== 1 ? 'es' : ''} selected
              </span>
              <button
                onClick={() => setShowFilterModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}