"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Sparkles, Clock, CheckCircle2, Bot, RefreshCw, Megaphone, ExternalLink, Gift, Coins, ArrowDownToLine, X, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-production-6df5.up.railway.app";

// 사이트별 검색 URL 템플릿 — {query} 자리에 사용자 rawText가 삽입됨
const SEARCH_URL_TEMPLATES: Record<string, string> = {
  "coupang.com":        "https://www.coupang.com/np/search?q={query}",
  "naver.com":          "https://search.shopping.naver.com/search/all?query={query}",
  "shopping.naver.com": "https://search.shopping.naver.com/search/all?query={query}",
  "gmarket.co.kr":      "https://browse.gmarket.co.kr/search?keyword={query}",
  "11st.co.kr":         "https://www.11st.co.kr/search/searchList.tmall?q={query}",
  "auction.co.kr":      "https://www.auction.co.kr/Search/Product/Search.aspx?keyword={query}",
  "ssg.com":            "https://www.ssg.com/search.ssg?query={query}",
  "kurly.com":          "https://www.kurly.com/search?sword={query}",
  "ohou.se":            "https://ohou.se/search?query={query}",
  "interpark.com":      "https://shopping.interpark.com/search/item.do?q={query}",
  "tmon.co.kr":         "https://search.tmon.co.kr/search?q={query}",
  "wemakeprice.com":    "https://front.wemakeprice.com/search?searchword={query}",
  "aladin.co.kr":       "https://www.aladin.co.kr/search/wsearchresult.aspx?SearchWord={query}",
  "yes24.com":          "https://www.yes24.com/Product/Search?domain=ALL&query={query}",
  "kyobobook.co.kr":    "https://search.kyobobook.co.kr/search?keyword={query}",
  "daum.net":           "https://search.daum.net/search?q={query}",
  "google.co.kr":       "https://www.google.co.kr/search?q={query}",
  "bing.com":           "https://www.bing.com/search?q={query}",
  "zigbang.com":        "https://www.zigbang.com/search?q={query}",
  "fastcampus.co.kr":   "https://fastcampus.co.kr/search?keyword={query}",
  "daangn.com":         "https://www.daangn.com/search/{query}",
  "jobkorea.co.kr":     "https://www.jobkorea.co.kr/Search/?stext={query}",
  "saramin.co.kr":      "https://www.saramin.co.kr/zf_user/search/recruit?searchword={query}",
  "netflix.com":        "https://www.netflix.com/search?q={query}",
  "wavve.com":          "https://www.wavve.com/search?q={query}",
  "tving.com":          "https://www.tving.com/search?keyword={query}",
};

/** siteUrl + 사용자 검색어로 검색 직행 URL 생성. 템플릿 없으면 siteUrl 그대로 반환 */
function buildSearchUrl(siteUrl: string, rawText: string): string {
  if (!rawText || !siteUrl) return siteUrl;
  try {
    const hostname = new URL(siteUrl).hostname.replace(/^www\./, "");
    const template = SEARCH_URL_TEMPLATES[hostname];
    if (template) return template.replace("{query}", encodeURIComponent(rawText));
  } catch { /* URL 파싱 실패 시 원본 반환 */ }
  return siteUrl;
}

// [UX개선 #1] WAITING_MATCH 카드 로테이션 텍스트
const MATCHING_TEXTS = [
  "AI가 최적의 광고주를 찾고 있습니다...",
  "500개 광고주 중 최적 매칭을 분석 중...",
  "거의 완료됐어요! 잠시만 기다려주세요...",
];

// [추천매칭 #4] 추천 광고주 타입
interface RecommendedAdvertiser {
  advertiserId: string;
  company: string | null;
  siteUrl: string | null;
  score: number;
  reason: string;
  rewardPerVisit?: number; // [폴백매칭] 폴백 광고주에만 포함
}

