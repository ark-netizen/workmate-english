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
  labelKo: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Home", labelKo: "홈", icon: Home },
  { href: "/messenger", label: "Messenger", labelKo: "메신저", icon: MessageSquare },
  { href: "/email", label: "Email", labelKo: "이메일", icon: Mail },
  { href: "/attendance", label: "Attendance", labelKo: "근태", icon: CalendarCheck },
  { href: "/reports", label: "Reports", labelKo: "업무일지", icon: BarChart3 },
  { href: "/evaluation", label: "Evaluation", labelKo: "인사평가", icon: Award },
  { href: "/notice", label: "Notice", labelKo: "공지사항", icon: Megaphone },
  { href: "/settings", label: "Settings", labelKo: "설정", icon: Settings },
];
