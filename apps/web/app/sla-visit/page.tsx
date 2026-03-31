"use client";

import { useEffect, useRef, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, Sparkles, Gift } from "lucide-react";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-production-6df5.up.railway.app";
const REQUIRED_MS = 20000;

type Phase = "visiting" | "verifying" | "rewarded" | "done" | "error" | "already_done";

function SlaVisitInner() {
  const params = useSearchParams();
  const router = useRouter();

  const intentId = params.get("intentId") ?? "";
  const siteUrl = params.get("siteUrl") ?? "";
  const rewardPoints = Number(params.get("reward") ?? 0);

  const [phase, setPhase] = useState<Phase>("visiting");
  const [elapsed, setElapsed] = useState(0);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clickTimestampRef = useRef(Date.now());
  const slaVerifiedRef = useRef(false);
  const verifiedIntentIdRef = useRef<string>("");

  // 광고주 탭에 있는 동안만 누적 — SLA 페이지 visible 시 카운팅 중단
  const accumulatedMsRef = useRef<number>(0);
  const hiddenAtRef = useRef<number | null>(null);

  const getElapsedMs = useCallback(() => {
    const inProgress = hiddenAtRef.current !== null ? Date.now() - hiddenAtRef.current : 0;
    return accumulatedMsRef.current + inProgress;
  }, []);

  const sendFinalDwellTime = useCallback(() => {
    if (!slaVerifiedRef.current || !verifiedIntentIdRef.current) return;
    const token = localStorage.getItem("user_token");
    if (!token) return;
    const payload = JSON.stringify({ intentId: verifiedIntentIdRef.current, finalDwellTimeMs: getElapsedMs() });
    fetch(`${API_URL}/api/sla/update-duration`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [getElapsedMs]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    accumulatedMsRef.current = 0;
    hiddenAtRef.current = null;
    clickTimestampRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const ms = getElapsedMs();
      setElapsed(ms);
      if (ms >= REQUIRED_MS && !slaVerifiedRef.current) {
        verifySla(ms);
      }
    }, 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTimer, getElapsedMs]);

  useEffect(() => {
    if (!intentId || !siteUrl) {
      router.replace("/dashboard");
      return;
    }

    window.open(siteUrl, "_blank", "noopener,noreferrer");
    startTimer();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // 광고주 탭으로 전환 — 누적 시작
        hiddenAtRef.current = Date.now();
      } else {
        // SLA 페이지로 복귀 — 누적 중단
        if (hiddenAtRef.current !== null) {
          accumulatedMsRef.current += Date.now() - hiddenAtRef.current;
          hiddenAtRef.current = null;
        }
        sendFinalDwellTime();
      }
    };

    const handleBeforeUnload = () => sendFinalDwellTime();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentId, siteUrl]);

  const verifySla = async (actualElapsedMs: number) => {
    slaVerifiedRef.current = true; // 중복 호출 방지
    setPhase("verifying");
    const token = localStorage.getItem("user_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      // [임시] reCAPTCHA 검증 완전 스킵 — Enterprise 연동 후 복원
      const recaptchaToken = 'dev-bypass';

      const res = await fetch(`${API_URL}/api/sla/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          transactionId: intentId,
          // [체류시간 #1] 실제 경과시간 전송 (하드코딩 제거)
          accumulatedTimeMs: actualElapsedMs,
          timestamp: Date.now(),
          clickTimestamp: clickTimestampRef.current,
          recaptchaToken,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setRewardAmount(data.data?.rewardAmount ?? 0);
        verifiedIntentIdRef.current = intentId;
        stopTimer();
        setPhase("rewarded");
      } else if (res.status === 409) {
        setPhase("already_done");
      } else {
        slaVerifiedRef.current = false; // 실패 시 재시도 허용
        setErrorMsg(data.message ?? "검증에 실패했습니다.");
        setPhase("error");
      }
    } catch {
      slaVerifiedRef.current = false;
      setErrorMsg("서버에 연결할 수 없습니다.");
      setPhase("error");
    }
  };

  // [체류시간 #1] "대시보드로 이동" 버튼 — 클릭 시 최종 체류시간 전송 후 이동
  const handleGoToDashboard = () => {
    sendFinalDwellTime();
    stopTimer();
    router.push("/dashboard");
  };

  const progress = Math.min((elapsed / REQUIRED_MS) * 100, 100);
  const remaining = Math.max(0, Math.ceil((REQUIRED_MS - elapsed) / 1000));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-400" />
          <span className="text-lg font-bold text-white">Intendex</span>
        </div>

        {phase === "visiting" && (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-8 text-center">
            <div className="mb-2 text-4xl font-black text-white">{remaining}초</div>
            <p className="mb-6 text-sm text-slate-400">
              광고주 사이트가 새 탭에서 열렸습니다.<br />
              <span className="text-blue-400 font-medium">20초 후</span> 리워드 포인트가 자동으로 지급됩니다.
            </p>

            <div className="mb-6 h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            {rewardPoints > 0 && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                <p className="text-xs text-slate-400">20초 체류 시 지급 리워드</p>
                <p className="mt-1 text-xl font-bold text-blue-400">
                  +{rewardPoints.toLocaleString("ko-KR")}P
                </p>
              </div>
            )}

            <p className="mt-4 text-xs text-slate-600">
              새 탭이 열리지 않았다면{" "}
              <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
                여기를 클릭하세요
              </a>
            </p>
          </div>
        )}

        {phase === "verifying" && (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-8 text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-blue-400" />
            <p className="text-white font-medium">리워드 검증 중...</p>
            <p className="mt-2 text-sm text-slate-400">잠시만 기다려주세요.</p>
          </div>
        )}

        {/* [체류시간 #1] 적립 완료 후 계속 체류 중 UI */}
        {phase === "rewarded" && (
          <div className="rounded-2xl border border-green-500/20 bg-slate-900 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <Gift className="h-8 w-8 text-green-400" />
            </div>
            <p className="text-xl font-bold text-white mb-1">리워드 적립 완료!</p>
            <p className="mb-4 text-sm text-slate-400">20초 체류 조건이 달성되었습니다.</p>
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-6 py-4 mb-4">
              <p className="text-xs text-slate-400">획득한 리워드 포인트</p>
              <p className="mt-1 text-3xl font-black text-green-400">+{rewardAmount.toLocaleString("ko-KR")}P</p>
            </div>
            <button
              onClick={handleGoToDashboard}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
            >
              대시보드에서 확인하기
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="rounded-2xl border border-green-500/20 bg-slate-900 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <Gift className="h-8 w-8 text-green-400" />
            </div>
            <p className="text-xl font-bold text-white mb-1">리워드 지급 완료!</p>
            <p className="mb-4 text-sm text-slate-400">20초 체류 조건이 달성되었습니다.</p>
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-6 py-4 mb-6">
              <p className="text-xs text-slate-400">획득한 리워드 포인트</p>
              <p className="mt-1 text-3xl font-black text-green-400">+{rewardAmount.toLocaleString("ko-KR")}P</p>
            </div>
            <button
              onClick={handleGoToDashboard}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
            >
              대시보드에서 확인하기
            </button>
          </div>
        )}

        {phase === "already_done" && (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-purple-400" />
            <p className="text-white font-medium">이미 정산 완료된 의도입니다.</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-6 w-full rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              대시보드로 돌아가기
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="rounded-2xl border border-red-500/20 bg-slate-900 p-8 text-center">
            <p className="mb-2 text-white font-medium">검증 실패</p>
            <p className="mb-6 text-sm text-red-400">{errorMsg}</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPhase("visiting");
                  setElapsed(0);
                  window.open(siteUrl, "_blank", "noopener,noreferrer");
                  startTimer();
                }}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
              >
                다시 시도
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-slate-300 hover:text-white transition-colors"
              >
                대시보드로
              </button>
            </div>
          </div>
        )}

        {siteUrl && (phase === "visiting" || phase === "rewarded") && (
          <div className="mt-4 flex items-center justify-center gap-1 text-xs text-slate-600">
            <ExternalLink className="h-3 w-3" />
            <span>방문 중: {siteUrl}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SlaVisitPage() {
  return (
    <Suspense>
      <SlaVisitInner />
    </Suspense>
  );
}
