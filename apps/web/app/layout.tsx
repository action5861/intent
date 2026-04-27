import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intendex - 검색의도 등록 거래소",
  description: "당신의 검색의도에 가격이 붙습니다",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
