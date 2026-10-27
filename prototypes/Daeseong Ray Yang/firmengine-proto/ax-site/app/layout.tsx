import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Firm Engine · 개인회생 워크스페이스",
  description: "증거에서 계산, 법적 검토, 제출서류까지. 근거를 추적하는 개인회생 사건 워크스페이스.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
