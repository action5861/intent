"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Zap, CheckCircle2, Clock, LogOut, RefreshCw, ShoppingBag, Bot, AlertTriangle, X } from "lucide-react";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface MatchedIntent {
  id: string;
  enrichedText: string | null;
  rawText: string;
  category: string | null;
  expectedPrice: number | null;
  status: string;
  createdAt: string;
  matchScore?: number;
  matchReason?: string;
  isNew?: boolean;
  // [체류시간 #6] 체류시간 관련 필드
  dwellTimeMs?: number | null;
  slaVerifiedAt?: string | null;
  paidReward?: number | null;
}

// [체류시간 #6] dwellTimeMs를 "23.4초" 형태로 표시
function DwellTimeBadge({ dwellTimeMs }: { dwellTimeMs?: number | null }) {
  if (dwellTimeMs == null) return <span className="text-xs text-slate-600">-</span>;
  const seconds = (dwellTimeMs / 1000).toFixed(1);
  const isGood = dwellTimeMs >= 20000;
  return (
    <span className={`text-xs font-semibold ${isGood ? "text-green-400" : "text-red-400"}`}>
      {seconds}초
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "MATCHED") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-400 border border-green-500/20">
      <CheckCircle2 className="h-3 w-3" /> 매칭 완료
    </span>
  );
  if (status === "SLA_VERIFIED") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-400 border border-purple-500/20">
      <Sparkles className="h-3 w-3" /> 정산 완료
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
      <Clock className="h-3 w-3" /> 대기중
    </span>
  );
}

