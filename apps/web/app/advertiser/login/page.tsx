"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AdvertiserLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/auth/advertiser/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? "로그인에 실패했습니다.");
        return;
      }

      const data = await res.json();
      localStorage.setItem("advertiser_token", data.accessToken);
      localStorage.setItem("advertiser_id", data.advertiserId);
      localStorage.setItem("advertiser_company", data.company);
      router.replace("/advertiser/dashboard");
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-400" />
            <span className="text-2xl font-bold text-white">Intendex</span>
          </div>
          <p className="text-sm text-slate-400">광고주 전용 로그인</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              placeholder="advertiser@example.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 border border-red-500/20">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-40 transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}
