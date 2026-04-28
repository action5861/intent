"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      aria-label="뒤로가기"
      className="sm:hidden flex items-center justify-center rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
