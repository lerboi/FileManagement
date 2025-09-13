// src/lib/utils/clientFields.js

// Standard client fields from the clients table
export const CLIENT_FIELDS = [
  'first_name',
  'last_name', 
  'email',
  'phone',
  'address_line_1',
  'address_line_2',
  'city',
  'state',
  'postal_code',
  'country',
  'date_of_birth',
  'occupation',
  'company',
  'notes',
  'status',
  'client_type',
  // Computed fields
  'full_name',
  'full_address',
  // System fields
  'current_date',
  'current_year'
]

// Check if a field name is a client field
export function isClientField(fieldName) {
  return CLIENT_FIELDS.includes(fieldName)
}

// Filter placeholders to get only custom (non-client) fields
export function getCustomPlaceholders(detectedPlaceholders = []) {
  return detectedPlaceholders
    .filter(placeholder => !isClientField(placeholder.name))
    .map(placeholder => ({
      name: placeholder.name,
      label: placeholder.field?.label || formatFieldLabel(placeholder.name),
      type: 'text', // Default all to text
      required: true,
      category: placeholder.field?.category || 'document',
      description: placeholder.field?.description || `Value for ${placeholder.name} placeholder`
    }))
}

// Format field name to readable label
function formatFieldLabel(fieldName) {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

// Get client fields that are present in detected placeholders
export function getClientPlaceholders(detectedPlaceholders = []) {
  return detectedPlaceholders
    .filter(placeholder => isClientField(placeholder.name))
    .map(placeholder => ({
      name: placeholder.name,
      label: placeholder.field?.label || formatFieldLabel(placeholder.name),
      category: 'client'
    }))
}

