import {
  Home,
  MessageSquare,
  Mail,
  CalendarCheck,
  BarChart3,
  Award,
  Megaphone,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/messenger", label: "Messenger", icon: MessageSquare },
  { href: "/email", label: "Email", icon: Mail },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/evaluation", label: "Evaluation", icon: Award },
  { href: "/notice", label: "Notice", icon: Megaphone },
  { href: "/settings", label: "Settings", icon: Settings },
];
