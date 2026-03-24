"use client";

import { useEffect, useState } from "react";
import { Users, Megaphone, TrendingUp, Coins, ArrowRight } from "lucide-react";
import Link from "next/link";
import { adminFetch } from "./useAdminFetch";

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalAdvertisers: number;
  activeAdvertisers: number;
  totalRewardsPaid: number;
  totalBudgetSpent: number;
  totalMatches: number;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{label}</span>
        <div className={`rounded-xl p-2 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    adminFetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const fmt = (n: number) => n.toLocaleString("ko-KR");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">플랫폼 개요</h1>
        <p className="mt-1 text-sm text-slate-500">Intendex 플랫폼의 실시간 현황입니다.</p>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="전체 사용자"
            value={stats.totalUsers}
            sub={`활성 ${stats.activeUsers}명`}
            icon={Users}
            color="bg-blue-500/10 text-blue-400"
          />
          <StatCard
            label="전체 광고주"
            value={stats.totalAdvertisers}
            sub={`활성 ${stats.activeAdvertisers}개사`}
            icon={Megaphone}
            color="bg-emerald-500/10 text-emerald-400"
          />
          <StatCard
            label="총 매칭 수"
            value={fmt(stats.totalMatches)}
            sub="누적 성사 건수"
            icon={TrendingUp}
            color="bg-purple-500/10 text-purple-400"
          />
          <StatCard
            label="리워드 지급 총액"
            value={`${fmt(stats.totalRewardsPaid)}P`}
            sub={`광고비 집행 ${fmt(stats.totalBudgetSpent)}원`}
            icon={Coins}
            color="bg-amber-500/10 text-amber-400"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-800" />
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { href: "/admin/users", label: "사용자 관리", desc: "계정 상태 변경, 강제 탈퇴, 리워드 현황 조회", icon: Users },
          { href: "/admin/advertisers", label: "광고주 관리", desc: "예산 설정, 상태 변경, 매칭 현황 조회", icon: Megaphone },
        ].map(({ href, label, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900 p-5 transition-all hover:border-white/20 hover:bg-slate-800"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/5 p-3">
                <Icon className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-white">{label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-white" />
          </Link>
        ))}
      </div>
    </div>
  );
}
