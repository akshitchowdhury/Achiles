import { Apple, Dumbbell, LayoutDashboard, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/nutrition', label: 'Nutrition', icon: Apple },
  { to: '/workout', label: 'Workout', icon: Dumbbell },
  { to: '/coach', label: 'AI Panel', icon: Sparkles },
]
