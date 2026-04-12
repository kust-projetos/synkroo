// src/components/calendar/EventCard.tsx

/** Status display config: label + dot color */
const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  scheduled: { label: 'Agendado', dot: '#60A5FA' },
  confirmed: { label: 'Confirmado', dot: '#34D399' },
  'in_progress': { label: 'Em andamento', dot: '#10B981' },
  completed: { label: 'Concluído', dot: '#9CA3AF' },
  cancelled: { label: 'Cancelado', dot: '#F87181' },
  'no-show': { label: 'Não compareceu', dot: '#EF4444' },
}

export function eventContent(info: any): { html: string } {
  const { event, timeText, view } = info
  const props = event.extendedProps || {}
  const isMonthView = view.type === 'dayGridMonth'
  const status = props.status || ''
  const statusCfg = STATUS_CONFIG[status] || { label: '', dot: event.backgroundColor }
  const hasProcedure = !!props.procedureName

  if (isMonthView) {
    return {
      html: `
        <div class="ec-month-event">
          <span class="ec-event-dot" style="background:${statusCfg.dot}"></span>
          <span class="ec-event-time">${timeText}</span>
          <span class="ec-event-title">${event.title}</span>
        </div>
      `,
    }
  }

  // Week/day/resource views — full card layout
  return {
    html: `
      <div class="ec-full-event">
        <div class="ec-event-header">
          <span class="ec-event-time">${timeText}</span>
          ${statusCfg.label ? `<span class="ec-status-badge"><span class="ec-status-dot" style="background:${statusCfg.dot}"></span>${statusCfg.label}</span>` : ''}
        </div>
        <div class="ec-event-body">
          <span class="ec-event-title">${event.title}</span>
          ${hasProcedure ? `<span class="ec-event-procedure">${props.procedureName}</span>` : ''}
        </div>
      </div>
    `,
  }
}

/**
 * Returns CSS class names based on appointment status.
 * Non-editable statuses are not draggable via Interaction plugin.
 */
export function eventClassNames(info: any): string[] {
  const status = info.event.extendedProps?.status || ''
  const classes = [`ec-status-${status}`]

  // Mark short events so CSS can hide secondary info
  const start = info.event.start ? new Date(info.event.start) : null
  const end = info.event.end ? new Date(info.event.end) : null
  if (start && end && (end.getTime() - start.getTime()) < 30 * 60 * 1000) {
    classes.push('ec-short-event')
  }

  return classes
}
