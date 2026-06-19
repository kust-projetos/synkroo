import type { InferSelectModel } from 'drizzle-orm'
import { appointments } from './schema/appointments'
import { patients } from './schema/core'
import { appointmentStatus } from './schema/enums'

export type Patient = InferSelectModel<typeof patients>
export type Appointment = InferSelectModel<typeof appointments>
export type AppointmentStatus = (typeof appointmentStatus.enumValues)[number]
