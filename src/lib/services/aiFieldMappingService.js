// src/lib/services/aiFieldMappingService.js
import { Mistral } from "@mistralai/mistralai";

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY
})

export class AIFieldMappingService {
  
  // Database schema for reference
  static clientSchema = {
    id: { type: 'uuid', description: 'Unique client identifier' },
    first_name: { type: 'string', description: 'Client first name' },
    last_name: { type: 'string', description: 'Client last name' },
    email: { type: 'string', description: 'Client email address' },
    phone: { type: 'string', description: 'Client phone number' },
    address_line_1: { type: 'string', description: 'Primary address line' },
    address_line_2: { type: 'string', description: 'Secondary address line' },
    city: { type: 'string', description: 'City name' },
    state: { type: 'string', description: 'State or province' },
    postal_code: { type: 'string', description: 'Postal or ZIP code' },
    country: { type: 'string', description: 'Country name' },
    date_of_birth: { type: 'date', description: 'Client date of birth' },
    occupation: { type: 'string', description: 'Client job title or profession' },
    company: { type: 'string', description: 'Client employer or company' },
    notes: { type: 'text', description: 'Additional notes about client' },
    status: { type: 'string', description: 'Client status (active, inactive, prospect)' },
    client_type: { type: 'string', description: 'Type of client (individual, corporate, trust)' }
  }

  // Computed fields that can be derived
  static computedFields = {
    full_name: { 
      formula: 'first_name + " " + last_name',
      description: 'Full client name'
    },
    full_address: {
      formula: 'address_line_1 + ", " + city + " " + postal_code',
      description: 'Complete formatted address'
    },
    current_date: {
      formula: 'new Date().toLocaleDateString()',
      description: 'Current date'
    },
    current_year: {
      formula: 'new Date().getFullYear()',
      description: 'Current year'
    }
  }

  // Main method to analyze document and suggest field mappings
  static async analyzeAndSuggestMappings(documentContent, documentType = 'legal') {
    try {
      // 1. Extract potential placeholders from document
      const placeholders = this.extractPlaceholders(documentContent)
      
      // 2. Use Mistral AI to analyze and suggest mappings
      const mistralSuggestions = await this.getMistralSuggestions(
        documentContent, 
        placeholders, 
        documentType
      )
      
      // 3. Apply rule-based matching for high-confidence cases
      const ruleBased = this.applyRuleBasedMatching(placeholders)
      
      // 4. Combine and rank suggestions
      const combinedSuggestions = this.combineAndRankSuggestions(
        mistralSuggestions, 
        ruleBased
      )
      
      return {
        success: true,
        placeholders: placeholders,
        suggestions: combinedSuggestions,
        confidence: this.calculateOverallConfidence(combinedSuggestions),
        autoMappable: combinedSuggestions.filter(s => s.confidence > 0.8).length
      }
      
    } catch (error) {
      console.error('Error in Mistral AI field mapping analysis:', error)
      return {
        success: false,
        error: error.message,
        placeholders: [],
        suggestions: []
      }
    }
  }

  // Extract placeholders from document ({{field_name}} format)
  static extractPlaceholders(content) {
    const placeholderRegex = /\{\{([^}]+)\}\}/g
    const matches = []
    let match
    
    while ((match = placeholderRegex.exec(content)) !== null) {
      const placeholder = match[1].trim()
      const context = this.getPlaceholderContext(content, match.index)
      
      matches.push({
        placeholder,
        fullMatch: match[0],
        position: match.index,
        context,
        contextBefore: content.substring(Math.max(0, match.index - 50), match.index),
        contextAfter: content.substring(match.index + match[0].length, match.index + match[0].length + 50)
      })
    }
    
