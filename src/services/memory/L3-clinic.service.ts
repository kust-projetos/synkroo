/**
 * L3 Clinic Memory Service
 * PostgreSQL-based clinic data with 5-minute cache
 * Provides persistent clinic configuration and metadata
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

// Clinic address structure
export interface L3ClinicAddress {
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zipCode?: string
  formatted?: string
}

// Clinic hours structure
export interface L3ClinicHours {
  dayOfWeek: number
  openTime: string
  closeTime: string
  isAvailable: boolean
}

// Clinic professional structure
export interface L3ClinicProfessional {
  id: string
  name: string
  specialty?: string
  cro?: string
}

// Clinic procedure structure
export interface L3ClinicProcedure {
  id: string
  name: string
  duration?: number
  price?: number
  category?: string
}

// Cancellation policy structure
export interface L3CancellationPolicy {
  advanceNoticeHours: number
  allowCancellation: boolean
  penaltyPercent?: number
}

// L3 Clinic interface
export interface L3Clinic {
  clinicId: string
  nome: string
  telefone: string
  endereco: L3ClinicAddress
  horarios: L3ClinicHours[]
  profissionais: L3ClinicProfessional[]
  procedimentos: L3ClinicProcedure[]
  cancelamentoPolicy: L3CancellationPolicy
}

// Cache entry with TTL
interface CacheEntry<T> {
  data: T
  expiresAt: number
}

// In-memory cache
const clinicCache = new Map<string, CacheEntry<L3Clinic>>()

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000

// Cleanup interval reference
let cleanupInterval: ReturnType<typeof setInterval> | null = null

/**
 * L3 Clinic Service
 * Retrieves clinic data from PostgreSQL with caching
 */
export class L3ClinicService {
  /**
   * Get clinic by ID
   * Uses 5-minute cache to reduce database load
   */
  async getById(clinicId: string): Promise<L3Clinic | null> {
    // Check cache first
    const cached = this.getFromCache(clinicId)
    if (cached) {
      dbLogger.debug('L3 clinic cache hit', { clinicId })
      return cached
    }

    dbLogger.debug('L3 clinic cache miss, fetching from DB', { clinicId })

    try {
      const supabase = await createTypedClient()

      // Get clinic data
      const { data: clinic, error: clinicError } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', clinicId)
        .single() as any

      if (clinicError || !clinic) {
        dbLogger.debug('Clinic not found', { clinicId })
        return null
      }

      // Parse address
      const endereco: L3ClinicAddress = clinic.address
        ? typeof clinic.address === 'string'
          ? JSON.parse(clinic.address)
          : clinic.address
        : {}

      // Get dentists (professionals)
      const { data: dentists } = await supabase
        .from('dentists')
        .select('id, name, specialty, cro')
        .eq('clinic_id', clinicId)
        .eq('is_active', true) as any

      const profissionais: L3ClinicProfessional[] = (dentists || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        specialty: d.specialty,
        cro: d.cro,
      }))

      // Get procedures
      const { data: procedures } = await supabase
        .from('procedures')
        .select('id, name, duration_minutes, price, category')
        .eq('clinic_id', clinicId)
        .eq('is_active', true) as any

      const procedimentos: L3ClinicProcedure[] = (procedures || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        duration: p.duration_minutes,
        price: p.price,
        category: p.category,
      }))

      // Get working hours from schedule_blocks
      const { data: scheduleBlocks } = await supabase
        .from('schedule_blocks')
        .select('day_of_week, start_time, end_time, is_available')
        .eq('clinic_id', clinicId) as any

      const horarios: L3ClinicHours[] = (scheduleBlocks || []).map((b: any) => ({
        dayOfWeek: b.day_of_week,
        openTime: b.start_time,
        closeTime: b.end_time,
        isAvailable: b.is_available,
      }))

      // Parse settings for cancellation policy
      let cancelamentoPolicy: L3CancellationPolicy = {
        advanceNoticeHours: 24,
        allowCancellation: true,
      }

      if (clinic.settings) {
        const settings = typeof clinic.settings === 'string'
          ? JSON.parse(clinic.settings)
          : clinic.settings

        if (settings.cancellationPolicy) {
          cancelamentoPolicy = {
            ...cancelamentoPolicy,
            ...settings.cancellationPolicy,
          }
        }
      }

      const l3Clinic: L3Clinic = {
        clinicId: clinic.id,
        nome: clinic.name,
        telefone: clinic.phone,
        endereco,
        horarios,
        profissionais,
        procedimentos,
        cancelamentoPolicy,
      }

      // Store in cache
      this.setCache(clinicId, l3Clinic)

      return l3Clinic
    } catch (error) {
      dbLogger.error('Error fetching clinic', error, { clinicId })
      return null
    }
  }

  /**
   * Get clinic from cache if not expired
   */
  private getFromCache(clinicId: string): L3Clinic | null {
    const entry = clinicCache.get(clinicId)

    if (!entry) {
      return null
    }

    if (Date.now() > entry.expiresAt) {
      clinicCache.delete(clinicId)
      return null
    }

    return entry.data
  }

  /**
   * Set clinic in cache with TTL
   */
  private setCache(clinicId: string, clinic: L3Clinic): void {
    clinicCache.set(clinicId, {
      data: clinic,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })
  }

  /**
   * Invalidate cache for a clinic
   */
  invalidateCache(clinicId: string): boolean {
    const deleted = clinicCache.delete(clinicId)
    if (deleted) {
      dbLogger.debug('L3 clinic cache invalidated', { clinicId })
    }
    return deleted
  }

  /**
   * Clear entire cache
   */
  clearCache(): number {
    const size = clinicCache.size
    clinicCache.clear()
    dbLogger.info('L3 clinic cache cleared', { entriesCleared: size })
    return size
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    const now = Date.now()
    const validEntries: string[] = []

    for (const [clinicId, entry] of clinicCache.entries()) {
      if (now <= entry.expiresAt) {
        validEntries.push(clinicId)
      }
    }

    return {
      size: validEntries.length,
      entries: validEntries,
    }
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [clinicId, entry] of clinicCache.entries()) {
      if (now > entry.expiresAt) {
        clinicCache.delete(clinicId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      dbLogger.debug('L3 clinic cache cleanup', { cleanedCount: cleaned, remainingCount: clinicCache.size })
    }

    return cleaned
  }

  /**
   * Start periodic cache cleanup
   */
  startCleanupScheduler(intervalMs: number = 60 * 1000): void {
    if (cleanupInterval) {
      return
    }

    cleanupInterval = setInterval(() => {
      this.cleanupCache()
    }, intervalMs)

    dbLogger.info('L3 clinic cache cleanup scheduler started', { intervalMs })
  }

  /**
   * Stop the cleanup scheduler
   */
  stopCleanupScheduler(): void {
    if (cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
      dbLogger.info('L3 clinic cache cleanup scheduler stopped')
    }
  }
}

// Singleton instance
export const l3ClinicService = new L3ClinicService()
