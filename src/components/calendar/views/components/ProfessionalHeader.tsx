import { cn } from '@/lib/utils'

interface ProfessionalHeaderProps {
  name: string
  specialty: string
  initials: string
  color: string
}

export function ProfessionalHeader({ name, specialty, initials, color }: ProfessionalHeaderProps) {
  return (
    <div
      className="h-14 p-2 text-center border-b-2 flex items-center justify-center gap-2"
      style={{ borderColor: color, backgroundColor: `${color}14` }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
      <div className="text-left">
        <div className="text-xs font-semibold text-foreground">{name}</div>
        <div className="text-[10px] text-muted-foreground">{specialty}</div>
      </div>
    </div>
  )
}
