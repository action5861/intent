"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle, PauseCircle, Trash2, RefreshCw, Search, PencilLine,
  X, Check, Plus, Globe, Loader2, Sparkles, BarChart2, KeyRound, Zap,
  ChevronDown, ChevronUp, Clock, Users, TrendingUp,
} from "lucide-react";
import { adminFetch } from "../useAdminFetch";

// [어드민개선 #4] 15개 고정 카테고리 상수
const CATEGORIES = [
  "전자기기", "패션", "식품", "여행", "부동산", "금융", "보험",
  "자동차", "뷰티", "교육", "의료", "법률", "쇼핑", "비영리", "기타",
];

type AdvertiserStatus = "ACTIVE" | "SUSPENDED" | "PENDING";
// [어드민매칭 #1] 상세 모달 탭 타입
type DetailTab = "info" | "matches";

// [어드민매칭 #1] 비식별 처리된 매칭 항목
interface MatchItem {
  id: string;
  enrichedText: string | null;
  category: string | null;
  expectedPrice: number | null;
  status: string;
  dwellTimeMs: number | null;
  paidReward: number | null;
  slaVerifiedAt: string | null;
  createdAt: string;
  user: { displayId: string };
}

// [어드민매칭 #1] 요약 통계
interface MatchSummary {
  totalMatches: number;
  slaVerified: number;
  avgDwellTimeMs: number;
  totalPaidReward: number;
}

interface AdminAdvertiser {
  id: string;
  company: string;
  contactName: string;
  email: string;
  category: string;
  keywords: string[];
  siteDescription: string | null;
  siteUrl: string | null;
  rewardPerVisit: number;
  totalBudget: number;
  remainingBudget: number;
  status: AdvertiserStatus;
  matchCount: number;
  joinedAt: string;
}

// [어드민개선 #1] 상세/수정 모달 편집 폼 타입
interface EditForm {
  company: string;
  category: string;
  keywords: string[];
  siteUrl: string;
  siteDescription: string;
  rewardPerVisit: string;
  totalBudget: string;
  remainingBudget: string;
  status: AdvertiserStatus;
}

const STATUS_STYLE: Record<AdvertiserStatus, string> = {
  ACTIVE: "bg-green-500/10 text-green-400 border-green-500/20",
  SUSPENDED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  PENDING: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};
const STATUS_LABEL: Record<AdvertiserStatus, string> = {
  ACTIVE: "활성", SUSPENDED: "정지", PENDING: "심사중",
};

const INPUT_CLS =
  "w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none";
const LABEL_CLS = "mb-1.5 block text-xs font-medium text-slate-400";

