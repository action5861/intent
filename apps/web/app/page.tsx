"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

const typingSequence = [
  "ㄴ",
  "노",
  "녿",
  "노트",
  "노틉",
  "노트부",
  "노트북",
  "노트북 ",
  "노트북 ㅊ",
  "노트북 추",
  "노트북 춫",
  "노트북 추천",
  "노트북 추천ㅎ",
  "노트북 추천하",
  "노트북 추천해",
  "노트북 추천햊",
  "노트북 추천해주",
  "노트북 추천해줘",
];

export default function Home() {
  const [typedText, setTypedText] = useState("");
  const [isTypingDone, setIsTypingDone] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [price, setPrice] = useState(0);
  const indexRef = useRef(0);

  // Typing effect
  useEffect(() => {
    let mounted = true;
    indexRef.current = 0;
    setTypedText("");
    setIsTypingDone(false);
    setPrice(0);
    setShowBadge(false);

    const typingInterval = setInterval(() => {
      if (!mounted) return;
      if (indexRef.current < typingSequence.length) {
        setTypedText(typingSequence[indexRef.current]);
        indexRef.current++;
      } else {
        clearInterval(typingInterval);
        setIsTypingDone(true);
        setTimeout(() => {
          if (mounted) setShowBadge(true);
        }, 1000);
      }
    }, 120);

    return () => {
      mounted = false;
      clearInterval(typingInterval);
    };
  }, []);

  // Number rolling effect
  useEffect(() => {
    if (!showBadge) return;

    const targetPrice = 500;
    const duration = 1500; // 1.5 seconds
    let startTime: number | null = null;
    let animationFrameId: number;

    const easeOutQuart = (x: number) => 1 - Math.pow(1 - x, 4);

    const updatePrice = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Use Math.round to avoid staying on 499 for too long
      const currentVal = Math.round(easeOutQuart(progress) * targetPrice);
      setPrice(currentVal);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updatePrice);
      }
    };

    animationFrameId = requestAnimationFrame(updatePrice);

    return () => cancelAnimationFrame(animationFrameId);
  }, [showBadge]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#182848] to-[#4b6cb7] font-sans overflow-hidden selection:bg-blue-500/30">
      {/* Animated Blurred Orbs */}
      <motion.div
        animate={{
          x: [0, 50, -50, 0],
          y: [0, -50, 50, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[10%] left-[20%] h-[30rem] w-[30rem] rounded-full bg-purple-600/30 blur-[120px]"
      />
      <motion.div
        animate={{
          x: [0, -60, 60, 0],
          y: [0, 60, -60, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-[10%] right-[15%] h-[35rem] w-[35rem] rounded-full bg-blue-600/20 blur-[120px]"
      />
      <motion.div
        animate={{
          x: [0, 40, -40, 0],
          y: [0, 40, -40, 0],
          scale: [1, 1.2, 0.8, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute top-[40%] right-[30%] h-[25rem] w-[25rem] rounded-full bg-green-500/20 blur-[100px]"
      />

      <main className="relative z-10 flex w-full max-w-4xl flex-col items-center justify-center px-4 sm:px-6 pt-16">
        
        <div className="relative flex flex-col items-center text-center p-8 sm:p-16 w-full">
          
          {/* Top Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm"
          >
            <span className="text-sm font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-green-400">
              Intent Exchange Platform
            </span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl break-keep"
          >
            검색의도에 <br className="hidden sm:block" /> 가격이 붙습니다
          </motion.h1>

          {/* Sub Headline */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-12 max-w-2xl text-base sm:text-lg leading-relaxed text-gray-400 break-keep"
          >
            사고 싶은 것, 알아보고 싶은 것을 알려주세요.<br className="hidden sm:block" />
            AI가 최적의 정보를 매칭하고, 당신의 데이터에 정당한 보상을 지급합니다.
          </motion.p>

          {/* RTB Animation Search Bar Wrapper with Floating Spheres */}
          <div className="relative mb-14 w-full max-w-2xl">
            {/* Floating Spheres */}
            <motion.div
              animate={{ y: [0, -10, 0], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-6 -left-4 h-4 w-4 rounded-full bg-blue-400 blur-[2px] z-20"
            />
            <motion.div
              animate={{ y: [0, 15, 0], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-4 right-10 h-6 w-6 rounded-full bg-purple-500 blur-[3px] z-20"
            />
            <motion.div
              animate={{ y: [0, -15, 0], opacity: [0.6, 0.9, 0.6] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              className="absolute top-1/2 -right-8 h-3 w-3 rounded-full bg-green-400 blur-[1px] z-20"
            />

            {/* Search Input Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="relative flex w-full h-[4.5rem] sm:h-[5.5rem] items-center justify-between rounded-2xl border border-white/20 bg-white/5 px-4 sm:px-5 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl z-10"
            >
              <div className="flex items-center gap-3 flex-1 overflow-hidden">
                <Search className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 shrink-0" />
                <div className="flex items-center min-w-0">
                  <span className="text-lg sm:text-2xl font-medium text-white truncate">
                    {typedText}
                    {!isTypingDone && <span className="ml-[1px] animate-pulse border-r-2 border-white/70 h-6 inline-block align-middle" />}
                  </span>
                </div>
              </div>
              
              {/* Dynamic Price Tag */}
              <div className="shrink-0 flex items-center min-h-[3rem] min-w-[140px] sm:min-w-[180px] justify-end">
                {showBadge && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="relative flex items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 py-1.5 sm:py-2 pl-5 sm:pl-7 pr-3 sm:pr-4 shadow-[0_0_20px_rgba(236,72,153,0.4)]"
                  >
                    {/* Sparkle effect */}
                    <motion.div 
                      initial={{ opacity: 0.8, scale: 0 }}
                      animate={{ opacity: 0, scale: 2 }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="absolute inset-0 bg-white rounded-lg mix-blend-overlay"
                    />

                    {/* Punched hole effect */}
                    <div className="absolute left-1.5 sm:left-2 top-1/2 h-2.5 w-2.5 sm:h-3 sm:w-3 -translate-y-1/2 rounded-full bg-[#0A0F24] shadow-inner border border-white/10" />
                    
                    {/* Content */}
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] sm:text-xs font-bold text-white/90 tracking-wider">예상 거래 가치</span>
                      <span className="text-xl sm:text-2xl font-black tabular-nums text-white drop-shadow-md leading-tight">
                        ₩{price.toLocaleString('ko-KR')}
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>

          {/* CTA Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col items-center gap-4 w-full"
          >
            <Link
              href="/login"
              className="group relative inline-flex w-full sm:w-auto items-center justify-center overflow-hidden rounded-full bg-blue-600 px-8 py-4 font-semibold text-white transition-all hover:bg-blue-500 hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] focus:outline-none"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] transition-transform duration-500 group-hover:translate-x-[100%]" />
              검색의도 등록하기 →
            </Link>
            <Link
              href="/how-it-works"
              className="text-sm font-medium text-gray-500 hover:text-white hover:underline underline-offset-4 transition-all"
            >
              How it works? →
            </Link>
          </motion.div>

        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 text-sm text-white/30 z-10">
        © {new Date().getFullYear()} Intendex. All rights reserved.
      </footer>
    </div>
  );
}
