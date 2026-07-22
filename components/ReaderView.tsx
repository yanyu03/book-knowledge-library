"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useState } from "react";
import type { Book, Section } from "../lib/books";

type Highlight = { text: string; createdAt: string };

function storageKey(prefix: string, book: Book) {
  return `book-library:${prefix}:${book.slug}`;
}

export default function ReaderView({ book, section, content }: { book: Book; section: Section; content: string }) {
  const [progress, setProgress] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [status, setStatus] = useState("");

  const sectionIndex = book.sections.findIndex((item) => item.slug === section.slug);
  const previous = book.sections[sectionIndex - 1];
  const next = book.sections[sectionIndex + 1];
  const noteKey = `${section.slug}`;

  useEffect(() => {
    const bookmarks = JSON.parse(localStorage.getItem(storageKey("bookmarks", book)) || "[]") as string[];
    const notes = JSON.parse(localStorage.getItem(storageKey("notes", book)) || "{}") as Record<string, string>;
    const savedHighlights = JSON.parse(localStorage.getItem(storageKey("highlights", book)) || "{}") as Record<string, Highlight[]>;
    const progressMap = JSON.parse(localStorage.getItem(storageKey("progress", book)) || "{}") as Record<string, number>;
    setBookmarked(bookmarks.includes(section.slug));
    setNote(notes[noteKey] || "");
    setHighlights(savedHighlights[noteKey] || []);
    const storedProgress = progressMap[noteKey] || 0;
    setProgress(storedProgress);
    if (storedProgress > 0) window.setTimeout(() => window.scrollTo({ top: document.documentElement.scrollHeight * storedProgress, behavior: "instant" as ScrollBehavior }), 80);
  }, [book, noteKey, section.slug]);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      setProgress(value);
      const progressMap = JSON.parse(localStorage.getItem(storageKey("progress", book)) || "{}") as Record<string, number>;
      progressMap[noteKey] = value;
      localStorage.setItem(storageKey("progress", book), JSON.stringify(progressMap));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [book, noteKey]);

  const sectionLinks = useMemo(() => book.sections.slice(Math.max(0, sectionIndex - 2), Math.min(book.sections.length, sectionIndex + 3)), [book.sections, sectionIndex]);

  function toggleBookmark() {
    const key = storageKey("bookmarks", book);
    const bookmarks = JSON.parse(localStorage.getItem(key) || "[]") as string[];
    const updated = bookmarks.includes(section.slug) ? bookmarks.filter((item) => item !== section.slug) : [...bookmarks, section.slug];
    localStorage.setItem(key, JSON.stringify(updated));
    setBookmarked(updated.includes(section.slug));
    setStatus(updated.includes(section.slug) ? "已标记本节" : "已取消标记");
  }

  function saveNote() {
    const key = storageKey("notes", book);
    const notes = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, string>;
    notes[noteKey] = note;
    localStorage.setItem(key, JSON.stringify(notes));
    setSaved(true);
    setStatus("笔记已保存到当前浏览器");
    window.setTimeout(() => setSaved(false), 1800);
  }

  function markSelection() {
    const selected = window.getSelection()?.toString().trim();
    if (!selected) {
      setStatus("请先选中一段正文");
      return;
    }
    const key = storageKey("highlights", book);
    const all = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, Highlight[]>;
    const nextHighlights = [...(all[noteKey] || []), { text: selected.slice(0, 500), createdAt: new Date().toISOString() }];
    all[noteKey] = nextHighlights;
    localStorage.setItem(key, JSON.stringify(all));
    setHighlights(nextHighlights);
    setStatus("已保存选中标记");
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div className="reader-page">
      <header className="reader-header">
        <div className="reader-header-inner">
          <div className="reader-breadcrumb"><Link href="/">书库</Link><span> / </span><strong>{book.title}</strong></div>
          <div className="reader-actions">
            <button className={`ghost-button ${bookmarked ? "active" : ""}`} onClick={toggleBookmark}>{bookmarked ? "★ 已标记" : "☆ 标记本节"}</button>
            <button className="ghost-button" disabled title="下一阶段接入">AI 问答</button>
          </div>
        </div>
        <div className="reader-progress"><span style={{ width: `${progress * 100}%` }} /></div>
      </header>

      <div className="reader-layout">
        <nav className="reader-toc" aria-label="章节目录">
          <div className="toc-label">目录</div>
          {sectionLinks.map((item) => <Link className={`toc-item level-${Math.min(item.level, 4)} ${item.slug === section.slug ? "current" : ""}`} key={item.slug} href={`/books/${book.slug}/${item.slug}`}>{item.title}</Link>)}
          {book.sections.length > sectionLinks.length && <Link className="toc-item" href={`/books/${book.slug}`}>查看完整目录 →</Link>}
        </nav>

        <main className="reader-main" id="reader-content">
          <div className="reader-kicker">{String(book.order).padStart(2, "0")} · {section.ordinal} / {book.sectionCount}</div>
          <h1>{section.title}</h1>
          <div className="reader-subtitle">{book.title} · {book.author}</div>
          <article className="reader-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "本节暂无正文。"}</ReactMarkdown></article>
          <div className="reader-footer-nav">
            {previous ? <Link className="nav-card" href={`/books/${book.slug}/${previous.slug}`}><small>上一节</small><span>← {previous.title}</span></Link> : <div />}
            {next ? <Link className="nav-card next" href={`/books/${book.slug}/${next.slug}`}><small>下一节</small><span>{next.title} →</span></Link> : <div />}
          </div>
        </main>

        <aside className="reader-notes">
          <div className="notes-label">我的阅读痕迹</div>
          <div className="note-card">
            <h3>本节笔记</h3>
            <textarea className="note-textarea" value={note} onChange={(event) => setNote(event.target.value)} placeholder="写下这一节的想法…" />
            <div className="note-actions"><span className="status-text">{saved ? "已保存" : status}</span><button className="solid-button" onClick={saveNote}>保存笔记</button></div>
          </div>
          <div className="note-card">
            <h3>选中后标记</h3>
            <p>选中正文中的一段文字，再点击下面的按钮保存。</p>
            <div className="note-actions"><span className="status-text">{highlights.length ? `${highlights.length} 条标记` : "暂无标记"}</span><button className="ghost-button" onClick={markSelection}>标记选中</button></div>
            {highlights.length > 0 && <div className="quote-list">{highlights.map((highlight, index) => <div className="quote" key={`${highlight.createdAt}-${index}`}>{highlight.text}</div>)}</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
