import { Outlet, useLocation } from "react-router-dom";
import { EmailList } from "@/components/email/EmailList";

export function EmailLayout() {
  const { pathname } = useLocation();
  const isIndex = pathname === "/email";

  return (
    <div className="flex" style={{ height: "calc(100vh - 57px)" }}>
      <div className={`${isIndex ? "flex" : "hidden"} md:flex`}>
        <EmailList />
      </div>
      <div className={`${isIndex ? "hidden" : "flex"} min-w-0 flex-1 md:flex`}>
        <Outlet />
      </div>
    </div>
  );
}
