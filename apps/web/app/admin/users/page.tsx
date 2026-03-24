"use client";

import { useEffect, useState } from "react";
import { UserCheck, UserX, Trash2, RefreshCw, Search, ChevronDown, ChevronUp, Clock, CheckCircle2, Bot } from "lucide-react";
import { adminFetch } from "../useAdminFetch";

type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  totalIntents: number;
  rewardBalance: number;
  joinedAt: string;
}

interface Intent {
  id: string;
  rawText: string;
  enrichedText: string | null;
  category: string | null;
  expectedPrice: number | null;
  status: string;
  createdAt: string;
}

const STATUS_STYLE: Record<UserStatus, string> = {
  ACTIVE: "bg-green-500/10 text-green-400 border-green-500/20",
  SUSPENDED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  BANNED: "bg-red-500/10 text-red-400 border-red-500/20",
};
const STATUS_LABEL: Record<UserStatus, string> = { ACTIVE: "활성", SUSPENDED: "정지", BANNED: "차단" };

const INTENT_STATUS_CONFIG: Record<string, { label: string; style: string; icon: React.ElementType }> = {
  WAITING_MATCH: { label: "매칭 대기", style: "text-amber-400", icon: Clock },
  MATCHED: { label: "매칭 완료", style: "text-green-400", icon: CheckCircle2 },
  SLA_VERIFIED: { label: "정산 완료", style: "text-blue-400", icon: CheckCircle2 },
};

function IntentStatusBadge({ status }: { status: string }) {
  const cfg = INTENT_STATUS_CONFIG[status] ?? { label: status, style: "text-slate-400", icon: Bot };
  const Icon = cfg.icon;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${cfg.style}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function UserIntentsRow({ userId }: { userId: string }) {
  const [intents, setIntents] = useState<Intent[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch(`/api/admin/users/${userId}/intents`)
      .then((r) => r.json())
      .then((data) => { setIntents(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId]);

  return (
    <tr>
      <td colSpan={6} className="bg-slate-950 px-4 pb-4 pt-2">
        <div className="rounded-xl border border-white/5 bg-slate-900 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">등록 내역</p>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-800" />)}
            </div>
          ) : !intents || intents.length === 0 ? (
            <p className="text-sm text-slate-600">등록 내역이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {intents.map((intent) => (
                <div key={intent.id} className="flex items-start justify-between gap-4 rounded-lg border border-white/5 bg-slate-800 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">
                      {intent.enrichedText ?? intent.rawText}
                    </p>
                    <div className="mt-1 flex items-center gap-3">
                      {intent.category && (
                        <span className="rounded-md bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
                          {intent.category}
                        </span>
                      )}
                      <span className="text-xs text-slate-600">
                        {new Date(intent.createdAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <IntentStatusBadge status={intent.status} />
                    {intent.expectedPrice != null && (
                      <span className="text-xs font-medium text-blue-400">
                        {intent.expectedPrice.toLocaleString("ko-KR")}원
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const fetchUsers = () => {
    setLoading(true);
    adminFetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => { setUsers(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateStatus = async (id: string, status: UserStatus) => {
    setActionLoading(id + status);
    await adminFetch(`/api/admin/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setActionLoading(null);
    fetchUsers();
  };

  const deleteUser = async (id: string) => {
    setActionLoading(id + "delete");
    await adminFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    setActionLoading(null);
    setConfirmDelete(null);
    if (expandedUser === id) setExpandedUser(null);
    fetchUsers();
  };

  const toggleExpand = (id: string) => {
    setExpandedUser((prev) => (prev === id ? null : id));
  };

  const filtered = users.filter(
    (u) =>
      u.name.includes(search) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.id.includes(search),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">사용자 관리</h1>
          <p className="mt-1 text-sm text-slate-500">총 {users.length}명의 사용자가 등록되어 있습니다.</p>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          새로고침
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, 이메일, ID로 검색"
          className="w-full rounded-xl border border-white/10 bg-slate-900 py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-slate-900/60 text-left">
              {["사용자", "상태", "등록 수", "리워드 잔액", "가입일", "액션"].map((h) => (
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
                  {[...Array(6)].map((__, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-4 animate-pulse rounded bg-slate-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  {search ? "검색 결과가 없습니다." : "등록된 사용자가 없습니다."}
                </td>
              </tr>
            ) : (
              filtered.flatMap((user) => {
                const isExpanded = expandedUser === user.id;
                return [
                  <tr
                    key={user.id}
                    className={`transition-colors hover:bg-white/5 ${isExpanded ? "bg-white/5" : ""}`}
                  >
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleExpand(user.id)}
                        className="flex items-start gap-2 text-left"
                      >
                        {isExpanded
                          ? <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                          : <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                        }
                        <div>
                          <p className="font-medium text-white">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                          <p className="text-xs text-slate-600">{user.id}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[user.status]}`}>
                        {STATUS_LABEL[user.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-300">{user.totalIntents}건</td>
                    <td className="px-4 py-4 font-medium text-amber-400">
                      {user.rewardBalance.toLocaleString("ko-KR")}P
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {new Date(user.joinedAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {user.status !== "ACTIVE" && (
                          <button
                            onClick={() => updateStatus(user.id, "ACTIVE")}
                            disabled={!!actionLoading}
                            title="활성화"
                            className="rounded-lg bg-green-500/10 p-1.5 text-green-400 hover:bg-green-500/20 disabled:opacity-40 transition-colors"
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}
                        {user.status !== "SUSPENDED" && (
                          <button
                            onClick={() => updateStatus(user.id, "SUSPENDED")}
                            disabled={!!actionLoading}
                            title="정지"
                            className="rounded-lg bg-amber-500/10 p-1.5 text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        )}
                        {confirmDelete === user.id ? (
                          <span className="flex items-center gap-1 text-xs">
                            <button
                              onClick={() => deleteUser(user.id)}
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
                            onClick={() => setConfirmDelete(user.id)}
                            title="삭제"
                            className="rounded-lg bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>,
                  ...(isExpanded ? [<UserIntentsRow key={`${user.id}-intents`} userId={user.id} />] : []),
                ];
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
