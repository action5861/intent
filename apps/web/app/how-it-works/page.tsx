"use client";

import { motion } from "motion/react";
import { Shield, Scale, Zap, Globe, ChevronDown, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

/* ── 8단계 가이드 슬라이더 ───────────────────────────── */
const GUIDE_SLIDES = [
  {
    step: "STEP 01",
    title: "Intendex 접속",
    description: "intendex.com에 접속하면 이 화면이 나타납니다. '시작하기' 버튼을 눌러 여정을 시작하세요. 로그인 또는 회원가입 페이지로 이동합니다.",
    image: "/guide/step1.png",
    tip: null,
  },
  {
    step: "STEP 02",
    title: "로그인 또는 회원가입",
    description: "이메일과 비밀번호로 로그인하세요. 처음이라면 하단의 '회원가입' 링크를 눌러 무료로 계정을 만드세요. 비밀번호는 8자 이상이면 됩니다.",
    image: "/guide/step2.png",
    tip: null,
  },
  {
    step: "STEP 03",
    title: "AI와 대화하며 의도 등록",
    description: "AI가 먼저 인사하며 무엇이 필요한지 물어봅니다. 자연스럽게 대화하듯 답하세요. 충분한 정보가 모이면 '지금 바로 등록하기' 버튼이 나타납니다. 버튼을 눌러 의도를 등록하세요.",
    image: "/guide/step3.png",
    tip: "예시: '토익 공부를 하고 싶어' → AI가 방식/지역을 물음 → '온라인 강의를 하고 싶어' → 등록 완료",
  },
  {
    step: "STEP 04",
    title: "매칭 완료 — 방문 버튼 확인",
    description: "대시보드에서 '매칭 완료' 상태의 의도 카드를 확인하세요. AI가 자동으로 가장 적합한 광고주를 찾아줍니다. 초록색 '사이트 방문하고 500P 받기' 버튼이 보이면 클릭하세요.",
    image: "/guide/step4.png",
    tip: "추천 광고주도 함께 표시됩니다. 하지만 포인트는 초록 버튼의 최우선 매칭 광고주만 지급됩니다.",
  },
  {
    step: "STEP 05",
    title: "광고주 사이트 실제 방문",
    description: "버튼을 클릭하면 매칭된 광고주 사이트가 새 탭에서 열립니다. 사이트를 자유롭게 둘러보세요. Intendex 탭으로 돌아오지 말고 20초 이상 그대로 머물러 있으면 됩니다.",
    image: "/guide/step5.png",
    tip: "새 탭을 닫거나 바로 나가지 마세요. 20초가 채워지면 자동으로 포인트가 지급됩니다.",
  },
  {
    step: "STEP 06",
    title: "20초 체류 달성 — 리워드 자동 적립",
    description: "20초가 지나면 Intendex 탭에 '리워드 적립 완료!' 메시지와 함께 획득한 포인트가 표시됩니다. 포인트는 즉시 계정에 반영됩니다.",
    image: "/guide/step6.png",
    tip: "더 오래 머물수록 체류 데이터가 더 정확하게 기록됩니다. '대시보드에서 확인하기' 버튼을 눌러 다음으로 이동하세요.",
  },
  {
    step: "STEP 07",
    title: "추가 체류 시간도 자동 기록",
    description: "리워드가 적립된 후에도 광고주 사이트에 머물면 실제 체류시간이 계속 기록됩니다. 화면 하단에 '방문 중: 사이트 주소'가 표시되며 정상 기록 중임을 알 수 있습니다.",
    image: "/guide/step7.png",
    tip: "충분히 둘러봤다면 '대시보드에서 확인하기' 버튼을 눌러 이동하세요.",
  },
  {
    step: "STEP 08",
    title: "대시보드에서 포인트 지급 확인",
    description: "대시보드로 돌아오면 의도 카드의 상태가 '리워드 지급'으로 바뀌고 '+500P 지급 완료' 배지가 표시됩니다. 포인트가 10,000P 이상 쌓이면 현금 인출 신청이 가능합니다.",
    image: "/guide/step8.png",
    tip: "리워드 메뉴에서 전체 적립 내역을 확인하고, 출금 신청도 할 수 있습니다.",
  },
];

function GuideSlider() {
  const [current, setCurrent] = useState(0);

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent((c) => Math.min(GUIDE_SLIDES.length - 1, c + 1)), []);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  }, [prev, next]);

  const slide = GUIDE_SLIDES[current];
  const isFirst = current === 0;
  const isLast = current === GUIDE_SLIDES.length - 1;

  return (
    <div className="w-full outline-none" tabIndex={0} onKeyDown={handleKey}>
      <div className="relative mx-auto max-w-3xl">
        {/* 고정 비율 컨테이너 — 이미지 크기 변동 방지 */}
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-zinc-900">
          <Image
            src={slide.image}
            alt={slide.title}
            fill
            className="object-contain"
            priority={current === 0}
            sizes="(max-width: 768px) 100vw, 768px"
          />
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${((current + 1) / GUIDE_SLIDES.length) * 100}%` }}
            />
          </div>
        </div>

        <button
          onClick={prev}
          disabled={isFirst}
          aria-label="이전 슬라이드"
          className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-all hover:bg-black/80 disabled:opacity-20"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={next}
          disabled={isLast}
          aria-label="다음 슬라이드"
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-all hover:bg-black/80 disabled:opacity-20"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto mt-8 max-w-3xl text-center px-4">
        <p className="mb-2 text-xs font-bold tracking-widest text-blue-400">{slide.step}</p>
        <h3 className="mb-3 text-2xl font-bold text-white">{slide.title}</h3>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-zinc-400">{slide.description}</p>
        {slide.tip && (
          <div className="mx-auto mt-4 max-w-2xl rounded-xl border border-blue-500/20 bg-blue-500/5 px-5 py-3 text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">💡 Tip</p>
            <p className="text-sm leading-relaxed text-zinc-300">{slide.tip}</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2">
        {GUIDE_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`슬라이드 ${i + 1}로 이동`}
            className={`rounded-full transition-all duration-300 ${
              i === current
                ? "h-2.5 w-8 bg-blue-500"
                : i < current
                ? "h-2.5 w-2.5 bg-blue-800 hover:bg-blue-600"
                : "h-2.5 w-2.5 bg-zinc-600 hover:bg-zinc-400"
            }`}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-6">
        <button onClick={prev} disabled={isFirst} className="flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-0">
          <ChevronLeft className="h-4 w-4" /> 이전
        </button>
        <span className="text-xs text-zinc-600">{current + 1} / {GUIDE_SLIDES.length}</span>
        <button onClick={next} disabled={isLast} className="flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-0">
          다음 <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ── 네비게이션 ──────────────────────────────────────── */
const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { label: "프로세스", href: "#process" },
    { label: "원칙", href: "#principles" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#111417]/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold tracking-tighter text-white hover:text-blue-400 transition-colors">
          Intendex
        </Link>

        <div className="hidden md:flex items-center gap-10">
          {links.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors px-4 py-2">
            로그인
          </Link>
          <Link
            href="/register"
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-6 py-2.5 rounded-full transition-all active:scale-95"
          >
            시작하기
          </Link>
        </div>

        <button className="md:hidden text-white" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-[#111417] border-b border-white/5 px-6 py-8 flex flex-col gap-6"
        >
          {links.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-lg font-medium text-zinc-400"
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
            <Link href="/login" className="text-left text-lg font-medium text-zinc-400">로그인</Link>
            <Link href="/register" className="bg-blue-600 text-white font-bold py-4 rounded-xl text-center">시작하기</Link>
          </div>
        </motion.div>
      )}
    </nav>
  );
};

/* ── 히어로 ──────────────────────────────────────────── */
const Hero = () => (
  <section className="relative pt-48 pb-32 px-6 overflow-hidden">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full opacity-20 pointer-events-none">
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600 blur-[120px]" />
    </div>

    <div className="max-w-7xl mx-auto relative z-10 text-center">
      <motion.span
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-block px-4 py-1.5 rounded-full bg-zinc-800/50 text-blue-400 text-[0.7rem] font-bold tracking-widest mb-8 border border-white/5 uppercase"
      >
        의도 자산 시대의 시작
      </motion.span>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-5xl md:text-7xl lg:text-8xl font-extrabold leading-[1.05] tracking-tight mb-10 max-w-5xl mx-auto text-white"
      >
        모든 의도에는
        <br />
        <span className="text-blue-500">시장가치가 있습니다.</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-4 leading-relaxed"
      >
        당신의 의도는 이미 거대한 경제 흐름을 만들고 있습니다.
        <br />
        Intendex는 그 가치를 당신에게 돌려줍니다.
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-zinc-600 text-sm max-w-lg mx-auto mb-12 leading-relaxed"
      >
        의도를 등록하는 것은
        <br />
        당신의 경제적 의사결정을 자산으로 전환하는 행위입니다.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-6"
      >
        <Link
          href="/register"
          className="w-full sm:w-auto px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all hover:scale-105 shadow-2xl shadow-blue-600/20 text-center"
        >
          의도 자산 등록하기
        </Link>
        <Link
          href="/login"
          className="w-full sm:w-auto px-10 py-5 bg-zinc-900 border border-white/10 text-white font-bold rounded-full transition-all hover:bg-zinc-800 text-center"
        >
          로그인
        </Link>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="mt-6 text-xs text-zinc-600 flex items-center justify-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5 text-zinc-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75A4.5 4.5 0 0 0 7.5 6.75v3.75m-.75 0h10.5A1.5 1.5 0 0 1 18.75 12v6A1.5 1.5 0 0 1 17.25 19.5H6.75A1.5 1.5 0 0 1 5.25 18v-6A1.5 1.5 0 0 1 6.75 10.5Z" />
        </svg>
        이름·연락처 등 개인 식별 정보는 수집하지 않습니다
      </motion.p>
    </div>
  </section>
);

/* ── 핵심 개념 인트로 ────────────────────────────────── */
const Intro = () => (
  <section className="py-16 px-6 bg-[#0c0e12]">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="max-w-3xl mx-auto rounded-3xl border border-blue-500/20 bg-blue-500/5 px-10 py-10 text-center"
    >
      <p className="text-base leading-relaxed text-zinc-300 md:text-lg">
        기업들은 수조 원을 들여 소비자의 진짜 의도를 파악하려 합니다.
        <br className="hidden sm:block" />
        그 데이터의 원천은 언제나 <span className="font-semibold text-white">당신</span>이었습니다.
        <br className="hidden sm:block mt-3" />
        <span className="text-blue-400">Intendex는 그 가치를 처음으로 소비자에게 되돌립니다.</span>
      </p>
    </motion.div>
  </section>
);

/* ── 수치 ────────────────────────────────────────────── */
const Stats = () => (
  <section className="py-20 bg-[#0c0e12]">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
        {[
          { label: "파트너 브랜드", value: "500", suffix: "+" },
          { label: "자산 카테고리", value: "15", suffix: "개" },
          { label: "의도 1건당 수익", value: "최대 1,000", suffix: "P" },
          { label: "수익 실현 기준", value: "10,000", suffix: "P~" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tighter">
              {stat.value}<span className="text-blue-500">{stat.suffix}</span>
            </div>
            <div className="text-zinc-500 text-xs tracking-widest uppercase font-bold">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ── 프로세스 ─────────────────────────────────────────── */
const Process = () => (
  <section id="process" className="py-32 bg-[#111417]">
    <div className="max-w-7xl mx-auto px-6">
      <div className="mb-24 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">의도 자산화 프로세스</h2>
        <div className="w-20 h-1 bg-blue-600 mx-auto" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            num: "01",
            title: "의도를 정의하세요",
            desc: "무엇을 원하는지 생각을 그대로 표현하세요. 자신의 의도를 명확히 정의하는 것이 자산을 만드는 첫걸음입니다.",
          },
          {
            num: "02",
            title: "AI가 가치를 산정합니다",
            desc: "AI가 당신의 의도와 가장 부합하는 파트너 브랜드를 분석합니다. 당신의 의도는 경쟁 입찰의 대상이 됩니다.",
          },
          {
            num: "03",
            title: "수익이 누적됩니다",
            desc: "이것은 클릭 수익이 아닙니다. 당신의 경제적 의사결정에 대한 정당한 보상입니다. 의도를 등록할 때마다 쌓입니다.",
          },
        ].map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group p-12 rounded-[2.5rem] bg-zinc-900/50 border border-white/5 hover:border-blue-500/30 transition-all duration-500"
          >
            <div className="text-blue-600 text-6xl font-black mb-10 opacity-20 group-hover:opacity-100 transition-opacity">
              {step.num}
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">{step.title}</h3>
            <p className="text-zinc-400 leading-relaxed">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ── 원칙 ────────────────────────────────────────────── */
const Principles = () => (
  <section id="principles" className="py-32 bg-[#0c0e12]">
    <div className="max-w-7xl mx-auto px-6">
      <div className="max-w-xl mb-20">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Intendex의 원칙</h2>
        <p className="text-zinc-400 text-lg">소비자 중심의 데이터 경제를 만드는 4가지 기준</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5 rounded-[2.5rem] overflow-hidden border border-white/5">
        {[
          {
            icon: <Shield className="text-blue-500" />,
            title: "완전한 데이터 주권",
            desc: "의도 내용은 당신의 동의 하에만 활용됩니다. 이름, 연락처 등 개인 식별 정보는 어떤 기업에도 전달되지 않습니다. 당신은 언제나 데이터의 주인입니다.",
          },
          {
            icon: <Scale className="text-blue-500" />,
            title: "수익의 직접 귀속",
            desc: "당신의 의도가 만든 경제적 가치는 중간 플랫폼이 아닌 당신 계좌로 직접 귀속됩니다. 10,000P부터 즉시 인출 가능합니다.",
          },
          {
            icon: <Zap className="text-blue-500" />,
            title: "의도의 즉시 가치화",
            desc: "등록 즉시 AI가 의도의 시장 가치를 평가합니다. 당신의 결정은 선반 위에 쌓이지 않고 실시간으로 자산이 됩니다.",
          },
          {
            icon: <Globe className="text-blue-500" />,
            title: "의도의 정밀한 표현",
            desc: "검색 키워드가 아닌 맥락 있는 언어로 의도를 표현하세요. AI가 당신의 결정을 정확히 파악하고 적절한 가치를 산정합니다.",
          },
        ].map((p, i) => (
          <div key={i} className="bg-[#111417] p-12 hover:bg-zinc-900 transition-colors">
            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-8">
              {p.icon}
            </div>
            <h4 className="text-xl font-bold text-white mb-4">{p.title}</h4>
            <p className="text-zinc-400 leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ── FAQ ─────────────────────────────────────────────── */
const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "참여 비용이 있나요?",
      a: "없습니다. Intendex는 완전 무료 플랫폼입니다. 의도를 등록하고 수익을 받으세요. 가입비, 이용료, 수수료 어떤 비용도 없습니다.",
    },
    {
      q: "파트너 브랜드 사이트에서 꼭 무언가를 해야 하나요?",
      a: "아닙니다. 사이트 방문 자체가 의도 확인 행위이며, 그것만으로 수익이 발생합니다. 이후의 행동은 전적으로 본인의 선택입니다.",
    },
    {
      q: "수익은 어떻게 인출하나요?",
      a: "10,000P 이상의 수익이 누적되면 마이페이지에서 계좌 인출을 신청할 수 있습니다. 복잡한 절차 없이 몇 초 안에 완료됩니다.",
    },
    {
      q: "하루에 몇 건의 의도를 등록할 수 있나요?",
      a: "하루 2건까지 의도를 등록하고 수익화할 수 있습니다. 각 의도는 독립적인 자산으로 관리됩니다.",
    },
    {
      q: "내 정보는 어떻게 보호되나요?",
      a: "Intendex는 개인 식별 정보를 수집하지 않습니다. 이것은 정책이 아니라 구조적 설계입니다. 의도 내용만 파트너 브랜드와 공유되며, 이름·연락처 등 당신이 누구인지를 특정할 수 있는 정보는 어떤 경우에도 저장되거나 전달되지 않습니다.",
    },
  ];

  return (
    <section id="faq" className="py-32 bg-[#111417]">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-4xl md:text-5xl font-bold text-center text-white mb-20">자주 묻는 질문</h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-3xl bg-zinc-900/50 border border-white/5 overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full p-8 flex justify-between items-center text-left hover:bg-zinc-800/50 transition-colors"
              >
                <span className="text-lg font-bold text-white">{faq.q}</span>
                <ChevronDown
                  className={`text-zinc-500 transition-transform shrink-0 ml-4 ${openIndex === i ? "rotate-180" : ""}`}
                />
              </button>
              {openIndex === i && (
                <div className="px-8 pb-8 text-zinc-400 leading-relaxed">{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ── 푸터 ────────────────────────────────────────────── */
const Footer = () => (
  <footer className="bg-[#0c0e12] border-t border-white/5 py-20 px-6">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
      <div className="flex flex-col items-center md:items-start gap-4">
        <Link href="/" className="text-2xl font-bold text-white tracking-tighter hover:text-blue-400 transition-colors">
          Intendex
        </Link>
        <p className="text-sm text-zinc-500">© {new Date().getFullYear()} Intendex. All rights reserved.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-10">
        <Link href="/register" className="text-sm font-medium text-zinc-500 hover:text-white transition-colors">회원가입</Link>
        <Link href="/login" className="text-sm font-medium text-zinc-500 hover:text-white transition-colors">로그인</Link>
        <Link href="/dashboard" className="text-sm font-medium text-zinc-500 hover:text-white transition-colors">대시보드</Link>
      </div>
    </div>
  </footer>
);

/* ── 페이지 ──────────────────────────────────────────── */
export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[#111417] text-white selection:bg-blue-500/30">
      <Navbar />
      <Hero />
      <Intro />
      <Stats />
      <Process />

      {/* 화면으로 따라하는 이용 가이드 */}
      <section className="py-32 bg-[#0c0e12]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16 text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-zinc-800/50 text-blue-400 text-[0.7rem] font-bold tracking-widest mb-6 border border-white/5 uppercase">
              실제 화면으로 보기
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">화면으로 따라하는 이용 가이드</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              실제 서비스 화면 8장을 순서대로 따라가면 처음도 어렵지 않습니다.
              <br className="hidden sm:block" />
              좌우 화살표 또는 키보드 ← → 로 이동하세요.
            </p>
          </div>
          <GuideSlider />
        </div>
      </section>

      <Principles />
      <FAQ />

      {/* CTA */}
      <section className="py-32 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto rounded-[3.5rem] bg-blue-600 p-16 md:p-24 text-center relative overflow-hidden shadow-2xl shadow-blue-600/20"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-700/50 to-transparent pointer-events-none" />
          <p className="text-sm font-bold text-blue-200 uppercase tracking-widest mb-6 relative z-10">
            지금 이 순간에도 당신의 의도는 가치를 지닙니다
          </p>
          <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-10 leading-tight relative z-10">
            당신의 의도는 이미 자산입니다
          </h2>
          <p className="text-blue-100 text-xl max-w-2xl mx-auto mb-14 relative z-10 leading-relaxed">
            첫 의도를 등록하세요.
            당신의 경제적 결정이 실질적인 수익원이 됩니다.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <Link
              href="/register"
              className="bg-white text-blue-600 hover:bg-zinc-100 px-12 py-6 rounded-full text-xl font-bold transition-all transform hover:scale-105"
            >
              지금 시작하기 →
            </Link>
            <Link
              href="/login"
              className="border border-white/30 text-white hover:bg-white/10 px-12 py-6 rounded-full text-xl font-bold transition-all"
            >
              로그인 →
            </Link>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
