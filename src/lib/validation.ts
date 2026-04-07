/**
 * Input Validation Helpers
 * Reusable validation functions for API endpoints
 */

import { ValidationError } from './errors'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface FieldValidation {
  field: string
  value: unknown
  rules: ValidationRule[]
}

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'phone' | 'cpf' | 'uuid' | 'enum' | 'min' | 'max'
  value?: unknown
  message?: string
}

// Brazilian phone regex: accepts 10 or 11 digits, with or without country code
const PHONE_REGEX = /^(?:\+?55)?(?:\(?[1-9][0-9]\)?\s?)?(?:9[0-9]{4}|[2-8][0-9]{3})-?[0-9]{4}$/

// CPF regex: accepts formatted or unformatted
const CPF_REGEX = /^(\d{3}\.?\d{3}\.?\d{3}-?\d{2})$/

// Email regex (simplified but covers most cases)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// UUID regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Validate a single field
 */
export function validateField(field: string, value: unknown, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    const error = applyRule(field, value, rule)
    if (error) return error
  }
  return null
}

function applyRule(field: string, value: unknown, rule: ValidationRule): string | null {
  const fieldName = field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')

  switch (rule.type) {
    case 'required':
      if (value === undefined || value === null || value === '') {
        return rule.message || `${fieldName} is required`
      }
      break

    case 'minLength':
      if (typeof value === 'string' && value.length < (rule.value as number)) {
        return rule.message || `${fieldName} must be at least ${rule.value} characters`
      }
      break

    case 'maxLength':
      if (typeof value === 'string' && value.length > (rule.value as number)) {
        return rule.message || `${fieldName} must be at most ${rule.value} characters`
      }
      break

    case 'min':
      if (typeof value === 'number' && value < (rule.value as number)) {
        return rule.message || `${fieldName} must be at least ${rule.value}`
      }
      break

    case 'max':
      if (typeof value === 'number' && value > (rule.value as number)) {
        return rule.message || `${fieldName} must be at most ${rule.value}`
      }
      break

    case 'pattern':
      if (typeof value === 'string' && !(rule.value as RegExp).test(value)) {
        return rule.message || `${fieldName} has invalid format`
      }
      break

    case 'email':
      if (typeof value === 'string' && value && !EMAIL_REGEX.test(value)) {
        return rule.message || `${fieldName} must be a valid email`
      }
      break

    case 'phone':
      if (typeof value === 'string' && value && !PHONE_REGEX.test(value.replace(/\s/g, ''))) {
        return rule.message || `${fieldName} must be a valid Brazilian phone number`
      }
      break

    case 'cpf':
      if (typeof value === 'string' && value && !CPF_REGEX.test(value)) {
        return rule.message || `${fieldName} must be a valid CPF`
      }
      // Also validate CPF check digits
      if (typeof value === 'string' && value && !validateCPFCheckDigits(value)) {
        return rule.message || `${fieldName} must be a valid CPF`
      }
      break

    case 'uuid':
      if (typeof value === 'string' && value && !UUID_REGEX.test(value)) {
        return rule.message || `${fieldName} must be a valid UUID`
      }
      break

    case 'enum':
      if (!Array.isArray(rule.value) || !rule.value.includes(value)) {
        return rule.message || `${fieldName} must be one of: ${Array.isArray(rule.value) ? rule.value.join(', ') : rule.value}`
      }
      break
  }

  return null
}

/**
 * Validate CPF check digits
 */
function validateCPFCheckDigits(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '')
  if (cleaned.length !== 11) return false

  // Check for all same digits
  if (/^(\d)\1{10}$/.test(cleaned)) return false

  // Validate first check digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i)
  }
  let remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== parseInt(cleaned[9])) return false

  // Validate second check digit
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== parseInt(cleaned[10])) return false

  return true
}

/**
 * Validate multiple fields at once
 * Throws ValidationError if any field is invalid
 */
export function validateFields(fields: FieldValidation[]): void {
  const errors: string[] = []

  for (const { field, value, rules } of fields) {
    const error = validateField(field, value, rules)
    if (error) {
      errors.push(error)
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors[0], { allErrors: errors })
  }
}

/**
 * Validate request body exists
 */
export function requireBody<T>(body: T | null | undefined): T {
  if (!body) {
    throw new ValidationError('Request body is required')
  }
  return body
}

/**
 * Validate required fields in an object
 */
export function requireFields<T extends Record<string, unknown>>(
  obj: T | null | undefined,
  fields: string[]
): T {
  if (!obj) {
    throw new ValidationError('Request body is required')
  }

  const missing = fields.filter(f => obj[f] === undefined || obj[f] === null || obj[f] === '')
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`)
  }

  return obj
}

/**
 * Sanitize phone number (remove formatting)
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * Sanitize CPF (remove formatting)
 */
export function sanitizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

/**
 * Format phone number for display
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

/**
 * Format CPF for display
 */
export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`
  }
  return cpf
}