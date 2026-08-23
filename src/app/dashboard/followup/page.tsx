export default function FollowupPage() {
  return (
    <div className="p-4 lg:p-8">
      <div className="bg-card rounded-lg border border-border p-6">
        <h1 className="text-2xl font-bold text-foreground">Follow-up</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão de follow-ups pós-consulta, inativos e retenção — módulo followup
        </p>
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Página de follow-up vinculada ao manifesto followup (F4.06). As ações reais são
            executadas via Action Layer do módulo followup.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Paths anteriores /dashboard/followup inexistentes agora possuem entrypoint válido.
          </p>
        </div>
      </div>
    </div>
  )
}
