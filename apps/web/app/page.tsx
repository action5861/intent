import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 font-sans text-slate-50 selection:bg-blue-500/30">
      {/* Background Glow Effects */}
      <div className="absolute top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        <div className="absolute top-[-20%] h-[50rem] w-[50rem] rounded-full bg-blue-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[40rem] w-[40rem] rounded-full bg-indigo-900/20 blur-[100px]" />
      </div>

      <style>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      <main className="relative z-10 flex w-full max-w-5xl flex-col items-center justify-center px-6 text-center sm:px-12 pt-16">
        {/* Hero Title */}
        <div className="mb-8 flex flex-col items-center">
          <span className="mb-6 pb-1 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 animate-[gradient_8s_ease_infinite] [background-size:200%_200%] whitespace-nowrap">
            Intent Exchange Platform
          </span>
          <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-100 to-slate-400 sm:text-7xl break-keep mt-2">
            당신의 의도에 가격이 붙습니다
          </h1>
        </div>

        {/* Subtext */}
        <p className="mb-10 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl break-keep">
          사고 싶은 것, 알아보고 싶은 것을 등록하세요.<br className="hidden sm:block" />
          AI가 최적의 정보를 매칭하고, 당신의 데이터에 정당한 보상을 지급합니다.
        </p>

        {/* Call to Action Button */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/login"
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-blue-600 px-8 py-4 font-semibold text-white transition-all hover:bg-blue-500 hover:shadow-[0_0_40px_8px_rgba(37,99,235,0.3)] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] transition-transform duration-500 group-hover:translate-x-[100%]" />
            의도 등록하기
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
          내 데이터는 얼마의 가치가 있을까? →
        </Link>
      </main>

      {/* Footer / Decorative standard elements at bottom */}
      <footer className="absolute bottom-8 text-sm text-slate-500">
        © {new Date().getFullYear()} Intendex. All rights reserved.
      </footer>
    </div>
  );
}
