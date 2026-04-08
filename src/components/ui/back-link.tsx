import Link from "next/link"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"

interface BackLinkProps {
  href: string
  label?: string
}

export function BackLink({ href, label = "Voltar" }: BackLinkProps) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
      <ArrowLeftIcon className="h-4 w-4" />
      {label}
    </Link>
  )
}
