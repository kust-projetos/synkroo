'use client'

import { useAuth } from '@/lib/auth/context'
import { useQueryClient } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BuildingOfficeIcon } from '@heroicons/react/24/outline'

export interface ClinicOption {
  id: string
  name: string
  role?: string
}

export interface ClinicSelectorProps {
  clinics?: ClinicOption[]
  className?: string
}

export function ClinicSelector({ clinics: propClinics, className }: ClinicSelectorProps) {
  const { profile, switchClinic } = useAuth()
  const queryClient = useQueryClient()

  const availableClinics = propClinics ?? profile?.available_clinics?.map((clinic) => ({
    id: clinic.id,
    name: clinic.name,
    role: clinic.role,
  })) ?? (profile?.clinics ? [{ id: profile.clinic_id, name: profile.clinics.name, role: profile.role }] : [])

  // F4.09: hidden for single clinic or empty
  if (availableClinics.length <= 1) {
    return null
  }

  const currentClinicId = profile?.clinic_id || availableClinics[0]?.id

  return (
    <div className={className} data-testid="clinic-selector">
      <Select
        value={currentClinicId}
        onValueChange={async (clinicId) => {
          if (clinicId && clinicId !== currentClinicId) {
            await switchClinic(clinicId)
            queryClient.invalidateQueries()
          }
        }}
      >
        <SelectTrigger className="w-[200px] h-8 text-xs" data-testid="clinic-selector-trigger">
          <BuildingOfficeIcon className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="Selecionar clínica" />
        </SelectTrigger>
        <SelectContent>
          {availableClinics.map((clinic) => (
            <SelectItem key={clinic.id} value={clinic.id} className="text-xs" data-testid={`clinic-option-${clinic.id}`}>
              <span className="font-medium">{clinic.name}</span>
              {clinic.role && (
                <span className="ml-1.5 text-[10px] text-muted-foreground capitalize">
                  ({clinic.role})
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