interface Intent {
  id: string;
  rawText: string;
  enrichedText: string | null;
  category: string | null;
  expectedPrice: number | null;
  actionType: string | null;
  status: string;
  createdAt: string;
  matchedAdvertiserCompany: string | null;
  matchedAdvertiserSiteUrl: string | null;
  rewardPerVisit: number | null;
  // [추천매칭 #4] 2·3등 추천 광고주
  recommendedAdvertisers: RecommendedAdvertiser[] | null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "WAITING_MATCH") return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500 border border-amber-500/20">
      <Clock className="h-3 w-3" /> 매칭 대기중
    </span>
  );
  if (status === "MATCHED") return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-400 border border-green-500/20">
      <CheckCircle2 className="h-3 w-3" /> 매칭 완료
    </span>
  );
  if (status === "SLA_VERIFIED") return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-semibold text-yellow-400 border border-yellow-500/20">
      <Gift className="h-3 w-3" /> 리워드 지급
    </span>
  );
  if (status === "FALLBACK_READY") return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-400 border border-purple-500/20">
      <Search className="h-3 w-3" /> 쇼핑몰 선택
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-400 border border-purple-500/20 animate-pulse">
      <Bot className="h-3 w-3" /> AI 분석 중
    </span>
  );
}

export default function UserDashboardPage() {
  const router = useRouter();
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("사용자");
  const [rewardBalance, setRewardBalance] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const timeoutRefsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map()); // [UX개선 #3]
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState("");
  const [matchingTextIdx, setMatchingTextIdx] = useState(0); // [UX개선 #1]
  const [newlyMatchedIds, setNewlyMatchedIds] = useState<Set<string>>(new Set()); // [UX개선 #2]
  const [timedOutIds, setTimedOutIds] = useState<Set<string>>(new Set()); // [UX개선 #3]
  // [검색의도삭제 #1] 삭제 확인 중인 intentId
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // [폴백매칭] 폴백 광고주 선택 로딩 중인 intentId
  const [fallbackLoadingId, setFallbackLoadingId] = useState<string | null>(null);

  const fetchIntents = async () => {
    setLoading(true);
    const token = localStorage.getItem("user_token");
    const name = localStorage.getItem("user_name");
    if (name) setUserName(name);

    if (!token) {
      window.location.replace("/login");
      return;
    }

    const authHeaders = { "Authorization": `Bearer ${token}` };

    try {
      const [intentsRes, profileRes] = await Promise.all([
        fetch(`${API_URL}/api/intents`, { headers: authHeaders }),
        fetch(`${API_URL}/api/auth/me`, { headers: authHeaders }),
      ]);
      if (intentsRes.ok) {
        const data = await intentsRes.json();
        setIntents(Array.isArray(data) ? data : []);
      }
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setRewardBalance(profile.rewardBalance ?? 0);
      }
    } catch {
      // 네트워크 오류 시 빈 목록 유지
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const token = localStorage.getItem("user_token");
    if (!token) { window.location.replace("/login"); return; }
    const amount = parseInt(withdrawAmount, 10);
    setWithdrawError("");
    setWithdrawSuccess("");
    if (isNaN(amount)) { setWithdrawError("금액을 입력해주세요."); return; }
    if (!bankName || !accountNumber || !accountHolder) { setWithdrawError("은행 정보를 모두 입력해주세요."); return; }
    setWithdrawLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ amount, bankName, accountNumber, accountHolder }),
      });
      const data = await res.json();
      if (!res.ok) { setWithdrawError(data.message ?? "인출에 실패했습니다."); return; }
      setRewardBalance(data.newBalance);
      setWithdrawSuccess(`${data.withdrawnAmount.toLocaleString("ko-KR")}P 인출이 신청되었습니다.`);
      setWithdrawAmount("");
    } catch {
      setWithdrawError("서버에 연결할 수 없습니다.");
    } finally {
      setWithdrawLoading(false);
    }
  };

  // [검색의도삭제 #1] 검색의도 소프트 딜리트
  const handleDeleteIntent = async (intentId: string) => {
    const token = localStorage.getItem("user_token");
    if (!token) return;
    setDeletingId(intentId);
    try {
      await fetch(`${API_URL}/api/intents/${intentId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      setIntents((prev) => prev.filter((i) => i.id !== intentId));
    } catch {
      // 실패 시 목록 유지
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // [폴백매칭] 사용자가 폴백 광고주 카드 클릭 → select-fallback API 호출 후 즉시 sla-visit 이동
  const handleSelectFallback = async (
    intentId: string,
    advertiserId: string,
    siteUrl: string,
    rawText: string,
    rewardPerVisit: number,
  ) => {
    const token = localStorage.getItem("user_token");
    if (!token) return;
    setFallbackLoadingId(intentId);
    try {
      const res = await fetch(`${API_URL}/api/intents/${intentId}/select-fallback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ advertiserId }),
      });
      if (!res.ok) return;
      const searchUrl = buildSearchUrl(siteUrl, rawText);
      router.push(`/sla-visit?intentId=${intentId}&siteUrl=${encodeURIComponent(searchUrl)}&reward=${rewardPerVisit}`);
    } catch {
      // 실패 시 상태 유지
    } finally {
      setFallbackLoadingId(null);
    }
  };

  // [폴백매칭] FALLBACK_READY 검색의도별 폴백 광고주 순서 랜덤 셔플 (편향 방지)
  // FALLBACK_READY intent ID 목록이 바뀔 때만 재셔플
  const fallbackIntentIds = intents
    .filter((i) => i.status === "FALLBACK_READY")
    .map((i) => i.id)
    .join(",");
  const shuffledFallbacks = useMemo(() => {
    const map: Record<string, RecommendedAdvertiser[]> = {};
    for (const intent of intents) {
      if (intent.status === "FALLBACK_READY" && Array.isArray(intent.recommendedAdvertisers) && intent.recommendedAdvertisers.length > 0) {
        const arr = [...intent.recommendedAdvertisers];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        map[intent.id] = arr;
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallbackIntentIds]);

  useEffect(() => {
    fetchIntents();

    const token = localStorage.getItem("user_token");
    if (!token) return;

    const socket = io(`${API_URL}/intents-realtime`, {
      auth: { token },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    // [추천매칭 #4] intent_matched 이벤트에 recommendedAdvertisers 포함
    // [UX개선 #2] 매칭 완료 시 성공 애니메이션 0.5초 표시
    socket.on("intent_matched", (data: { intentId: string; matchedAdvertiserCompany: string | null; matchedAdvertiserSiteUrl: string | null; rewardPerVisit: number | null; recommendedAdvertisers: RecommendedAdvertiser[] | null }) => {
      setIntents((prev) =>
        prev.map((intent) =>
          intent.id === data.intentId
            ? { ...intent, status: "MATCHED", matchedAdvertiserCompany: data.matchedAdvertiserCompany, matchedAdvertiserSiteUrl: data.matchedAdvertiserSiteUrl, rewardPerVisit: data.rewardPerVisit, recommendedAdvertisers: data.recommendedAdvertisers ?? null }
            : intent
        )
      );
      // [UX개선 #2] 0.5초간 성공 오버레이 표시 후 제거
      setNewlyMatchedIds((prev) => new Set(prev).add(data.intentId));
      setTimeout(() => {
        setNewlyMatchedIds((prev) => { const next = new Set(prev); next.delete(data.intentId); return next; });
      }, 500);
    });

    // [폴백매칭] 정규 매칭 실패 시 폴백 광고주 선택 UI 활성화
    socket.on("intent_fallback_ready", (data: { intentId: string; fallbackAdvertisers: RecommendedAdvertiser[] }) => {
      setIntents((prev) =>
        prev.map((intent) =>
          intent.id === data.intentId
            ? { ...intent, status: "FALLBACK_READY", recommendedAdvertisers: data.fallbackAdvertisers }
            : intent
        )
      );
    });

    socket.on("reward_updated", (data: { intentId: string; rewardAmount: number }) => {
      // 해당 intent 상태를 SLA_VERIFIED로 업데이트
      setIntents((prev) =>
        prev.map((intent) =>
          intent.id === data.intentId
            ? { ...intent, status: "SLA_VERIFIED" }
            : intent
        )
      );
      // rewardBalance 실시간 증가
      setRewardBalance((prev) => (prev !== null ? prev + data.rewardAmount : data.rewardAmount));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // [UX개선 #1] 3초마다 매칭 대기 텍스트 교체
  useEffect(() => {
    const timer = setInterval(() => {
      setMatchingTextIdx((prev) => (prev + 1) % MATCHING_TEXTS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // [UX개선 #3] WAITING_MATCH 검색의도마다 30초 타임아웃 타이머 설정
  useEffect(() => {
    const waitingIntents = intents.filter((i) => i.status === "WAITING_MATCH");
    waitingIntents.forEach((intent) => {
      if (!timeoutRefsRef.current.has(intent.id) && !timedOutIds.has(intent.id)) {
        const timer = setTimeout(() => {
          setTimedOutIds((prev) => new Set(prev).add(intent.id));
          timeoutRefsRef.current.delete(intent.id);
        }, 30000);
        timeoutRefsRef.current.set(intent.id, timer);
      }
    });
    // 더 이상 WAITING_MATCH가 아닌 검색의도의 타이머 정리
    timeoutRefsRef.current.forEach((timer, id) => {
      if (!waitingIntents.find((i) => i.id === id)) {
        clearTimeout(timer);
        timeoutRefsRef.current.delete(id);
      }
    });
  }, [intents]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return d.toLocaleDateString("ko-KR");
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-white">
      {/* 인출 모달 */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4 text-green-400" />
                포인트 인출
              </h2>
              <button onClick={() => setShowWithdraw(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">현재 잔액</span>
              <span className="text-sm font-bold text-yellow-400">{rewardBalance?.toLocaleString("ko-KR")}P</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">인출 금액 (최소 10,000P · 1,000P 단위)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    min={10000}
                    step={1000}
                    placeholder="10000"
                    className="flex-1 rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                  />
                  <button
                    onClick={() => setWithdrawAmount(String(Math.floor((rewardBalance ?? 0) / 1000) * 1000))}
                    className="rounded-xl border border-white/10 bg-slate-800 px-3 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    전액
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">은행</label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-green-500 focus:outline-none"
                >
                  <option value="">선택하세요</option>
                  {["카카오뱅크","토스뱅크","케이뱅크","국민은행","신한은행","하나은행","우리은행","농협은행","기업은행","SC제일은행","씨티은행","대구은행","부산은행","경남은행","광주은행","전북은행","제주은행","우체국"].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">계좌번호 (- 없이 입력)</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="01012345678"
                  maxLength={20}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">예금주명</label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="홍길동"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                />
              </div>
            </div>

            {withdrawError && (
              <p className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">{withdrawError}</p>
            )}
            {withdrawSuccess && (
              <p className="mt-3 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-xs text-green-400">{withdrawSuccess}</p>
            )}

            <button
              onClick={handleWithdraw}
              disabled={withdrawLoading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-40 transition-colors"
            >
              {withdrawLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              인출 신청
            </button>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-white/10 bg-slate-950/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-400" />
          <span className="text-xl font-bold tracking-tight">Intendex Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          {rewardBalance !== null && (
            <div className="flex items-center gap-2">
              <Link
                href="/rewards"
                className="flex items-center gap-1.5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-1.5 hover:bg-yellow-500/10 transition-colors"
              >
                <Coins className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-bold text-yellow-400">{rewardBalance.toLocaleString("ko-KR")}P</span>
              </Link>
              {rewardBalance >= 10000 && (
                <button
                  onClick={() => { setShowWithdraw(true); setWithdrawError(""); setWithdrawSuccess(""); setWithdrawAmount(""); setBankName(""); setAccountNumber(""); setAccountHolder(""); }}
                  className="flex items-center gap-1 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  인출
                </button>
              )}
            </div>
          )}
          <Link href="/intent" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
            새 검색의도 등록하기
          </Link>
          <button onClick={fetchIntents} className="text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold">
            {userName.charAt(0)}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-6 mt-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">나의 검색의도 등록 내역</h1>
              <p className="mt-1 text-sm text-slate-500">{userName}님의 등록 데이터가 실시간으로 저장됩니다.</p>
            </div>
            <span className="text-sm font-medium text-slate-400">총 {intents.length}건</span>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-900 border border-white/10" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {intents.map((intent) => (
                <div
                  key={intent.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-6 transition-all hover:border-white/20 hover:shadow-lg"
                >
                  {/* [UX개선 #2] 매칭 성공 순간 오버레이 (0.5초) */}
                  {newlyMatchedIds.has(intent.id) && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-green-500/25 backdrop-blur-sm">
                      <CheckCircle2 className="h-14 w-14 text-green-400 drop-shadow-lg" />
                    </div>
                  )}

                  <div className="mb-4 flex items-center justify-between">
                    <StatusBadge status={intent.status} />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{formatDate(intent.createdAt)}</span>
                      {/* [검색의도삭제 #1] 삭제 버튼 */}
                      {confirmDeleteId === intent.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteIntent(intent.id)}
                            disabled={deletingId === intent.id}
                            className="flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-40 transition-colors"
                          >
                            {deletingId === intent.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "삭제"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(intent.id)}
                          className="rounded-lg p-1 text-slate-600 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                          title="내 목록에서 삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mb-4 flex-1">
                    <h3 className="text-base font-medium tracking-tight text-white line-clamp-3">
                      "{intent.enrichedText ?? intent.rawText}"
                    </h3>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500">카테고리</span>
                      <span className="text-sm font-medium text-slate-300">{intent.category ?? "분석 중"}</span>
                    </div>
                    {intent.expectedPrice && (
                      <div className="flex flex-col text-right">
                        <span className="text-xs text-slate-500">예상 단가</span>
                        <span className="text-sm font-bold text-blue-400">
                          {intent.expectedPrice.toLocaleString("ko-KR")}원
                        </span>
                      </div>
                    )}
                  </div>
                  {/* [UX개선 #1] WAITING_MATCH 로딩 애니메이션 */}
                  {intent.status === "WAITING_MATCH" && !timedOutIds.has(intent.id) && (
                    <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 flex items-center gap-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-400 shrink-0" />
                      <p className="text-xs text-amber-400 font-medium leading-tight">
                        {MATCHING_TEXTS[matchingTextIdx]}
                      </p>
                    </div>
                  )}

                  {/* [UX개선 #3] 30초 타임아웃 메시지 */}
                  {intent.status === "WAITING_MATCH" && timedOutIds.has(intent.id) && (
                    <div className="mt-3 rounded-xl border border-slate-600/30 bg-slate-800/50 px-3 py-2.5">
                      <p className="text-xs text-slate-400 mb-2">매칭에 시간이 걸리고 있어요. 잠시 후 확인해주세요.</p>
                      <button
                        onClick={fetchIntents}
                        className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-600 transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" /> 새로고침
                      </button>
                    </div>
                  )}

                  {/* [폴백매칭] 폴백 광고주 선택 UI */}
                  {intent.status === "FALLBACK_READY" && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                        <Search className="h-3 w-3" />
                        추천 쇼핑몰에서 찾아보세요
                      </p>
                      <div className="space-y-2">
                        {(shuffledFallbacks[intent.id] ?? intent.recommendedAdvertisers ?? []).map((fb) => (
                          <button
                            key={fb.advertiserId}
                            onClick={() => handleSelectFallback(intent.id, fb.advertiserId, fb.siteUrl ?? "", intent.rawText, fb.rewardPerVisit ?? 300)}
                            disabled={fallbackLoadingId === intent.id}
                            className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2.5 text-left hover:border-green-500/30 hover:bg-slate-800 transition-colors disabled:opacity-50"
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Megaphone className="h-3 w-3 text-slate-400" />
                              <span className="text-xs font-semibold text-white">{fb.company}</span>
                            </div>
                            {fallbackLoadingId === intent.id ? (
                              <div className="flex items-center gap-1.5 rounded-md bg-green-500/10 border border-green-500/20 px-2.5 py-1 w-full justify-center">
                                <Loader2 className="h-3 w-3 animate-spin text-green-400" />
                                <span className="text-xs font-bold text-green-400">연결 중...</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white w-full justify-center">
                                <ExternalLink className="h-3 w-3" />
                                사이트 방문하고 {(fb.rewardPerVisit ?? 300).toLocaleString("ko-KR")}P 받기
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* [추천매칭 #4] 1등 매칭 광고주 */}
                  {(intent.status === "MATCHED" || intent.status === "SLA_VERIFIED") && intent.matchedAdvertiserCompany && (
                    <div className="mt-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Megaphone className="h-3 w-3 text-blue-400" />
                        <span className="text-xs text-blue-400 font-medium">{intent.matchedAdvertiserCompany} 매칭!</span>
                      </div>
                      {intent.status === "SLA_VERIFIED" ? (
                        <div className="flex items-center gap-1.5 rounded-md bg-green-500/10 border border-green-500/20 px-2.5 py-1 w-full justify-center">
                          <Gift className="h-3 w-3 text-green-400" />
                          <span className="text-xs font-bold text-green-400">
                            +{(intent.rewardPerVisit ?? 0).toLocaleString("ko-KR")}P 지급 완료
                          </span>
                        </div>
                      ) : intent.matchedAdvertiserSiteUrl ? (
                        <Link
                          href={`/sla-visit?intentId=${intent.id}&siteUrl=${encodeURIComponent(buildSearchUrl(intent.matchedAdvertiserSiteUrl, intent.rawText))}&reward=${intent.rewardPerVisit ?? 0}`}
                          className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-500 transition-colors w-full justify-center"
                        >
                          <ExternalLink className="h-3 w-3" />
                          사이트 방문하고 {(intent.rewardPerVisit ?? 0).toLocaleString("ko-KR")}P 받기
                        </Link>
                      ) : null}
                    </div>
                  )}

                  {/* [추천매칭 #4] 2·3등 추천 광고주 — 보상 없음, 단순 노출 */}
                  {intent.status === "MATCHED" && Array.isArray(intent.recommendedAdvertisers) && intent.recommendedAdvertisers.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {intent.recommendedAdvertisers.map((rec) => (
                        <div key={rec.advertiserId} className="rounded-lg border border-white/10 bg-slate-800/60 px-2.5 py-1.5">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-400 font-medium">{rec.company}</span>
                              <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">추천</span>
                            </div>
                          </div>
                          {rec.siteUrl ? (
                            <a
                              href={buildSearchUrl(rec.siteUrl, intent.rawText)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:text-white hover:border-white/20 transition-colors w-full justify-center"
                            >
                              <ExternalLink className="h-3 w-3" />
                              사이트 보기
                            </a>
                          ) : null}
                          <p className="mt-1 text-[10px] text-slate-600 text-center">포인트 적립 대상이 아닙니다</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {intents.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-slate-500">
                  <Search className="mb-4 h-10 w-10 text-slate-600" />
                  <p>아직 등록한 검색의도가 없습니다.</p>
                  <Link href="/intent" className="mt-4 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                    첫 번째 검색의도를 등록하러 가기 →
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
