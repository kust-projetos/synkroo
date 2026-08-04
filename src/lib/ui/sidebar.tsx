"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth/context"
import { getVisibleCoreMenu } from "@/lib/ui/menu-actions"
import {
  Squares2X2Icon,
  UsersIcon,
  CalendarDaysIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  MegaphoneIcon,
  FlagIcon,
  ChartBarIcon,
  IdentificationIcon,
  WrenchScrewdriverIcon,
  Cog6ToothIcon,
  ArrowRightStartOnRectangleIcon as LogoutIcon,
  SunIcon,
  MoonIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  Bars3Icon,
  CheckCircleIcon,
  UserGroupIcon,
  QueueListIcon,
} from "@heroicons/react/24/outline"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"

const COLLAPSED_KEY = "synkroo_sidebar_collapsed"

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  section: "principal" | "comunicacao" | "gestao" | "crm"
  badge?: {
    count: number
    variant: "zinc" | "teal" | "amber" | "blue" | "red" | "pill-teal"
  }
}

// Mapeamento de nome → componente Heroicons para itens do menu modular (coreManifest).
// Extensível quando outros módulos adicionarem `menu` ao seu manifest.
const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Cog6ToothIcon,
  UsersIcon,
  ChartBarIcon,
  FlagIcon,
  MegaphoneIcon,
  Squares2X2Icon,
  CalendarDaysIcon,
  ClockIcon,
  IdentificationIcon,
  WrenchScrewdriverIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  UserGroupIcon,
  QueueListIcon,
}


const navItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: Squares2X2Icon, section: "principal" },
  { name: "CRM", href: "/dashboard/crm", icon: ChartBarIcon, section: "crm" },
  { name: "Campanhas", href: "/dashboard/campanhas", icon: MegaphoneIcon, section: "crm" },

  { name: "Tarefas", href: "/dashboard/tarefas", icon: CheckCircleIcon, section: "crm" },
  { name: "Conversas", href: "/dashboard/conversas", icon: ChatBubbleLeftRightIcon, section: "crm", badge: { count: 0, variant: "pill-teal" } },
  // Pacientes, Agendamentos, Lista de Espera, Dentistas, Procedimentos —
  // agora vêm do menu dinâmico via operacionalManifest (F8)
  { name: "Inativos", href: "/dashboard/pacientes/inativos", icon: UsersIcon, section: "principal", badge: { count: 0, variant: "amber" } },
  { name: "Analytics", href: "/dashboard/analytics", icon: ChartBarIcon, section: "gestao" },
  // Dentistas e Procedimentos — agora vêm do menu dinâmico via operacionalManifest
]

const sectionLabels = {
  principal: "Principal",
  crm: "CRM",
  gestao: "Gestao",
}

function BadgePill({ count, variant, collapsed }: { count: number; variant: string; collapsed: boolean }) {
  if (count === 0) return null

  const styles: Record<string, string> = {
    zinc: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    teal: "bg-teal-50 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/50 dark:text-red-400",
    "pill-teal": "bg-teal-600 text-white",
  }

  if (collapsed) {
    return (
      <div className={cn("absolute top-0 right-0 h-2 w-2 rounded-full", variant === "pill-teal" ? "bg-teal-600" : "bg-teal-500")} />
    )
  }

  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", styles[variant] || styles.zinc)}>
      {count}
    </span>
  )
}

