"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth/context"
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
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>
  section: "principal" | "comunicacao" | "gestao" | "crm"
  badge?: {
    count: number
    variant: "zinc" | "teal" | "amber" | "blue" | "red" | "pill-teal"
  }
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: Squares2X2Icon, section: "principal" },
  { name: "CRM", href: "/dashboard/crm", icon: ChartBarIcon, section: "crm" },
  { name: "Pipeline", href: "/dashboard/crm/pipeline", icon: Squares2X2Icon, section: "crm" },
  { name: "Leads", href: "/dashboard/leads", icon: FlagIcon, section: "crm" },
  { name: "Campanhas", href: "/dashboard/campanhas", icon: MegaphoneIcon, section: "crm" },
  { name: "Contatos", href: "/dashboard/contatos", icon: UsersIcon, section: "crm" },
  { name: "Tarefas", href: "/dashboard/tarefas", icon: CheckCircleIcon, section: "crm" },
  { name: "Conversas", href: "/dashboard/conversas", icon: ChatBubbleLeftRightIcon, section: "crm", badge: { count: 0, variant: "pill-teal" } },
  { name: "Pacientes", href: "/dashboard/pacientes", icon: UsersIcon, section: "principal", badge: { count: 0, variant: "zinc" } },
  { name: "Agendamentos", href: "/dashboard/agendamentos", icon: CalendarDaysIcon, section: "principal", badge: { count: 0, variant: "teal" } },
  { name: "Lista de Espera", href: "/dashboard/lista-espera", icon: ClockIcon, section: "principal" },
  { name: "Inativos", href: "/dashboard/pacientes/inativos", icon: UsersIcon, section: "principal", badge: { count: 0, variant: "amber" } },
  { name: "Analytics", href: "/dashboard/analytics", icon: ChartBarIcon, section: "gestao" },
  { name: "Dentistas", href: "/dashboard/dentistas", icon: IdentificationIcon, section: "gestao" },
  { name: "Procedimentos", href: "/dashboard/procedimentos", icon: WrenchScrewdriverIcon, section: "gestao" },
  { name: "Configuracoes", href: "/dashboard/configuracoes", icon: Cog6ToothIcon, section: "gestao" },
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
        "flex items-center gap-3 rounded-lg transition-colors relative",
        collapsed ? "justify-center p-2 mx-auto" : "px-3 py-2",
        isActive
          ? "bg-teal-600/[0.06] dark:bg-teal-400/10 text-teal-600 dark:text-teal-400"
          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      )}
    >
      <Icon className={cn("flex-shrink-0", collapsed ? "h-5 w-5" : "h-[18px] w-[18px]", isActive && "text-teal-600 dark:text-teal-400")} />
      {!collapsed && <span className={cn("text-[13px]", isActive && "font-semibold")}>{item.name}</span>}
      {item.badge && item.badge.count > 0 && (
        <BadgePill count={item.badge.count} variant={item.badge.variant} collapsed={collapsed} />
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
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
  const initials = profile?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U"

  const sections = ["principal", "crm", "gestao"] as const

  return (
    <div className={cn(
      "flex flex-col h-full transition-all duration-200",
      "bg-white dark:bg-[#0f0f11]",
      "border-r border-zinc-200 dark:border-zinc-800"
    )}>
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-4 pt-5 pb-4", collapsed && "justify-center px-2")}>
        <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          S
        </div>
        {!collapsed && <span className="text-[15px] font-bold text-foreground tracking-tight">Synkroo</span>}
        {!collapsed && (
          <button onClick={onToggle} className="ml-auto h-7 w-7 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
            <ChevronDoubleLeftIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Expand button (collapsed only) */}
      {collapsed && (
        <div className="flex justify-center pb-2">
          <button onClick={onToggle} className="h-7 w-7 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
            <ChevronDoubleRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-1">
        <TooltipProvider>
          {sections.map((section, si) => {
            const sectionItems = navItems.filter(i => i.section === section)
            return (
              <div key={section} className={cn(si > 0 && "mt-2")}>
                {!collapsed && (
                  <div className="px-3 pt-3 pb-1 text-[9px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.08em]">
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
      <div className={cn("px-3 pb-3 pt-2 border-t border-zinc-100 dark:border-zinc-800", collapsed && "px-2")}>
        {/* Theme Toggle */}
        <div className={cn("flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 mb-3", collapsed && "mx-auto w-fit")}>
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              collapsed ? "" : "flex-1 flex items-center justify-center gap-1.5",
              theme === "light" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            <SunIcon className="h-3.5 w-3.5" />
            {!collapsed && <span className="text-[11px] font-medium">Claro</span>}
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              collapsed ? "" : "flex-1 flex items-center justify-center gap-1.5",
              theme === "dark" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            <MoonIcon className="h-3.5 w-3.5" />
            {!collapsed && <span className="text-[11px] font-medium">Escuro</span>}
          </button>
        </div>

        {/* User */}
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">{profile?.name || "Usuario"}</div>
                <div className="text-[10px] text-zinc-400 capitalize">{profile?.role || "Admin"}</div>
              </div>
              <button onClick={() => logout()} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
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
        <Button variant="ghost" size="icon" className="lg:hidden">
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
