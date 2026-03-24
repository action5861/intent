"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "로그인에 실패했습니다.");

      localStorage.setItem("user_token", data.accessToken);
      localStorage.setItem("user_id", data.userId);
      localStorage.setItem("user_name", data.name);

      router.push("/intent");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-12 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/30">
          <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">로그인</h2>
        <p className="mt-2 text-center text-sm text-slate-400">Intendex 플랫폼에 오신 것을 환영합니다</p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium leading-6 text-slate-300">
              이메일 주소
            </label>
            <div className="mt-2">
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-md border-0 bg-white/5 py-1.5 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 placeholder-slate-500"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium leading-6 text-slate-300">
                비밀번호
              </label>
            </div>
            <div className="relative mt-2">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border-0 bg-white/5 py-1.5 px-3 pr-10 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 placeholder-slate-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-all disabled:opacity-50 overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] transition-transform duration-500 group-hover:translate-x-[100%]" />
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                로그인 중...
              </span>
            ) : "로그인"}
          </button>
        </form>

        <p className="mt-10 text-center text-sm text-slate-400">
          아직 계정이 없으신가요?{" "}
          <Link href="/register" className="font-semibold leading-6 text-blue-400 hover:text-blue-300 transition-colors">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
