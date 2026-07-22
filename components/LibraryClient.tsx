"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Book } from "../lib/books";

type LibraryBook = Omit<Book, "sections">;

export default function LibraryClient({ books }: { books: LibraryBook[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return books;
    return books.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(normalized));
  }, [books, query]);

  return (
    <section>
      <div className="library-toolbar">
        <div>
          <h2>全部书籍</h2>
          <div className="library-count">按当前书库顺序排列 · {books.length} 本</div>
        </div>
        <input className="search-box" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索书名或作者…" aria-label="搜索书名或作者" />
      </div>

      {filtered.length ? (
        <div className="book-grid">
          {filtered.map((book) => (
            <article className={`book-card ${book.readable ? "" : "unavailable"}`} key={book.slug}>
              <div>
                <div className="book-order">{String(book.order).padStart(2, "0")}</div>
                <h3 className="book-title">{book.title}</h3>
                <div className="book-author">{book.author}</div>
              </div>
              <div>
                <div className="book-meta">
                  <span className="chip">{book.sectionCount} 节</span>
                  <span className="chip muted">{Math.round(book.contentChars / 1000)}k 字</span>
                  {!book.readable && <span className="chip muted">正文缺失</span>}
                </div>
                {book.readable ? <Link className="text-link" href={`/books/${book.slug}`}>打开阅读 →</Link> : <span className="status-text">待补充 OCR 或正文</span>}
              </div>
            </article>
          ))}
        </div>
      ) : <div className="empty-state">没有找到匹配的书。</div>}
    </section>
  );
}
