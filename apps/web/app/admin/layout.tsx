"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, Users, Megaphone, LayoutDashboard, ShieldCheck, LogOut, Wallet } from "lucide-react";

const NAV = [
  { href: "/admin", label: "개요", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "사용자 관리", icon: Users, exact: false },
  { href: "/admin/advertisers", label: "광고주 관리", icon: Megaphone, exact: false },
  // [인출 #6] 인출 관리 메뉴 추가
  { href: "/admin/withdrawals", label: "인출 관리", icon: Wallet, exact: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return;
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setUsername(localStorage.getItem("admin_username") ?? "admin");
  }, [pathname, isLoginPage, router]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_username");
    router.push("/admin/login");
  };

  // 로그인 페이지는 레이아웃 없이 렌더링
  if (isLoginPage) return <>{children}</>;
  if (!username) return null; // 토큰 확인 전 빈 화면

  return (
    <div className="flex min-h-screen bg-slate-950 font-sans text-white">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-slate-900">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <ShieldCheck className="h-5 w-5 text-blue-400" />
          <span className="text-lg font-bold tracking-tight">Admin</span>
          <span className="ml-auto rounded-full bg-blue-600/20 px-2 py-0.5 text-xs font-semibold text-blue-400">
            v1
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">
              {username.charAt(0).toUpperCase()}
            </div>
            <span>{username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            로그아웃
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Intendex 메인으로
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center border-b border-white/10 px-6">
          <span className="text-sm text-slate-400">
            Intendex &nbsp;/&nbsp;
            <span className="text-white">
              {NAV.find((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href)))?.label ?? "Admin"}
            </span>
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
