import type { Metadata } from "next";
import NavigationLoading from "../components/NavigationLoading";
import "./globals.css";

export const metadata: Metadata = {
  title: "书库 · 阅读优先的知识库",
  description: "基于清洗后 Markdown 书库的阅读与笔记原型",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><NavigationLoading />{children}</body>
    </html>
  );
}
