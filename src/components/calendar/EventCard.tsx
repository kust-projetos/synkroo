// src/components/calendar/EventCard.tsx

/**
 * Custom event rendering callback for @event-calendar/core.
 * Returns HTML for event cards in week/day/resource views.
 */
export function eventContent(info: any): { html: string } {
  const { event, timeText, view } = info
  const props = event.extendedProps || {}
  const isMonthView = view.type === 'dayGridMonth'

  if (isMonthView) {
    return {
      html: `
        <div style="display:flex;align-items:center;gap:4px;overflow:hidden;font-size:11px;">
          <span style="width:6px;height:6px;border-radius:50%;background:${event.backgroundColor};flex-shrink:0;"></span>
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${timeText} ${event.title}</span>
        </div>
      `,
    }
  }

  return {
    html: `
      <div style="display:flex;flex-direction:column;padding:2px 4px;gap:1px;overflow:hidden;">
        <span style="font-size:11px;color:rgba(255,255,255,0.8);font-weight:500;">${timeText}</span>
        <span style="font-size:12px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${event.title}</span>
        <span style="font-size:10px;color:rgba(255,255,255,0.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${props.procedureName || ''}</span>
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
  return [`ec-status-${status}`]
}
