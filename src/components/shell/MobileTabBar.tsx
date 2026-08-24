import { Link, useLocation } from "react-router-dom";
import { navItems } from "./nav-items";
import { useBusinessMode } from "@/context/useBusinessMode";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function MobileTabBar() {
  const { pathname } = useLocation();
  const { businessMode } = useBusinessMode();

  return (
    <nav
      className={`md:hidden fixed bottom-0 inset-x-0 z-20 ${
        businessMode ? "border-t-0 bg-[#5aa89a]" : "border-t border-border bg-surface"
      }`}
    >
      <ul className="grid grid-cols-8">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                to={item.href}
                title={item.labelKo}
                className={`flex items-center justify-center px-1 py-2.5 text-center text-[11px] ${
                  businessMode
                    ? active
                      ? "bg-white/15 text-white font-medium"
                      : "text-white/80 hover:bg-black/[.03] hover:text-white"
                    : active
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-foreground/70 hover:bg-black/[.03] hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
