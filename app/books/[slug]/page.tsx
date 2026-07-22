import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook } from "../../../lib/books";

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) notFound();
  if (!book.readable) return <main className="page-shell"><div className="book-overview"><div><Link className="back-link" href="/">← 返回书库</Link><h1>{book.title}</h1><p>这本书当前只有元数据，正文缺失，暂时无法阅读。后续补充 OCR 或清洗后的正文后即可导入。</p></div></div></main>;

  const listedSections = book.sectionCount > 300 ? book.sections.filter((section) => section.level <= 1) : book.sections;

  return (
    <main className="page-shell">
      <div className="book-overview"><div><Link className="back-link" href="/">← 返回书库</Link><div className="eyebrow" style={{ marginTop: 24 }}>Book {String(book.order).padStart(2, "0")}</div><h1>{book.title}</h1><p>{book.author}{book.publisher ? ` · ${book.publisher}` : ""}</p></div></div>
      <div className="library-toolbar"><div><h2>章节目录</h2><div className="library-count">共 {book.sectionCount} 节 · 点击任意一节开始阅读{listedSections.length !== book.sectionCount ? " · 已显示主要章节" : ""}</div></div><Link className="solid-button" href={`/books/${book.slug}/${book.sections[0]?.slug || ""}`}>从第一节开始 →</Link></div>
      <div className="section-list">{listedSections.map((section) => <Link className="section-row" key={section.slug} href={`/books/${book.slug}/${section.slug}`}><span className="section-number">{String(section.ordinal).padStart(3, "0")}</span><span className="section-name">{section.title}</span><span className="section-level">L{section.level} →</span></Link>)}</div>
    </main>
  );
}