export default function AdvertiserDashboardPage() {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const [company, setCompany] = useState("광고주");
  const [connected, setConnected] = useState(false);
  const [matches, setMatches] = useState<MatchedIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [budgetAlert, setBudgetAlert] = useState<{
    remainingBudget: number;
    remainingVisits: number;
    isCritical: boolean;
  } | null>(null);

  const advertiserId = typeof window !== "undefined" ? localStorage.getItem("advertiser_id") : null;

  const fetchMatches = useCallback(async () => {
    const token = localStorage.getItem("advertiser_token");
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/intents/advertiser-matches`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMatches(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoading(false);
  }, []);

  const handleLogout = useCallback(() => {
    socketRef.current?.disconnect();
    localStorage.removeItem("advertiser_token");
    localStorage.removeItem("advertiser_id");
    localStorage.removeItem("advertiser_company");
    router.replace("/advertiser/login");
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem("advertiser_token");
    const savedCompany = localStorage.getItem("advertiser_company");
    if (!token) { router.replace("/advertiser/login"); return; }
    if (savedCompany) setCompany(savedCompany);

    fetchMatches();

    const socket = io(`${API_URL}/intents-realtime`, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("error", (err: { message: string }) => {
      if (err.message.includes("인증")) handleLogout();
    });

    // 예산 부족 알림 수신
    socket.on("budget_alert", (data: { remainingBudget: number; remainingVisits: number; isCritical: boolean }) => {
      setBudgetAlert(data);
    });

    // 자동 매칭 완료 알림 수신 → 목록에 실시간 추가
    socket.on("new_intent_opportunity", (data: MatchedIntent) => {
      setMatches((prev) => {
        if (prev.find((m) => m.id === data.id)) return prev;
        setNewCount((n) => n + 1);
        return [{ ...data, isNew: true }, ...prev];
      });
    });

    return () => { socket.disconnect(); };
  }, [router, handleLogout, fetchMatches]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return d.toLocaleDateString("ko-KR");
  };

  const totalRevenue = matches.filter(m => m.status === "SLA_VERIFIED").length;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-white">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-white/10 bg-slate-950/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-purple-400" />
          <span className="text-xl font-bold tracking-tight">Intendex 광고주</span>
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border ${connected ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-slate-700 text-slate-400 border-slate-600"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-slate-500"}`} />
            {connected ? "실시간 연결" : "연결 중..."}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setNewCount(0); fetchMatches(); }}
            className="relative text-slate-400 hover:text-white transition-colors"
            title="새로고침"
          >
            <RefreshCw className="h-4 w-4" />
            {newCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white">
                {newCount}
              </span>
            )}
          </button>
          <span className="text-sm font-medium text-slate-300">{company}</span>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors" title="로그아웃">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {budgetAlert && (
        <div className={`flex items-center justify-between gap-3 px-6 py-3 text-sm font-medium ${
          budgetAlert.isCritical
            ? "bg-red-500/10 border-b border-red-500/20 text-red-400"
            : "bg-amber-500/10 border-b border-amber-500/20 text-amber-400"
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {budgetAlert.isCritical
              ? `예산이 거의 소진되었습니다. 잔여 예산 ${budgetAlert.remainingBudget.toLocaleString("ko-KR")}원 — 추가 매칭이 중단될 수 있습니다.`
              : `예산 부족 경고: 잔여 ${budgetAlert.remainingBudget.toLocaleString("ko-KR")}원 (약 ${budgetAlert.remainingVisits}회 방문 가능). 어드민에 예산 충전을 요청하세요.`
            }
          </div>
          <button onClick={() => setBudgetAlert(null)} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* 요약 통계 */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <p className="text-xs text-slate-500 mb-1">총 매칭</p>
            <p className="text-2xl font-bold text-white">{matches.length}<span className="text-sm font-normal text-slate-400 ml-1">건</span></p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <p className="text-xs text-slate-500 mb-1">정산 완료</p>
            <p className="text-2xl font-bold text-purple-400">{totalRevenue}<span className="text-sm font-normal text-slate-400 ml-1">건</span></p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <p className="text-xs text-slate-500 mb-1">AI 자동 매칭</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Bot className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-blue-400">활성</span>
            </div>
          </div>
        </div>

        {/* 매칭 내역 */}
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            <h2 className="text-lg font-bold text-white">매칭된 사용자 의도</h2>
          </div>
          <span className="text-sm text-slate-500">AI가 자동으로 선별한 결과입니다</span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-900 border border-white/10" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-20 text-slate-500">
            <ShoppingBag className="mb-3 h-10 w-10 text-slate-600" />
            <p className="text-sm">아직 매칭된 사용자 의도가 없습니다.</p>
            <p className="mt-1 text-xs text-slate-600">AI가 적합한 사용자 의도를 자동으로 매칭해드립니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <div
                key={match.id}
                className={`rounded-2xl border p-5 transition-all ${match.isNew ? "border-purple-500/30 bg-purple-500/5" : "border-white/10 bg-slate-900"}`}
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={match.status} />
                    {match.isNew && (
                      <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-bold text-purple-300 border border-purple-500/30">
                        NEW
                      </span>
                    )}
                    {match.matchScore && (
                      <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-bold text-yellow-400 border border-yellow-500/20">
                        AI {match.matchScore}점
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{formatDate(match.createdAt)}</span>
                </div>

                <p className="text-sm font-medium text-white leading-relaxed">
                  "{match.enrichedText ?? match.rawText}"
                </p>

                {match.matchReason && (
                  <p className="mt-2 text-xs text-slate-400 border-t border-white/5 pt-2">{match.matchReason}</p>
                )}

                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  {match.category && (
                    <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{match.category}</span>
                  )}
                  {match.expectedPrice && (
                    <span className="text-xs font-bold text-blue-400">
                      {match.expectedPrice.toLocaleString("ko-KR")}원
                    </span>
                  )}
                  {/* [체류시간 #6] 체류시간 표시 */}
                  {match.status === "SLA_VERIFIED" && (
                    <span className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-0.5">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <DwellTimeBadge dwellTimeMs={match.dwellTimeMs} />
                    </span>
                  )}
                  {match.paidReward != null && match.status === "SLA_VERIFIED" && (
                    <span className="text-xs font-bold text-purple-400">
                      -{match.paidReward.toLocaleString("ko-KR")}P 지급
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
