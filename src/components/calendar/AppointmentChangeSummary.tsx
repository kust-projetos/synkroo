export function AppointmentChangeSummary({ summary }: { summary?: string }) {
  if (!summary) return null

  return (
    <p className="text-xs text-muted-foreground truncate" title={summary}>
      {summary}
    </p>
  )
}
