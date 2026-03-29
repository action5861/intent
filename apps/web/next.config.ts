import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // [배포 #6] Railway 컨테이너 배포용 standalone 출력 — node_modules 최소화
  output: 'standalone',
};

export default nextConfig;