export default function AdminAdvertisersPage() {
  const [advertisers, setAdvertisers] = useState<AdminAdvertiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editBudget, setEditBudget] = useState<{ id: string; value: string } | null>(null);
  const [editReward, setEditReward] = useState<{ id: string; value: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    company: "", contactName: "", email: "", password: "",
    category: "", totalBudget: "", websiteUrl: "", rewardPerVisit: "500",
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<{ description: string; keywords: string[] } | null>(null);
  const [creating, setCreating] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [rematchResult, setRematchResult] = useState<number | null>(null);

  // [어드민개선 #1] 상세 모달 상태
  const [detailModal, setDetailModal] = useState<AdminAdvertiser | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);
  // [키워드관리 #2] 키워드 태그 입력 상태
  const [keywordInput, setKeywordInput] = useState("");
  // [어드민개선 #3] 비밀번호 초기화 상태
  const [resetPwConfirm, setResetPwConfirm] = useState(false);
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [resetPwSuccess, setResetPwSuccess] = useState(false);

  // [어드민매칭 #1] 탭 & 매칭 데이터 상태
  const [detailTab, setDetailTab] = useState<DetailTab>("info");
  const [detailMatches, setDetailMatches] = useState<MatchItem[]>([]);
  const [detailSummary, setDetailSummary] = useState<MatchSummary | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [expandedIntentId, setExpandedIntentId] = useState<string | null>(null);

  const fetchAdvertisers = () => {
    setLoading(true);
    adminFetch("/api/admin/advertisers")
      .then((r) => r.json())
      .then((data) => {
        setAdvertisers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchAdvertisers(); }, []);

  // [어드민매칭 #2] 매칭 내역 API 호출
  const loadMatches = async (advertiserId: string) => {
    setMatchesLoading(true);
    setDetailMatches([]);
    setDetailSummary(null);
    setExpandedIntentId(null);
    try {
      const res = await adminFetch(`/api/admin/advertisers/${advertiserId}/matches`);
      const data = await res.json();
      setDetailMatches(Array.isArray(data.matches) ? data.matches : []);
      setDetailSummary(data.summary ?? null);
    } catch {}
    setMatchesLoading(false);
  };

  const updateStatus = async (id: string, status: AdvertiserStatus) => {
    setActionLoading(id + status);
    await adminFetch(`/api/admin/advertisers/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setActionLoading(null);
    fetchAdvertisers();
  };

  const saveReward = async (id: string) => {
    const val = Math.min(Math.max(Number(editReward?.value) || 1, 1), 1000);
    setActionLoading(id + "reward");
    await adminFetch(`/api/admin/advertisers/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ rewardPerVisit: val }),
    });
    setActionLoading(null);
    setEditReward(null);
    fetchAdvertisers();
  };

  const saveBudget = async (id: string) => {
    const val = Number(editBudget?.value.replace(/,/g, ""));
    if (!val || val <= 0) return;
    setActionLoading(id + "budget");
    await adminFetch(`/api/admin/advertisers/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ totalBudget: val }),
    });
    setActionLoading(null);
    setEditBudget(null);
    fetchAdvertisers();
  };

  const deleteAdvertiser = async (id: string) => {
    setActionLoading(id + "delete");
    await adminFetch(`/api/admin/advertisers/${id}`, { method: "DELETE" });
    setActionLoading(null);
    setConfirmDelete(null);
    fetchAdvertisers();
  };

  const analyzeWebsite = async () => {
    if (!form.websiteUrl) return;
    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const res = await adminFetch("/api/admin/advertisers/analyze-site", {
        method: "POST",
        body: JSON.stringify({ url: form.websiteUrl }),
      });
      const data = await res.json();
      setForm((f) => ({
        ...f,
        category: data.category ?? f.category,
        company: f.company || data.suggestedCompany || f.company,
      }));
      setAnalyzeResult({ description: data.description, keywords: data.keywords });
    } catch {}
    setAnalyzing(false);
  };

  const createAdvertiser = async () => {
    if (!form.company || !form.email || !form.password || !form.category) return;
    setCreating(true);
    const res = await adminFetch("/api/admin/advertisers", {
      method: "POST",
      body: JSON.stringify({
        company: form.company,
        contactName: form.contactName,
        email: form.email,
        password: form.password,
        category: form.category,
        keywords: analyzeResult?.keywords ?? [],
        siteDescription: analyzeResult?.description ?? null,
        siteUrl: form.websiteUrl || null,
        rewardPerVisit: Math.min(Math.max(Number(form.rewardPerVisit) || 500, 1), 1000),
        totalBudget: Number(form.totalBudget) || 0,
      }),
    });
    setCreating(false);
    if (res.ok) {
      setShowModal(false);
      setForm({ company: "", contactName: "", email: "", password: "", category: "", totalBudget: "", websiteUrl: "", rewardPerVisit: "500" });
      setAnalyzeResult(null);
      fetchAdvertisers();
      adminFetch("/api/admin/intents/rematch-waiting", { method: "POST" }).catch(() => {});
    }
  };

  const triggerRematch = async () => {
    setRematching(true);
    setRematchResult(null);
    try {
      const res = await adminFetch("/api/admin/intents/rematch-waiting", { method: "POST" });
      const data = await res.json();
      setRematchResult(data.triggered ?? 0);
    } catch {
      setRematchResult(0);
    }
    setRematching(false);
  };

  // [어드민개선 #1] 상세 모달 열기 — initialTab으로 탭 지정 가능
  const openDetailModal = (adv: AdminAdvertiser, initialTab: DetailTab = "info") => {
    setDetailModal(adv);
    setDetailTab(initialTab);
    setEditForm({
      company: adv.company,
      category: adv.category,
      keywords: [...adv.keywords],
      siteUrl: adv.siteUrl ?? "",
      siteDescription: adv.siteDescription ?? "",
      rewardPerVisit: String(adv.rewardPerVisit),
      totalBudget: String(adv.totalBudget),
      remainingBudget: String(adv.remainingBudget),
      status: adv.status,
    });
    setEditSuccess(false);
    setKeywordInput("");
    setResetPwConfirm(false);
    setResetPwSuccess(false);
    // [어드민매칭 #2] 매칭 탭이면 즉시 로드
    if (initialTab === "matches") loadMatches(adv.id);
  };

  // [어드민매칭 #2] 탭 전환 — 매칭 탭 첫 진입 시 데이터 로드
  const switchTab = (tab: DetailTab) => {
    setDetailTab(tab);
    if (tab === "matches" && detailModal && detailMatches.length === 0 && !matchesLoading) {
      loadMatches(detailModal.id);
    }
  };

  // [키워드관리 #2] 키워드 추가 함수 (쉼표 구분 bulk 입력 지원)
  const addKeywords = () => {
    if (!keywordInput.trim() || !editForm) return;
    const newKws = keywordInput.split(",").map((k) => k.trim()).filter(Boolean);
    setEditForm((f) => f && { ...f, keywords: [...new Set([...f.keywords, ...newKws])] });
    setKeywordInput("");
  };

  // [어드민개선 #2] 상세 모달에서 저장
  const saveDetail = async () => {
    if (!detailModal || !editForm) return;
    setEditSaving(true);
    setEditSuccess(false);
    const res = await adminFetch(`/api/admin/advertisers/${detailModal.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        company: editForm.company,
        category: editForm.category,
        keywords: editForm.keywords,
        siteUrl: editForm.siteUrl || null,
        siteDescription: editForm.siteDescription || null,
        rewardPerVisit: Math.min(Math.max(Number(editForm.rewardPerVisit) || 1, 1), 1000),
        totalBudget: Number(editForm.totalBudget) || 0,
        remainingBudget: Number(editForm.remainingBudget) || 0,
        status: editForm.status,
      }),
    });
    setEditSaving(false);
    if (res.ok) {
      setEditSuccess(true);
      fetchAdvertisers();
    }
  };

  // [어드민개선 #3] 비밀번호 초기화
  const resetPassword = async () => {
    if (!detailModal) return;
    setResetPwLoading(true);
    setResetPwSuccess(false);
    const res = await adminFetch(`/api/admin/advertisers/${detailModal.id}/reset-password`, { method: "POST" });
    setResetPwLoading(false);
    if (res.ok) { setResetPwSuccess(true); setResetPwConfirm(false); }
  };

  const STATUS_MATCH_STYLE: Record<string, string> = {
    WAITING_MATCH: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    MATCHED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    SLA_VERIFIED: "bg-green-500/10 text-green-400 border-green-500/20",
  };
  const STATUS_MATCH_LABEL: Record<string, string> = {
    WAITING_MATCH: "매칭 대기",
    MATCHED: "매칭 완료",
    SLA_VERIFIED: "방문 완료",
  };

  const budgetPct = (adv: AdminAdvertiser) =>
    adv.totalBudget > 0
      ? Math.round(((adv.totalBudget - adv.remainingBudget) / adv.totalBudget) * 100)
      : 0;

  const filtered = advertisers.filter(
    (a) =>
      a.company.includes(search) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      a.category.includes(search),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">광고주 관리</h1>
          <p className="mt-1 text-sm text-slate-500">총 {advertisers.length}개사가 등록되어 있습니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAdvertisers}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            새로고침
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={triggerRematch}
              disabled={rematching}
              className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
            >
              {rematching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              대기 재매칭
            </button>
            {rematchResult !== null && (
              <span className="text-xs text-amber-400">{rematchResult}건 트리거됨</span>
            )}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            광고주 등록
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="회사명, 이메일, 카테고리로 검색"
          className="w-full rounded-xl border border-white/10 bg-slate-900 py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* [어드민개선 #1] 행 클릭 → 상세 모달 오픈 */}
      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-slate-900/60 text-left">
              {/* [키워드관리 #3] 키워드 열 추가 */}
              {["광고주", "카테고리", "키워드", "상태", "예산 현황", "총 예산", "방문 리워드", "매칭 수", "가입일", "액션"].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-slate-900">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(10)].map((__, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-4 animate-pulse rounded bg-slate-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-500">
                  {search ? "검색 결과가 없습니다." : "등록된 광고주가 없습니다."}
                </td>
              </tr>
            ) : (
              filtered.map((adv) => {
                const pct = budgetPct(adv);
                return (
                  <tr
                    key={adv.id}
                    onClick={() => openDetailModal(adv, "info")}
                    className="cursor-pointer transition-colors hover:bg-white/5"
                  >
                    <td className="px-4 py-4">
                      <p className="font-medium text-white">{adv.company}</p>
                      <p className="text-xs text-slate-400">{adv.contactName}</p>
                      <p className="text-xs text-slate-600">{adv.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                        {adv.category}
                      </span>
                      {adv.siteDescription && (
                        <p className="mt-1 max-w-[180px] truncate text-xs text-slate-500" title={adv.siteDescription}>
                          {adv.siteDescription}
                        </p>
                      )}
                    </td>
                    {/* [키워드관리 #3] 키워드 열: 3개까지 태그, 나머지 +N개 */}
                    <td className="px-4 py-4">
                      {adv.keywords?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {adv.keywords.slice(0, 3).map((k) => (
                            <span key={k} className="rounded-md bg-purple-500/10 px-1.5 py-0.5 text-xs text-purple-400">
                              {k}
                            </span>
                          ))}
                          {adv.keywords.length > 3 && (
                            <span className="rounded-md bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">
                              +{adv.keywords.length - 3}개
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[adv.status]}`}>
                        {STATUS_LABEL[adv.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="w-28">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-400">사용</span>
                          <span className={pct >= 90 ? "text-red-400" : pct >= 60 ? "text-amber-400" : "text-emerald-400"}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          잔여 {adv.remainingBudget.toLocaleString("ko-KR")}원
                        </p>
                      </div>
                    </td>
                    {/* 인라인 수정 셀은 클릭 이벤트 버블링 차단 */}
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      {editBudget?.id === adv.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={editBudget.value}
                            onChange={(e) => setEditBudget({ id: adv.id, value: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") saveBudget(adv.id); if (e.key === "Escape") setEditBudget(null); }}
                            className="w-24 rounded-lg border border-blue-500/50 bg-slate-800 px-2 py-1 text-xs text-white focus:outline-none"
                          />
                          <button onClick={() => saveBudget(adv.id)} className="text-green-400 hover:text-green-300">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setEditBudget(null)} className="text-slate-500 hover:text-white">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditBudget({ id: adv.id, value: String(adv.totalBudget) }); }}
                          className="group flex items-center gap-1 text-slate-300 hover:text-white"
                        >
                          <span className="text-sm">{adv.totalBudget.toLocaleString("ko-KR")}원</span>
                          <PencilLine className="h-3 w-3 text-slate-600 group-hover:text-blue-400" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      {editReward?.id === adv.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="number" min="1" max="1000"
                            value={editReward.value}
                            onChange={(e) => setEditReward({ id: adv.id, value: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") saveReward(adv.id); if (e.key === "Escape") setEditReward(null); }}
                            className="w-16 rounded-lg border border-blue-500/50 bg-slate-800 px-2 py-1 text-xs text-white focus:outline-none"
                          />
                          <span className="text-xs text-slate-400">P</span>
                          <button onClick={() => saveReward(adv.id)} className="text-green-400 hover:text-green-300"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setEditReward(null)} className="text-slate-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditReward({ id: adv.id, value: String(adv.rewardPerVisit) }); }}
                          className="group flex items-center gap-1 text-yellow-400 hover:text-yellow-300"
                        >
                          <span className="text-sm font-bold">{adv.rewardPerVisit}P</span>
                          <PencilLine className="h-3 w-3 text-slate-600 group-hover:text-yellow-400" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-4 font-medium text-purple-400">{adv.matchCount.toLocaleString("ko-KR")}건</td>
                    <td className="px-4 py-4 text-slate-500">
                      {new Date(adv.joinedAt).toLocaleDateString("ko-KR")}
                    </td>
                    {/* 액션 버튼 셀 */}
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {/* [어드민매칭 #1] 매칭 버튼 → 상세 모달 매칭 탭으로 직접 이동 */}
                        <button
                          onClick={() => openDetailModal(adv, "matches")}
                          title="매칭 결과"
                          className="flex items-center gap-1 rounded-lg bg-blue-500/10 px-2 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors"
                        >
                          <BarChart2 className="h-3.5 w-3.5" />
                          매칭
                        </button>
                        {adv.status !== "ACTIVE" && (
                          <button
                            onClick={() => updateStatus(adv.id, "ACTIVE")}
                            disabled={!!actionLoading}
                            title="활성화"
                            className="rounded-lg bg-green-500/10 p-1.5 text-green-400 hover:bg-green-500/20 disabled:opacity-40 transition-colors"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {adv.status !== "SUSPENDED" && (
                          <button
                            onClick={() => updateStatus(adv.id, "SUSPENDED")}
                            disabled={!!actionLoading}
                            title="정지"
                            className="rounded-lg bg-amber-500/10 p-1.5 text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
                          >
                            <PauseCircle className="h-4 w-4" />
                          </button>
                        )}
                        {confirmDelete === adv.id ? (
                          <span className="flex items-center gap-1 text-xs">
                            <button
                              onClick={() => deleteAdvertiser(adv.id)}
                              disabled={!!actionLoading}
                              className="rounded-lg bg-red-600 px-2 py-1 text-white hover:bg-red-500 disabled:opacity-40 transition-colors"
                            >
                              확인
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-lg bg-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-600 transition-colors"
                            >
                              취소
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(adv.id)}
                            title="삭제"
                            className="rounded-lg bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── 광고주 등록 모달 ─────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">광고주 등록</h2>
              <button onClick={() => { setShowModal(false); setAnalyzeResult(null); }} className="text-slate-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={LABEL_CLS}>광고주 웹사이트 URL</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={form.websiteUrl}
                      onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                      placeholder="https://example.com"
                      className="w-full rounded-xl border border-white/10 bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={analyzeWebsite}
                    disabled={!form.websiteUrl || analyzing}
                    className="flex items-center gap-1.5 rounded-xl bg-purple-600/80 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-40 transition-colors"
                  >
                    {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    AI 분석
                  </button>
                </div>
                {analyzeResult && (
                  <div className="mt-2 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                    <p className="text-xs text-purple-300">{analyzeResult.description}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {analyzeResult.keywords.map((k) => (
                        <span key={k} className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>회사명 *</label>
                  <input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>담당자명</label>
                  <input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} className={INPUT_CLS} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>이메일 *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>비밀번호 *</label>
                  <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={INPUT_CLS} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>카테고리 *</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={INPUT_CLS}>
                    <option value="">선택하세요</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>방문당 리워드 (1~1,000P)</label>
                  <input type="number" min="1" max="1000" value={form.rewardPerVisit}
                    onChange={(e) => setForm((f) => ({ ...f, rewardPerVisit: e.target.value }))}
                    placeholder="500" className={INPUT_CLS} />
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>초기 예산 (원)</label>
                <input type="number" value={form.totalBudget}
                  onChange={(e) => setForm((f) => ({ ...f, totalBudget: e.target.value }))}
                  placeholder="0" className={INPUT_CLS} />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowModal(false); setAnalyzeResult(null); }}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">
                취소
              </button>
              <button
                onClick={createAdvertiser}
                disabled={!form.company || !form.email || !form.password || !form.category || creating}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                등록하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── [어드민개선 #1/#2/#3 + 어드민매칭 #1] 광고주 상세 모달 (탭) ─── */}
      {detailModal && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="flex w-full max-w-5xl flex-col rounded-2xl border border-white/10 bg-slate-900 shadow-2xl" style={{ maxHeight: "92vh" }}>

            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-white">{detailModal.company} 상세 정보</h2>
                <p className="mt-0.5 text-xs text-slate-500">{detailModal.email} · 가입 {new Date(detailModal.joinedAt).toLocaleDateString("ko-KR")}</p>
              </div>
              <button onClick={() => setDetailModal(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* [어드민매칭 #1] 탭 헤더 */}
            <div className="flex border-b border-white/10 px-6">
              <button
                onClick={() => switchTab("info")}
                className={`py-3 pr-4 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  detailTab === "info"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                정보 수정
              </button>
              <button
                onClick={() => switchTab("matches")}
                className={`py-3 px-4 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
                  detailTab === "matches"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                매칭 내역
                <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
                  {detailModal.matchCount}
                </span>
              </button>
            </div>

            {/* ── 정보 수정 탭 ── */}
            {detailTab === "info" && (
              <>
                <div className="overflow-y-auto px-6 py-5 flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* [어드민개선 #2] 회사명 수정 */}
                    <div>
                      <label className={LABEL_CLS}>회사명</label>
                      <input value={editForm.company}
                        onChange={(e) => setEditForm((f) => f && { ...f, company: e.target.value })}
                        className={INPUT_CLS} />
                    </div>
                    {/* [어드민개선 #4] 카테고리 드롭다운 */}
                    <div>
                      <label className={LABEL_CLS}>카테고리</label>
                      <select value={editForm.category}
                        onChange={(e) => setEditForm((f) => f && { ...f, category: e.target.value })}
                        className={INPUT_CLS}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* [키워드관리 #2] 키워드 태그 편집 UI */}
                  <div>
                    <label className={LABEL_CLS}>
                      키워드{" "}
                      <span className="text-slate-600 font-normal">({editForm.keywords.length}개)</span>
                    </label>
                    <div className="mb-2 flex min-h-[38px] flex-wrap gap-1.5 rounded-xl border border-white/10 bg-slate-800 p-2">
                      {editForm.keywords.length === 0 && (
                        <span className="text-xs text-slate-600">키워드를 추가해주세요</span>
                      )}
                      {editForm.keywords.map((k, i) => (
                        <span key={i} className="flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                          {k}
                          <button type="button"
                            onClick={() => setEditForm((f) => f && { ...f, keywords: f.keywords.filter((_, j) => j !== i) })}
                            className="text-purple-400/50 hover:text-purple-300 transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeywords(); } }}
                        placeholder="화장품, 스킨케어, 로션 (쉼표로 여러 개)"
                        className={INPUT_CLS}
                      />
                      <button type="button" onClick={addKeywords}
                        className="flex items-center gap-1 rounded-xl bg-purple-600/80 px-3 py-2 text-sm text-white hover:bg-purple-500 transition-colors whitespace-nowrap">
                        <Plus className="h-4 w-4" />
                        추가
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={LABEL_CLS}>사이트 URL</label>
                    <input value={editForm.siteUrl}
                      onChange={(e) => setEditForm((f) => f && { ...f, siteUrl: e.target.value })}
                      placeholder="https://example.com" className={INPUT_CLS} />
                  </div>

                  <div>
                    <label className={LABEL_CLS}>사이트 설명</label>
                    <textarea value={editForm.siteDescription}
                      onChange={(e) => setEditForm((f) => f && { ...f, siteDescription: e.target.value })}
                      rows={3} placeholder="주요 기능 및 서비스 설명"
                      className="w-full resize-none rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={LABEL_CLS}>방문당 리워드 (P)</label>
                      <input type="number" min="1" max="1000" value={editForm.rewardPerVisit}
                        onChange={(e) => setEditForm((f) => f && { ...f, rewardPerVisit: e.target.value })} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>총 예산 (원)</label>
                      <input type="number" min="0" value={editForm.totalBudget}
                        onChange={(e) => setEditForm((f) => f && { ...f, totalBudget: e.target.value })} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>잔여 예산 (원)</label>
                      <input type="number" min="0" value={editForm.remainingBudget}
                        onChange={(e) => setEditForm((f) => f && { ...f, remainingBudget: e.target.value })} className={INPUT_CLS} />
                    </div>
                  </div>

                  <div>
                    <label className={LABEL_CLS}>상태</label>
                    <select value={editForm.status}
                      onChange={(e) => setEditForm((f) => f && { ...f, status: e.target.value as AdvertiserStatus })}
                      className={INPUT_CLS}>
                      <option value="ACTIVE">활성 (ACTIVE)</option>
                      <option value="SUSPENDED">정지 (SUSPENDED)</option>
                      <option value="PENDING">심사중 (PENDING)</option>
                    </select>
                  </div>

                  {/* [어드민개선 #3] 비밀번호 초기화 영역 */}
                  <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-amber-400" />
                          비밀번호 초기화
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          비밀번호를 <span className="text-amber-400 font-mono">advertiser1234!</span> 로 초기화합니다
                        </p>
                      </div>
                      {resetPwSuccess ? (
                        <span className="flex items-center gap-1.5 text-xs text-green-400">
                          <Check className="h-4 w-4" /> 초기화 완료
                        </span>
                      ) : resetPwConfirm ? (
                        <div className="flex items-center gap-2">
                          <button onClick={resetPassword} disabled={resetPwLoading}
                            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-40 transition-colors">
                            {resetPwLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                            확인
                          </button>
                          <button onClick={() => setResetPwConfirm(false)}
                            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                            취소
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setResetPwConfirm(true)}
                          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/20 transition-colors">
                          초기화
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
                  {editSuccess ? (
                    <span className="flex items-center gap-1.5 text-sm text-green-400">
                      <Check className="h-4 w-4" /> 저장되었습니다
                    </span>
                  ) : <span />}
                  <div className="flex gap-3">
                    <button onClick={() => setDetailModal(null)}
                      className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">
                      닫기
                    </button>
                    <button onClick={saveDetail} disabled={editSaving}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 transition-colors">
                      {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                      저장
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── [어드민매칭 #2] 매칭 내역 탭 ── */}
            {detailTab === "matches" && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {matchesLoading ? (
                  <div className="flex flex-1 items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                  </div>
                ) : (
                  <>
                    {/* [어드민매칭 #2] 요약 카드 4개 */}
                    {detailSummary && (
                      <div className="grid grid-cols-4 gap-3 border-b border-white/10 px-6 py-4">
                        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-3 text-center">
                          <Users className="mx-auto mb-1 h-4 w-4 text-blue-400" />
                          <p className="text-lg font-bold text-white">{detailSummary.totalMatches}</p>
                          <p className="text-xs text-slate-500">총 매칭</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-3 text-center">
                          <TrendingUp className="mx-auto mb-1 h-4 w-4 text-green-400" />
                          <p className="text-lg font-bold text-green-400">
                            {detailSummary.slaVerified}
                            <span className="ml-1 text-xs text-slate-400">
                              ({detailSummary.totalMatches > 0
                                ? Math.round((detailSummary.slaVerified / detailSummary.totalMatches) * 100)
                                : 0}%)
                            </span>
                          </p>
                          <p className="text-xs text-slate-500">SLA 달성</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-3 text-center">
                          <Clock className="mx-auto mb-1 h-4 w-4 text-purple-400" />
                          <p className="text-lg font-bold text-purple-400">
                            {detailSummary.avgDwellTimeMs > 0
                              ? (detailSummary.avgDwellTimeMs / 1000).toFixed(1)
                              : "-"}
                            <span className="ml-0.5 text-xs text-slate-400">초</span>
                          </p>
                          <p className="text-xs text-slate-500">평균 체류</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-3 text-center">
                          <Zap className="mx-auto mb-1 h-4 w-4 text-yellow-400" />
                          <p className="text-lg font-bold text-yellow-400">
                            {detailSummary.totalPaidReward.toLocaleString("ko-KR")}
                            <span className="ml-0.5 text-xs text-slate-400">P</span>
                          </p>
                          <p className="text-xs text-slate-500">총 지급</p>
                        </div>
                      </div>
                    )}

                    {/* [어드민매칭 #3] 매칭 테이블 */}
                    {detailMatches.length === 0 ? (
                      <div className="flex-1 py-12 text-center text-sm text-slate-500">매칭된 의도가 없습니다.</div>
                    ) : (
                      <div className="overflow-y-auto flex-1" style={{ maxHeight: "520px" }}>
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 border-b border-white/10 bg-slate-900">
                            <tr>
                              {["사용자", "의도 내용", "카테고리", "예상 단가", "상태", "체류시간", "지급P", "매칭 체결 시간"].map((h) => (
                                <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {detailMatches.map((m) => (
                              <React.Fragment key={m.id}>
                                <tr className="transition-colors hover:bg-white/5">
                                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-slate-400">
                                    {m.user.displayId}
                                  </td>
                                  {/* [어드민매칭 #3] 의도 내용 클릭 시 전체 텍스트 펼침 */}
                                  <td className="max-w-[180px] px-3 py-2.5">
                                    <div
                                      className="flex cursor-pointer items-start gap-1"
                                      onClick={() => setExpandedIntentId(expandedIntentId === m.id ? null : m.id)}
                                    >
                                      <span className={`text-slate-200 ${expandedIntentId === m.id ? "" : "line-clamp-1"}`}>
                                        {m.enrichedText ?? "-"}
                                      </span>
                                      {m.enrichedText && m.enrichedText.length > 35 && (
                                        expandedIntentId === m.id
                                          ? <ChevronUp className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />
                                          : <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />
                                      )}
                                    </div>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5">
                                    {m.category
                                      ? <span className="rounded-md bg-slate-700 px-1.5 py-0.5 text-slate-300">{m.category}</span>
                                      : <span className="text-slate-600">-</span>}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-blue-400">
                                    {m.expectedPrice != null ? m.expectedPrice.toLocaleString("ko-KR") + "원" : "-"}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5">
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${STATUS_MATCH_STYLE[m.status] ?? "border-slate-600 bg-slate-700 text-slate-400"}`}>
                                      {STATUS_MATCH_LABEL[m.status] ?? m.status}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5">
                                    {m.dwellTimeMs != null ? (
                                      <span className={m.dwellTimeMs >= 20000 ? "font-semibold text-green-400" : "text-red-400"}>
                                        {(m.dwellTimeMs / 1000).toFixed(1)}초
                                      </span>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-yellow-400">
                                    {m.paidReward != null ? m.paidReward.toLocaleString("ko-KR") + "P" : "-"}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">
                                    {new Date(m.createdAt).toLocaleString("ko-KR", {
                                      year: "2-digit", month: "2-digit", day: "2-digit",
                                      hour: "2-digit", minute: "2-digit",
                                    })}
                                  </td>
                                </tr>
                                {/* [어드민매칭 #3] 펼침 행 */}
                                {expandedIntentId === m.id && m.enrichedText && (
                                  <tr>
                                    <td colSpan={8} className="bg-slate-800/50 px-3 py-3">
                                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{m.enrichedText}</p>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-end border-t border-white/10 px-6 py-4">
                  <button onClick={() => setDetailModal(null)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">
                    닫기
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
