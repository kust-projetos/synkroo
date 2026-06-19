interface ScheduleSummaryBarProps {
  periodLabel: string
  appointmentCount: number
  aiChangesCount: number
  manualChangesCount: number
  attentionCount: number
}

export function ScheduleSummaryBar(props: ScheduleSummaryBarProps) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{props.periodLabel}</p>
        <p className="text-2xl font-semibold text-foreground">{props.appointmentCount} agendamentos</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Mudanças recentes</p>
        <p className="text-lg font-semibold text-foreground">{props.aiChangesCount} alterações da IA</p>
        <p className="text-sm text-muted-foreground">{props.manualChangesCount} manuais</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Atenção</p>
        <p className="text-lg font-semibold text-foreground">{props.attentionCount} itens de atenção</p>
      </div>
    </div>
  )
}
