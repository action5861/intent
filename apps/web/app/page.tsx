import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 font-sans text-slate-50 selection:bg-blue-500/30">
      {/* Background Glow Effects */}
      <div className="absolute top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        <div className="absolute top-[-20%] h-[50rem] w-[50rem] rounded-full bg-blue-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[40rem] w-[40rem] rounded-full bg-indigo-900/20 blur-[100px]" />
      </div>

      <main className="relative z-10 flex w-full max-w-5xl flex-col items-center justify-center px-6 text-center sm:px-12">
        {/* Badge / Chip */}
        <div className="mb-8 inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-300 backdrop-blur-sm transition-colors hover:bg-blue-500/20">
          <span className="relative flex h-2 w-2 mr-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
          </span>
          Next-Gen Data Exchange
        </div>

        {/* Hero Title */}
        <h1 className="mb-6 max-w-4xl text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-100 to-slate-400 sm:text-7xl">
          Intent Exchange Platform
        </h1>

        {/* Subtext */}
        <p className="mb-10 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
          당신의 의도가 실질적인 가치로 전환되는 곳.<br className="hidden sm:block" />
          지금 바로 의도를 등록하고 수익을 창출하세요.
        </p>

        {/* Call to Action Button */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/login"
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-blue-600 px-8 py-4 font-semibold text-white transition-all hover:bg-blue-500 hover:shadow-[0_0_40px_8px_rgba(37,99,235,0.3)] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] transition-transform duration-500 group-hover:translate-x-[100%]" />
            시작하기 (Get Started)
            <svg
              className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
        <Link
          href="/how-it-works"
          className="mt-4 text-sm text-slate-500 hover:text-blue-400 transition-colors"
        >
          의도 자산이란 무엇인가요? →
        </Link>
      </main>

      {/* Footer / Decorative standard elements at bottom */}
      <footer className="absolute bottom-8 text-sm text-slate-500">
        © {new Date().getFullYear()} Intendex. All rights reserved.
      </footer>
    </div>
  );
}
