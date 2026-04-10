// Type declarations for @event-calendar/core
declare module '@event-calendar/core' {
  export interface EventSourceInput {
    url?: string
    events?: any[]
    [key: string]: any
  }

  export interface EventInput {
    id?: string | number
    title?: string
    start?: Date | string
    end?: Date | string
    allDay?: boolean
    resourceId?: string | number
    backgroundColor?: string
    borderColor?: string
    extendedProps?: Record<string, any>
    [key: string]: any
  }

  export interface ResourceInput {
    id?: string | number
    title?: string
    eventBackgroundColor?: string
    [key: string]: any
  }

  export interface Option {
    headerToolbar?: boolean
    initialView?: string
    views?: string[]
    events?: EventSourceInput | EventInput[]
    resources?: ResourceInput[]
    locale?: string
    slotMinTime?: string
    slotMaxTime?: string
    hiddenDays?: number[]
    eventContent?: (info: any) => { html: string } | void
    eventClassNames?: (info: any) => string[]
    selectable?: boolean
    editable?: boolean
    eventStartEditable?: boolean
    eventDurationEditable?: boolean
    resourceAreaHeaderContent?: string
    [key: string]: any
  }

  export class Calendar {
    constructor(el: HTMLElement, options: Option)
    destroy(): void
    getOption(name: string): any
    setOption(name: string, value: any): void
    addEvent(event: EventInput): void
    updateEvent(event: EventInput): void
    removeEvent(id: string | number): void
  }

  export function createCalendar(el: HTMLElement, plugins: any[], options: Option): Calendar

  export function destroyCalendar(el: HTMLElement): void

  export const DayGrid: any
  export const TimeGrid: any
  export const Interaction: any
  export const ResourceTimeGrid: any
}

declare module '@event-calendar/core/index.css' {
  const content: any
  export default content
}

declare module '@event-calendar/day-grid' {
  export const DayGrid: any
}

declare module '@event-calendar/time-grid' {
  export const TimeGrid: any
}

declare module '@event-calendar/interaction' {
  export const Interaction: any
}

declare module '@event-calendar/resource-time-grid' {
  export const ResourceTimeGrid: any
}
