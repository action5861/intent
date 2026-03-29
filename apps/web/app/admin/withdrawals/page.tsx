"use client";

// [인출 #4] 어드민 인출 관리 페이지

import { useState, useEffect, useCallback } from "react";
import {
  Wallet, RefreshCw, CheckCircle, XCircle, Clock,
  Loader2, AlertTriangle,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-production-6df5.up.railway.app";

interface WithdrawalUser {
  id: string;
  name: string;
  email: string;
  rewardBalance: number;
}

interface WithdrawalRequest {
  id: string;
  userId: string;
  user: WithdrawalUser;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminMemo: string | null;
  processedAt: string | null;
  createdAt: string;
}

// [인출 #4] 어드민 fetch 헬퍼
async function adminFetch(path: string, opts: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  return fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
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
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // [인출 #4] 승인 확인 모달
  const [approveTarget, setApproveTarget] = useState<WithdrawalRequest | null>(null);

  // [인출 #4] 거부 사유 모달
  const [rejectTarget, setRejectTarget] = useState<WithdrawalRequest | null>(null);
  const [rejectMemo, setRejectMemo] = useState("");

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/withdrawals");
      if (res.ok) {
        setWithdrawals(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

  // [인출 #4] 승인 처리
  const handleApprove = async () => {
    if (!approveTarget) return;
    setActionLoading(approveTarget.id);
    try {
      const res = await adminFetch(`/api/admin/withdrawals/${approveTarget.id}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.message ?? "승인에 실패했습니다.", "error");
      } else {
        showToast("승인 처리되었습니다.", "success");
        setApproveTarget(null);
        await loadWithdrawals();
      }
    } catch {
      showToast("서버에 연결할 수 없습니다.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // [인출 #4] 거부 처리
  const handleReject = async () => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget.id);
    try {
      const res = await adminFetch(`/api/admin/withdrawals/${rejectTarget.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ memo: rejectMemo }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.message ?? "거부에 실패했습니다.", "error");
      } else {
        showToast("거부 처리되었습니다.", "success");
        setRejectTarget(null);
        setRejectMemo("");
        await loadWithdrawals();
      }
    } catch {
      showToast("서버에 연결할 수 없습니다.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = withdrawals.filter((w) => w.status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-green-400" />
          <div>
            <h1 className="text-xl font-bold text-white">인출 관리</h1>
            <p className="text-xs text-slate-500">
              전체 {withdrawals.length}건
              {pendingCount > 0 && (
                <span className="ml-2 font-semibold text-yellow-400">처리 대기 {pendingCount}건</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={loadWithdrawals}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
          toast.type === "success"
            ? "bg-green-600 text-white"
            : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* [인출 #4] 승인 확인 모달 */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/15">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">인출 승인</h2>
                <p className="text-xs text-slate-400">정말 승인하시겠습니까?</p>
              </div>
            </div>
            <div className="mb-5 rounded-xl border border-white/10 bg-slate-800 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">사용자</span>
                <span className="text-white font-medium">{approveTarget.user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">인출 금액</span>
                <span className="text-green-400 font-bold">{approveTarget.amount.toLocaleString("ko-KR")}P</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">현재 잔액</span>
                <span className={approveTarget.user.rewardBalance < approveTarget.amount ? "text-red-400 font-bold" : "text-white"}>
                  {approveTarget.user.rewardBalance.toLocaleString("ko-KR")}P
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">입금 정보</span>
                <span className="text-white">{approveTarget.bankName} {approveTarget.accountNumber} ({approveTarget.accountHolder})</span>
              </div>
            </div>
            {approveTarget.user.rewardBalance < approveTarget.amount && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                사용자 잔액이 부족합니다. 승인이 불가합니다.
              </div>
            )}
            <p className="mb-5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
              ⚠️ 승인 시 {approveTarget.amount.toLocaleString("ko-KR")}P가 차감되고{" "}
              {approveTarget.bankName} {approveTarget.accountNumber} ({approveTarget.accountHolder})로 송금해야 합니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setApproveTarget(null)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleApprove}
                disabled={!!actionLoading || approveTarget.user.rewardBalance < approveTarget.amount}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-40 transition-colors"
              >
                {actionLoading === approveTarget.id && <Loader2 className="h-4 w-4 animate-spin" />}
                승인하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [인출 #4] 거부 사유 모달 */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">인출 거부</h2>
                <p className="text-xs text-slate-400">{rejectTarget.user.name} · {rejectTarget.amount.toLocaleString("ko-KR")}P</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-400">거부 사유 (선택)</label>
              <textarea
                value={rejectMemo}
                onChange={(e) => setRejectMemo(e.target.value)}
                placeholder="거부 사유를 입력하세요. (예: 계좌 정보 불일치)"
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectTarget(null); setRejectMemo(""); }}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={!!actionLoading}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40 transition-colors"
              >
                {actionLoading === rejectTarget.id && <Loader2 className="h-4 w-4 animate-spin" />}
                거부하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [인출 #4] 인출 요청 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-20 text-slate-500">
          <Wallet className="mb-3 h-10 w-10 text-slate-600" />
          <p className="text-sm">인출 요청이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-slate-900/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">신청일</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">사용자</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400">금액</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">은행</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">계좌번호</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">예금주</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400">현재 보유P</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400">상태</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {withdrawals.map((w) => (
                <tr key={w.id} className="bg-slate-900 hover:bg-slate-800/50 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                    {formatDate(w.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white text-xs">{w.user.name}</div>
                    <div className="text-xs text-slate-500">{w.user.email}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-green-400">
                    {w.amount.toLocaleString("ko-KR")}P
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300">{w.bankName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300 font-mono">{w.accountNumber}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300">{w.accountHolder}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                    <span className={w.user.rewardBalance < w.amount ? "text-red-400 font-bold" : "text-slate-300"}>
                      {w.user.rewardBalance.toLocaleString("ko-KR")}P
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={w.status} />
                    {w.status === "REJECTED" && w.adminMemo && (
                      <p className="mt-1 text-xs text-slate-500 max-w-[120px] truncate" title={w.adminMemo}>
                        {w.adminMemo}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {w.status === "PENDING" ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setApproveTarget(w)}
                          disabled={!!actionLoading}
                          className="rounded-lg bg-green-600/20 border border-green-500/30 px-2.5 py-1 text-xs font-semibold text-green-400 hover:bg-green-600/40 disabled:opacity-40 transition-colors"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => { setRejectTarget(w); setRejectMemo(""); }}
                          disabled={!!actionLoading}
                          className="rounded-lg bg-red-600/20 border border-red-500/30 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-600/40 disabled:opacity-40 transition-colors"
                        >
                          거부
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600">
                        {w.processedAt ? formatDate(w.processedAt) : "-"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
