"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-production-6df5.up.railway.app";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Coins, Gift, Sparkles, ShoppingBag, TrendingUp, Zap,
  ArrowDownToLine, X, Loader2, Clock, CheckCircle, XCircle, Wallet,
} from "lucide-react";
import BackButton from "../components/BackButton";

interface RewardHistory {
  intentId: string;
  text: string;
  category: string | null;
  advertiserCompany: string;
  rewardAmount: number;
  earnedAt: string;
}

interface RewardData {
  name: string;
  rewardBalance: number;
  totalIntents: number;
  totalEarned: number;
  history: RewardHistory[];
}

// [인출 #2] 인출 신청 내역 타입
interface WithdrawalRequest {
  id: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminMemo: string | null;
  processedAt: string | null;
  createdAt: string;
}

const BANKS = [
  "국민은행", "신한은행", "하나은행", "우리은행", "농협은행",
  "기업은행", "SC제일은행", "카카오뱅크", "토스뱅크", "케이뱅크", "우체국",
];

export default function RewardsPage() {
  const router = useRouter();
  const [data, setData] = useState<RewardData | null>(null);
  const [loading, setLoading] = useState(true);

  // [인출 #2] 인출 신청 내역 상태
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState("");

  // [인출 #2] 인출 신청 내역 불러오기
  const fetchWithdrawals = useCallback(async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/withdrawals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const list = await res.json();
        setWithdrawals(list);
      }
    } catch {
      // 무시
    }
  }, []);

  const openWithdrawModal = () => {
    setShowWithdraw(true);
    setWithdrawError("");
    setWithdrawSuccess("");
    setWithdrawAmount("");
    setBankName("");
    setAccountNumber("");
    setAccountHolder("");
  };

  const handleWithdraw = async () => {
    const token = localStorage.getItem("user_token");
    if (!token) { router.replace("/login"); return; }
    const amount = parseInt(withdrawAmount, 10);
    setWithdrawError("");
    setWithdrawSuccess("");
    if (isNaN(amount)) { setWithdrawError("금액을 입력해주세요."); return; }
    if (!bankName) { setWithdrawError("은행을 선택해주세요."); return; }
    if (!accountNumber || !accountHolder) { setWithdrawError("은행 정보를 모두 입력해주세요."); return; }
    setWithdrawLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, bankName, accountNumber, accountHolder }),
      });
      const json = await res.json();
      if (!res.ok) { setWithdrawError(json.message ?? "인출에 실패했습니다."); return; }
      setWithdrawSuccess(`${json.withdrawnAmount.toLocaleString("ko-KR")}P 인출이 신청되었습니다.`);
      setWithdrawAmount("");
      // [인출 #2] 신청 내역 갱신 (승인 전 잔액 불변)
      await fetchWithdrawals(token);
    } catch {
      setWithdrawError("서버에 연결할 수 없습니다.");
    } finally {
      setWithdrawLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("user_token");
    if (!token) { router.replace("/login"); return; }

    Promise.all([
      fetch(`${API_URL}/api/auth/rewards`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.ok ? r.json() : null),
      fetch(`${API_URL}/api/auth/withdrawals`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.ok ? r.json() : []),
    ])
      .then(([rewardData, withdrawalList]) => {
        if (rewardData) setData(rewardData);
        setWithdrawals(withdrawalList ?? []);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // [인출 #2] 잔액 부족 또는 PENDING 요청 존재 시 인출 버튼 비활성화
  const hasPending = withdrawals.some((w) => w.status === "PENDING");
  const canWithdraw = (data?.rewardBalance ?? 0) >= 10000 && !hasPending;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
      </div>
    );
  }

  // [인출 #2] 상태 뱃지
  const StatusBadge = ({ status }: { status: string }) => {
    if (status === "PENDING") return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-semibold text-yellow-400">
        <Clock className="h-3 w-3" /> 대기중
      </span>
    );
    if (status === "APPROVED") return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-400">
        <CheckCircle className="h-3 w-3" /> 승인됨
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
        <XCircle className="h-3 w-3" /> 거부됨
      </span>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-white">
      {/* [인출 #2] 인출 모달 */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4 text-green-400" />
                포인트 인출 신청
              </h2>
              <button onClick={() => setShowWithdraw(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">현재 잔액</span>
              <span className="text-sm font-bold text-yellow-400">{(data?.rewardBalance ?? 0).toLocaleString("ko-KR")}P</span>
            </div>

            <div className="space-y-3">
              {/* 인출 금액 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">인출 금액 (최소 10,000P · 1,000P 단위)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    min={10000}
                    step={1000}
                    max={data?.rewardBalance ?? 0}
                    placeholder="10000"
                    className="flex-1 rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                  />
                  <button
                    onClick={() => setWithdrawAmount(String(Math.floor((data?.rewardBalance ?? 0) / 1000) * 1000))}
                    className="rounded-xl border border-white/10 bg-slate-800 px-3 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    전액
                  </button>
                </div>
              </div>

              {/* 은행명 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">은행</label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-green-500 focus:outline-none"
                >
                  <option value="">선택하세요</option>
                  {BANKS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* 계좌번호 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">계좌번호 (- 없이 입력)</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="숫자만 입력"
                  maxLength={20}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                />
              </div>

              {/* 예금주 */}
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

            {/* [인출 #2] 주의사항 */}
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
              <p className="text-xs text-amber-400 font-medium">⚠️ 예금주명이 본인과 일치하지 않으면 인출이 거부될 수 있습니다.</p>
              <p className="text-xs text-slate-500">인출 처리는 영업일 기준 1~3일 소요됩니다.</p>
              <p className="text-xs text-slate-500">승인 시 포인트가 차감되며, 해당 계좌로 입금됩니다.</p>
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
        <div className="flex items-center gap-3">
          <BackButton />
          <Sparkles className="h-5 w-5 text-blue-400" />
          <span className="text-xl font-bold tracking-tight">리워드 포인트</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">

        {/* 잔액 카드 */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 via-slate-900 to-slate-900 p-6">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-yellow-500/70">
            <Coins className="h-3.5 w-3.5" />
            현재 포인트 잔액
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-black text-yellow-400">
                {(data?.rewardBalance ?? 0).toLocaleString("ko-KR")}
              </span>
              <span className="mb-1.5 text-xl font-bold text-yellow-500/70">P</span>
            </div>
            {/* [인출 #2] 잔액 부족 또는 대기 중 요청 존재 시 비활성화 */}
            <button
              onClick={openWithdrawModal}
              disabled={!canWithdraw}
              title={hasPending ? "처리 대기 중인 인출 요청이 있습니다" : (data?.rewardBalance ?? 0) < 10000 ? "10,000P 이상부터 인출 가능합니다" : ""}
              className="flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-500/10"
            >
              <ArrowDownToLine className="h-4 w-4" />
              인출하기
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {data?.name}님의 누적 리워드 포인트
            {(data?.rewardBalance ?? 0) < 10000 && !hasPending && (
              <span className="ml-2 text-slate-600">
                (인출은 10,000P 이상부터 가능 · 현재 {(10000 - (data?.rewardBalance ?? 0)).toLocaleString("ko-KR")}P 부족)
              </span>
            )}
            {hasPending && (
              <span className="ml-2 text-yellow-600">(처리 대기 중인 인출 요청이 있습니다)</span>
            )}
          </p>
        </div>

        {/* 통계 3개 */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 text-center">
            <TrendingUp className="mx-auto mb-2 h-5 w-5 text-green-400" />
            <p className="text-xs text-slate-500 mb-1">총 획득 포인트</p>
            <p className="text-lg font-bold text-white">{(data?.totalEarned ?? 0).toLocaleString("ko-KR")}P</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 text-center">
            <Gift className="mx-auto mb-2 h-5 w-5 text-purple-400" />
            <p className="text-xs text-slate-500 mb-1">완료된 방문</p>
            <p className="text-lg font-bold text-white">{data?.history.length ?? 0}건</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 text-center">
            <Zap className="mx-auto mb-2 h-5 w-5 text-blue-400" />
            <p className="text-xs text-slate-500 mb-1">등록한 검색의도</p>
            <p className="text-lg font-bold text-white">{data?.totalIntents ?? 0}건</p>
          </div>
        </div>

        {/* [인출 #2] 인출 신청 내역 */}
        {withdrawals.length > 0 && (
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="h-4 w-4 text-green-400" />
                인출 신청 내역
              </h2>
              <span className="text-xs text-slate-500">총 {withdrawals.length}건</span>
            </div>
            <div className="space-y-2">
              {withdrawals.map((w) => (
                <div key={w.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{w.amount.toLocaleString("ko-KR")}P</span>
                        <span className="text-xs text-slate-400">{w.bankName} · {w.accountHolder}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(w.createdAt)} 신청</p>
                      {/* [인출 #2] REJECTED면 거부 사유 표시 */}
                      {w.status === "REJECTED" && w.adminMemo && (
                        <p className="mt-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 text-xs text-red-400">
                          거부 사유: {w.adminMemo}
                        </p>
                      )}
                      {w.processedAt && (
                        <p className="mt-1 text-xs text-slate-600">처리일: {formatDate(w.processedAt)}</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {/* StatusBadge 인라인 */}
                      {w.status === "PENDING" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-semibold text-yellow-400">
                          <Clock className="h-3 w-3" /> 대기중
                        </span>
                      )}
                      {w.status === "APPROVED" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-400">
                          <CheckCircle className="h-3 w-3" /> 승인됨
                        </span>
                      )}
                      {w.status === "REJECTED" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
                          <XCircle className="h-3 w-3" /> 거부됨
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 포인트 적립 내역 */}
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-base font-bold text-white">포인트 적립 내역</h2>
          <span className="text-xs text-slate-500">총 {data?.history.length ?? 0}건</span>
        </div>

        {data?.history.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-slate-500">
            <ShoppingBag className="mb-3 h-10 w-10 text-slate-600" />
            <p className="text-sm">아직 포인트 적립 내역이 없습니다.</p>
            <p className="mt-1 text-xs text-slate-600">매칭된 광고주 사이트를 20초 방문하면 포인트가 지급됩니다.</p>
            <Link href="/dashboard" className="mt-4 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
              대시보드로 가기 →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.history.map((item, idx) => (
              <div key={item.intentId} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-slate-900 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-xs font-bold text-yellow-400">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white line-clamp-2">
                    &ldquo;{item.text}&rdquo;
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {item.category && (
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                        {item.category}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">{item.advertiserCompany}</span>
                    <span className="text-xs text-slate-600">{formatDate(item.earnedAt)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-lg font-black text-yellow-400">
                    +{item.rewardAmount.toLocaleString("ko-KR")}P
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900 p-4">
          <p className="text-xs font-semibold text-slate-400 mb-2">포인트 적립 안내</p>
          <ul className="space-y-1 text-xs text-slate-500">
            <li>• 매칭된 광고주 사이트에 20초 이상 체류 시 자동으로 포인트가 지급됩니다.</li>
            <li>• 광고주마다 방문당 지급 포인트(1~1,000P)가 다릅니다.</li>
            <li>• 동일한 검색의도에 대해 중복 적립은 불가합니다.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
