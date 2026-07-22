import LibraryClient from "../components/LibraryClient";
import { getBooks } from "../lib/books";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const allBooks = await getBooks();
  const readableCount = allBooks.filter((book) => book.readable).length;
  const books = allBooks.map(({ sections: _sections, ...book }) => book);

  return (
    <>
      <header className="site-header">
        <div className="brand"><div className="brand-mark">书</div><div><div className="brand-name">我的书库</div><div className="brand-caption">阅读优先 · AI 稍后加入</div></div></div>
        <span className="header-link">{readableCount} 本可读</span>
      </header>
      <main className="page-shell">
        <section className="hero"><div className="eyebrow">A quiet place to read</div><h1>把书，重新读成自己的知识。</h1><p>这是一个基于清洗后 Markdown 书库的阅读原型。先安静地读，保存进度，留下标记和笔记；AI 问答会在下一阶段接入，并且始终围绕原文工作。</p></section>
        <LibraryClient books={books} />
      </main>
    </>
  );
}
