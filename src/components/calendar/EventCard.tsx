// src/components/calendar/EventCard.tsx

/**
 * Custom event rendering for @event-calendar/core.
 * Cards are colored by STATUS, not by dentist.
 *
 * Design v3:
 * - Card background = status color (gradient)
 * - Badge = icon + duration (no text redundancy)
 * - Drag handle = subtle, top-right corner
 * - Patient name = bold, prominent
 * - Procedure = smaller, 90% opacity
 */

// Status color palette - Card background = Status color
interface StatusColorSet {
  bg: string
  bgEnd: string
  badge: string
  badgeText: string
}

const STATUS_COLORS: Record<string, StatusColorSet> = {
  scheduled: { bg: '#F59E0B', bgEnd: '#D97706', badge: 'rgba(255,255,255,0.2)', badgeText: 'white' },
  confirmed: { bg: '#14B8A6', bgEnd: '#0D9488', badge: '#22C55E', badgeText: 'white' },
  in_progress: { bg: '#22C55E', bgEnd: '#16A34A', badge: 'rgba(255,255,255,0.25)', badgeText: 'white' },
  completed: { bg: '#9CA3AF', bgEnd: '#6B7280', badge: 'rgba(255,255,255,0.15)', badgeText: 'rgba(255,255,255,0.9)' },
  cancelled: { bg: '#EF4444', bgEnd: '#DC2626', badge: 'rgba(255,255,255,0.2)', badgeText: 'rgba(255,255,255,0.8)' },
  no_show: { bg: '#EF4444', bgEnd: '#DC2626', badge: 'rgba(255,255,255,0.2)', badgeText: 'rgba(255,255,255,0.8)' },
}

type Status = keyof typeof STATUS_COLORS

function getStatusColors(status: string): StatusColorSet {
  return STATUS_COLORS[status] || STATUS_COLORS['scheduled']
}

// Status icons
const STATUS_ICONS: Record<Status, string> = {
  scheduled: '⏳',
  confirmed: '✓',
  in_progress: '▶',
  completed: '✓',
  cancelled: '✕',
  no_show: '✕',
}

/**
 * Custom HTML for event cards in week/day/resource views.
 * Uses status-based colors instead of dentist colors.
 */
export function eventContent(info: any): { html: string } {
  const { event, timeText, view } = info
  const props = event.extendedProps || {}
  const status = props.status || 'scheduled'
  const statusColors = getStatusColors(status)
  const icon = STATUS_ICONS[status as Status] || '⏳'

  // Month view: compact dots
  if (view.type === 'dayGridMonth') {
    return {
      html: `
        <div style="display:flex;align-items:center;gap:4px;overflow:hidden;font-size:11px;">
          <span style="width:6px;height:6px;border-radius:50%;background:${event.backgroundColor || '#14b8a6'};flex-shrink:0;"></span>
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${timeText ? timeText + ' ' : ''}${event.title}</span>
        </div>
      `,
    }
  }

  // Week/Day/Resource views: full card design v3
  const isCancelled = status === 'cancelled' || status === 'no_show'
  const isCompleted = status === 'completed'
  const isInProgress = status === 'in_progress'

  // Duration from props or estimate
  const durationMin = props.durationMinutes || 30
  const durationText = `${durationMin}min`

  // Apply opacity for cancelled/completed
  const opacity = isCancelled || isCompleted ? '0.7' : '1'
  const textDecoration = isCancelled || isCompleted ? 'line-through' : 'none'

  // Pulse animation for in-progress
  const animation = isInProgress ? 'animation:ec-now-pulse 2s ease-in-out infinite;' : ''

  // Drag handle (only for editable statuses)
  const dragHandle = props.editable ? `
    <div style="position:absolute;top:6px;right:6px;font-size:10px;color:rgba(255,255,255,0.4);cursor:grab;user-select:none;">⋮⋮</div>
  ` : ''

  return {
    html: `
      <div style="
        background:linear-gradient(135deg, ${statusColors.bg}, ${statusColors.bgEnd});
        border-radius:8px;
        padding:8px 10px;
        box-shadow:0 2px 4px rgba(0,0,0,0.15);
        cursor:${props.editable ? 'grab' : 'pointer'};
        transition:transform 0.2s, box-shadow 0.2s;
        opacity:${opacity};
        ${animation}
        position:relative;
        height:100%;
        box-sizing:border-box;
      ">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="flex:1;min-width:0;">
            <div style="
              font-size:13px;
              font-weight:600;
              color:white;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
              text-decoration:${textDecoration};
            ">${event.title}</div>
            <div style="
              font-size:10px;
              color:rgba(255,255,255,0.85);
              margin-top:2px;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
              text-decoration:${textDecoration};
            ">${props.procedureName || ''}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
            <span style="
              background:${statusColors.badge};
              padding:2px 6px;
              border-radius:10px;
              font-size:9px;
              color:${statusColors.badgeText};
              display:flex;
              align-items:center;
              gap:2px;
            ">${icon} ${durationText}</span>
          </div>
        </div>
        ${dragHandle}
      </div>
    `,
  }
}

/**
 * Returns CSS class names based on appointment status.
 * Used for additional status-based styling via CSS.
 */
export function eventClassNames(info: any): string[] {
  const status = info.event.extendedProps?.status || 'scheduled'
  return [`ec-status-${status}`]
}
