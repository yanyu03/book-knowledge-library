import { notFound } from "next/navigation";
import { getBook, getSection, getSectionContent } from "../../../../lib/books";
import ReaderView from "../../../../components/ReaderView";

export const dynamic = "force-dynamic";

export default async function SectionPage({ params }: { params: Promise<{ slug: string; sectionSlug: string }> }) {
  const { slug, sectionSlug } = await params;
  const book = await getBook(slug);
  const section = book ? getSection(book, sectionSlug) : undefined;
  if (!book || !section || !book.readable) notFound();
  return <ReaderView book={book} section={section} content={await getSectionContent(book, section)} />;
}
