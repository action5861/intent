"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Bot, Send, ArrowRight, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ChatState = "chatting" | "ready" | "submitting" | "done";

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content: "안녕하세요! 무엇을 찾고 계신가요? 편하게 말씀해 주세요. 제가 당신의 의도를 자산화해 드리겠습니다.",
};

export default function IntentPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<ChatState>("chatting");
  const [enrichedText, setEnrichedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const id = localStorage.getItem("user_id");
    if (!id) {
      router.replace("/login");
    } else {
      setUserId(id);
    }
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (state === "chatting" && !isLoading) {
      inputRef.current?.focus();
    }
  }, [state, isLoading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || state !== "chatting" || isLoading) return;

    const userMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const token = localStorage.getItem("user_token");
      const res = await fetch(`${API_URL}/api/intents/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      const data = await res.json();

      const aiMessage: Message = { role: "assistant", content: data.message };
      setMessages((prev) => [...prev, aiMessage]);

      if (data.type === "ready") {
        setEnrichedText(data.enrichedText ?? text);
        setState("ready");
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `죄송합니다. 오류가 발생했습니다: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setState("submitting");

    try {
      const rawText = messages.find((m) => m.role === "user")?.content ?? enrichedText;
      const token = localStorage.getItem("user_token");
      const res = await fetch(`${API_URL}/api/intents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ rawText, enrichedText }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.message ?? `서버 오류: ${res.status}`;
        setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
        setState("ready");
        return;
      }

      setState("done");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `등록 중 오류가 발생했습니다: ${err.message}` },
      ]);
      setState("ready");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-white/10 bg-slate-950/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-400" />
          <span className="text-xl font-bold tracking-tight">Intendex</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
            내 대시보드
          </Link>
          <div className="hidden items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-sm font-medium text-green-400 sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            Real-time Matching Active
          </div>
        </div>
      </header>

      {/* Chat container */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            의도 등록하기
          </h1>
          <p className="mt-1 text-sm text-slate-500">AI와 대화하며 당신의 의도를 구체화하세요</p>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar */}
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600/20 border border-blue-500/30">
                  <Bot className="h-4 w-4 text-blue-400" />
                </div>
              )}
              {/* Bubble */}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                  ? "rounded-tr-sm bg-blue-600 text-white"
                  : "rounded-tl-sm bg-slate-800 text-slate-100 border border-white/5"
                  }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600/20 border border-blue-500/30">
                <Bot className="h-4 w-4 text-blue-400" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-slate-800 border border-white/5 px-4 py-3">
                <span className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}

          {/* Ready state: Submit button */}
          {state === "ready" && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-emerald-600 px-8 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-105 hover:shadow-blue-500/40"
              >
                <Sparkles className="h-4 w-4" />
                지금 바로 등록하기
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Done state */}
          {state === "done" && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-6 py-3 text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">의도가 성공적으로 등록되었습니다!</span>
              </div>
              <p className="text-sm text-slate-500">대시보드로 이동 중...</p>
            </div>
          )}

          {state === "submitting" && (
            <div className="flex justify-center pt-2">
              <div className="flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-6 py-3 text-blue-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                <span className="text-sm font-medium">AI가 분석 후 등록 중...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        {state === "chatting" && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요..."
              disabled={isLoading}
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-all hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mt-4 text-center">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            내 의도 내역 확인하기
          </Link>
        </div>
      </main>
    </div>
  );
}