function NavItemLink({ item, isActive, collapsed }: { item: NavItem; isActive: boolean; collapsed: boolean }) {
  const Icon = item.icon
  const content = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl transition-all duration-200 relative group font-medium",
        collapsed ? "justify-center p-2.5 mx-auto" : "px-3 py-2.5",
        isActive
          ? "bg-gradient-to-r from-teal-500/15 via-teal-500/10 to-transparent text-teal-700 dark:text-teal-300 font-semibold shadow-sm"
          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40"
      )}
    >
      {/* Active Indicator Bar */}
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-gradient-to-b from-teal-500 to-emerald-500 shadow-[0_0_8px_rgba(13,148,136,0.5)]" />
      )}
      <Icon className={cn(
        "flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
        collapsed ? "h-5 w-5" : "h-4 w-4",
        isActive ? "text-teal-600 dark:text-teal-400" : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
      )} />
      {!collapsed && <span className="text-xs tracking-tight">{item.name}</span>}
      {item.badge && item.badge.count > 0 && (
        <BadgePill count={item.badge.count} variant={item.badge.variant} collapsed={collapsed} />
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2 font-semibold">
          {item.name}
          {item.badge && item.badge.count > 0 && (
            <BadgePill count={item.badge.count} variant={item.badge.variant} collapsed={false} />
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  return content
}

function SidebarContent({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { profile, logout } = useAuth()
  const initials = profile?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "SY"

  const sections = ["principal", "crm", "gestao"] as const

  // Itens de menu do Core, filtrados por RBAC real no servidor (W6 acabamento).
  const [coreNavItems, setCoreNavItems] = useState<NavItem[]>([])
  useEffect(() => {
    let active = true
    getVisibleCoreMenu()
      .then((items) => {
        if (!active) return
        setCoreNavItems(
          items.map((item) => ({
            name: item.label,
            href: (item.path as string) ?? `/${item.label}`,
            icon: ICON_MAP[item.icon as string] ?? Cog6ToothIcon,
            section: 'gestao' as const,
          })),
        )
      })
      .catch(() => { if (active) setCoreNavItems([]) })
    return () => { active = false }
  }, [])

  const allNavItems = [
    ...navItems,
    ...coreNavItems.filter(
      (ci) => !navItems.some((ni) => ni.href === ci.href)
    ),
  ]

  return (
    <div className={cn(
      "flex flex-col h-full transition-all duration-200",
      "bg-white/80 dark:bg-[#090d16]/90 backdrop-blur-xl",
      "border-r border-zinc-200/80 dark:border-white/10"
    )}>
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-4 pt-5 pb-4 border-b border-zinc-100 dark:border-white/5", collapsed && "justify-center px-2")}>
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-700 flex items-center justify-center text-white font-extrabold text-base flex-shrink-0 shadow-md shadow-teal-600/30 ring-2 ring-teal-400/20">
          S
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-foreground tracking-tight">Synkroo</span>
              <span className="text-[9px] font-extrabold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/80 border border-teal-200/60 dark:border-teal-800/60 px-1.5 py-0.2 rounded-md uppercase tracking-wider">
                v2.4
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground truncate">{profile?.clinics?.name || "Odonto Pro"}</span>
          </div>
        )}
        {!collapsed && (
          <button onClick={onToggle} className="ml-auto h-7 w-7 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-colors">
            <ChevronDoubleLeftIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Expand button (collapsed only) */}
      {collapsed && (
        <div className="flex justify-center pt-3 pb-1">
          <button onClick={onToggle} className="h-7 w-7 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-colors">
            <ChevronDoubleRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <TooltipProvider>
          {sections.map((section, si) => {
            const sectionItems = allNavItems.filter(i => i.section === section)
            return (
              <div key={section} className={cn(si > 0 && "pt-3")}>
                {!collapsed && (
                  <div className="px-3 pb-1.5 text-[9px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.1em]">
                    {sectionLabels[section]}
                  </div>
                )}
                {collapsed && si > 0 && <div className="w-5 h-px bg-zinc-200 dark:bg-zinc-800 mx-auto my-2" />}
                <div className="space-y-0.5">
                  {sectionItems.map(item => (
                    <NavItemLink
                      key={item.href}
                      item={item}
                      isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </TooltipProvider>
      </nav>

      {/* Footer */}
      <div className={cn("px-3 pb-3 pt-3 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20", collapsed && "px-2")}>
        {/* Theme Toggle */}
        <div className={cn("flex gap-1 bg-zinc-200/60 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl p-1 mb-3 border border-zinc-200/50 dark:border-white/5", collapsed && "mx-auto w-fit")}>
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "rounded-lg p-1.5 transition-all duration-200",
              collapsed ? "" : "flex-1 flex items-center justify-center gap-1.5",
              theme === "light" ? "bg-white dark:bg-zinc-800 shadow-sm text-teal-700 font-semibold" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            )}
          >
            <SunIcon className="h-3.5 w-3.5" />
            {!collapsed && <span className="text-[11px]">Claro</span>}
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "rounded-lg p-1.5 transition-all duration-200",
              collapsed ? "" : "flex-1 flex items-center justify-center gap-1.5",
              theme === "dark" ? "bg-white dark:bg-zinc-800 shadow-sm text-teal-400 font-semibold" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            )}
          >
            <MoonIcon className="h-3.5 w-3.5" />
            {!collapsed && <span className="text-[11px]">Escuro</span>}
          </button>
        </div>

        {/* User Profile */}
        <div className={cn("flex items-center gap-2.5 p-1.5 rounded-xl transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-800/40", collapsed && "justify-center")}>
          <div className="relative flex-shrink-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" />
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">{profile?.name || "Dr. Profissional"}</div>
                <div className="text-[10px] text-teal-600 dark:text-teal-400 font-medium capitalize truncate">{profile?.role || "Administrador"}</div>
              </div>
              <button onClick={() => logout()} title="Sair" aria-label="Sair" className="p-1 text-zinc-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30">
                <LogoutIcon className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSED_KEY)
    if (saved === "true") setCollapsed(true)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(COLLAPSED_KEY, String(collapsed))
    }
  }, [collapsed, mounted])

  if (!mounted) {
    return <div className="w-60 border-r border-border bg-card" />
  }

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 transition-all duration-200 border-r border-border bg-card",
        collapsed ? "w-20" : "w-60"
      )}
    >
      <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
    </aside>
  )
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
          <Bars3Icon className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0">
        <SheetTitle className="sr-only">Menu de navegacao</SheetTitle>
        <SidebarContent collapsed={false} onToggle={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