    return matches
  }

  // Get surrounding context for a placeholder
  static getPlaceholderContext(content, position) {
    const start = Math.max(0, position - 100)
    const end = Math.min(content.length, position + 100)
    return content.substring(start, end)
  }

  // Use Mistral AI to analyze document and suggest mappings
  static async getMistralSuggestions(documentContent, placeholders, documentType) {
    if (placeholders.length === 0) {
      return []
    }

    const systemPrompt = `You are an expert at analyzing legal and business documents to map placeholder fields to database columns.

Available database fields:
${Object.entries(this.clientSchema).map(([field, info]) => 
  `- ${field}: ${info.description}`
).join('\n')}

Available computed fields:
${Object.entries(this.computedFields).map(([field, info]) => 
  `- ${field}: ${info.description} (${info.formula})`
).join('\n')}

Document type: ${documentType}

For each placeholder, suggest the most appropriate database field mapping with a confidence score (0-1).
Consider context, common legal document patterns, and semantic meaning.

You MUST respond with a valid JSON array in this exact format:
[
  {
    "placeholder": "client_name",
    "suggestedField": "full_name",
    "confidence": 0.95,
    "reasoning": "Context indicates this needs the complete client name"
  }
]

Return ONLY the JSON array, no other text.`

    const userPrompt = `Analyze this document and suggest field mappings:

Placeholders found:
${placeholders.map(p => `- ${p.placeholder} (context: "${p.context}")`).join('\n')}

Provide mapping suggestions for each placeholder as a JSON array.`

    try {
      const response = await mistral.chat.complete({
        model: "mistral-large-latest",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        console.warn('No response from Mistral AI')
        return []
      }

      // Try to parse JSON from Mistral's response
      let parsed
      try {
        // Clean the response to extract JSON
        const cleanedContent = content.trim()
        
        // Try direct parsing first
        if (cleanedContent.startsWith('[')) {
          parsed = JSON.parse(cleanedContent)
        } else {
          // Try to extract JSON array from the response
          const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0])
          } else {
            console.warn('Could not extract JSON from Mistral AI response')
            return []
          }
        }
      } catch (parseError) {
        console.error('Error parsing Mistral AI response:', parseError)
        console.log('Raw response:', content)
        return []
      }

      // Validate and return the parsed suggestions
      if (Array.isArray(parsed)) {
        return parsed.filter(suggestion => 
          suggestion.placeholder && 
          suggestion.suggestedField && 
          typeof suggestion.confidence === 'number'
        )
      } else if (parsed.mappings && Array.isArray(parsed.mappings)) {
        return parsed.mappings.filter(suggestion => 
          suggestion.placeholder && 
          suggestion.suggestedField && 
          typeof suggestion.confidence === 'number'
        )
      } else {
        console.warn('Unexpected Mistral AI response format')
        return []
      }
      
    } catch (error) {
      console.error('Mistral AI suggestion error:', error)
      return []
    }
  }

  // Apply rule-based matching for common patterns
  static applyRuleBasedMatching(placeholders) {
    const rules = [
      // Exact matches - high confidence
      { pattern: /^(client_?name|full_?name|name)$/i, field: 'full_name', confidence: 0.9 },
      { pattern: /^(first_?name|fname)$/i, field: 'first_name', confidence: 0.95 },
      { pattern: /^(last_?name|surname|lname)$/i, field: 'last_name', confidence: 0.95 },
      { pattern: /^(email|email_?address|e_?mail)$/i, field: 'email', confidence: 0.95 },
      { pattern: /^(phone|telephone|tel|phone_?number)$/i, field: 'phone', confidence: 0.9 },
      { pattern: /^(address|client_?address)$/i, field: 'address_line_1', confidence: 0.8 },
      { pattern: /^(city|client_?city)$/i, field: 'city', confidence: 0.9 },
      { pattern: /^(postal_?code|zip|zipcode)$/i, field: 'postal_code', confidence: 0.9 },
      { pattern: /^(occupation|job|profession|work)$/i, field: 'occupation', confidence: 0.85 },
      { pattern: /^(company|employer|organization)$/i, field: 'company', confidence: 0.85 },
      { pattern: /^(current_?date|today|date)$/i, field: 'current_date', confidence: 0.9 },
      { pattern: /^(current_?year|year)$/i, field: 'current_year', confidence: 0.9 },
      
      // Contextual matches - medium confidence
      { pattern: /client.*name/i, field: 'full_name', confidence: 0.8 },
      { pattern: /beneficiary.*name/i, field: 'full_name', confidence: 0.8 },
      { pattern: /contact.*email/i, field: 'email', confidence: 0.8 },
      { pattern: /contact.*phone/i, field: 'phone', confidence: 0.8 }
    ]

    const suggestions = []
    
    placeholders.forEach(placeholder => {
      for (const rule of rules) {
        if (rule.pattern.test(placeholder.placeholder)) {
          suggestions.push({
            placeholder: placeholder.placeholder,
            suggestedField: rule.field,
            confidence: rule.confidence,
            reasoning: `Rule-based match: "${placeholder.placeholder}" matches pattern for ${rule.field}`,
            source: 'rule-based'
          })
          break // Use first matching rule
        }
      }
    })
    
    return suggestions
  }

  // Combine Mistral AI and rule-based suggestions
  static combineAndRankSuggestions(mistralSuggestions, ruleBasedSuggestions) {
    const combined = {}
    
    // Add rule-based suggestions first
    ruleBasedSuggestions.forEach(suggestion => {
      combined[suggestion.placeholder] = suggestion
    })
    
    // Add or enhance with Mistral AI suggestions
    mistralSuggestions.forEach(suggestion => {
      const existing = combined[suggestion.placeholder]
      
      // Use Mistral suggestion if it has higher confidence or if no existing suggestion
      if (!existing || suggestion.confidence > existing.confidence) {
        combined[suggestion.placeholder] = {
          ...suggestion,
          source: existing ? 'mistral-enhanced' : 'mistral'
        }
      }
    })
    
    // Convert to array and sort by confidence (highest first)
    return Object.values(combined)
      .sort((a, b) => b.confidence - a.confidence)
  }

  // Calculate overall mapping confidence
  static calculateOverallConfidence(suggestions) {
    if (suggestions.length === 0) return 0
    
    const totalConfidence = suggestions.reduce((sum, s) => sum + (s.confidence || 0), 0)
    return totalConfidence / suggestions.length
  }

  // Auto-apply high-confidence mappings
  static autoApplyMappings(suggestions, confidenceThreshold = 0.8) {
    const autoMappings = {}
    const manualReview = []
    
    suggestions.forEach(suggestion => {
      if (suggestion.confidence >= confidenceThreshold) {
        autoMappings[suggestion.placeholder] = suggestion.suggestedField
      } else {
        manualReview.push(suggestion)
      }
    })
    
    return {
      autoMappings,
      manualReview,
      autoMappedCount: Object.keys(autoMappings).length,
      manualReviewCount: manualReview.length
    }
  }

  // Generate template with suggested mappings applied
  static applyMappingsToTemplate(documentContent, mappings) {
    let processedContent = documentContent
    
    Object.entries(mappings).forEach(([placeholder, field]) => {
      const placeholderPattern = new RegExp(`\\{\\{\\s*${this.escapeRegExp(placeholder)}\\s*\\}\\}`, 'g')
      processedContent = processedContent.replace(placeholderPattern, `{{${field}}}`)
    })
    
    return processedContent
  }

  // Utility function to escape regex special characters
  static escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}