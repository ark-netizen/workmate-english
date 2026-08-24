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
  /** 홈 화면 첫 방문 투어(SectionTourGuide)에서 메뉴 단계에 항목별로 보여주는 한 줄 설명 */
  desc: string;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Home", labelKo: "홈", icon: Home, desc: "오늘 할 일과 진행 상황 한눈에 보기" },
  { href: "/messenger", label: "Messenger", labelKo: "메신저", icon: MessageSquare, desc: "동료·상사·거래처와 채팅" },
  { href: "/email", label: "Email", labelKo: "이메일", icon: Mail, desc: "격식 있는 이메일 주고받기" },
  { href: "/attendance", label: "Attendance", labelKo: "근태", icon: CalendarCheck, desc: "출퇴근 기록과 연차 확인" },
  { href: "/reports", label: "Reports", labelKo: "업무일지", icon: BarChart3, desc: "하루·주간·월간 리포트 확인" },
  { href: "/evaluation", label: "Evaluation", labelKo: "인사평가", icon: Award, desc: "승급 평가 확인 및 진행" },
  { href: "/notice", label: "Notice", labelKo: "공지사항", icon: Megaphone, desc: "회사 공지 확인" },
  { href: "/settings", label: "Settings", labelKo: "설정", icon: Settings, desc: "프로필·알림 설정 변경" },
];
