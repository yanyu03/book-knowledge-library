import fs from "node:fs";
import path from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type Section = {
  slug: string;
  title: string;
  level: number;
  ordinal: number;
  startLine: number;
  endLine: number;
};

export type Book = {
  slug: string;
  filename: string;
  sourceKey?: string;
  title: string;
  author: string;
  publisher?: string;
  description?: string;
  order: number;
  readable: boolean;
  contentChars: number;
  sectionCount: number;
  sections: Section[];
};

const ROOT = process.cwd();
const linesCache = new Map<string, string[]>();
const remoteLinesCache = new Map<string, Promise<string[]>>();
let booksCache: Promise<Book[]> | null = null;

type BookObject = { key: string };

type BookBucket = {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  list(options?: { cursor?: string; limit?: number }): Promise<{
    objects: BookObject[];
    truncated: boolean;
    cursor?: string;
  }>;
};

type BookSource = {
  key: string;
  filename: string;
};

function isBookBucket(value: unknown): value is BookBucket {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BookBucket>;
  return typeof candidate.get === "function" && typeof candidate.list === "function";
}

async function getRemoteBucket() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = (env as { BOOK_CONTENT?: unknown }).BOOK_CONTENT;
    return isBookBucket(bucket) ? bucket : null;
  } catch {
    return null;
  }
}

// This keeps the current folder order stable instead of depending on a locale-specific sort.
const ORDER_HINTS = [
  "… (中华书局)", "伊格曼自我进化", "信号与噪声", "债务危机", "冲突的战略", "博弈论 Game Theory",
  "史记", "君主论", "商君书", "大国历史", "大衰退", "失去的三十年", "少有人走的路", "工作、消费主义",
  "平凡的世界", "思考, 快与慢", "搜索力", "改变：", "政府论", "武志红合集", "沉思录", "独裁者手册",
  "社会契约论", "第一性原理", "策略思维", "算法之美", "系统之美", "经济学的思维方式", "置身事内",
  "自卑与超越", "论法的精神", "资治通鉴", "通货紧缩", "阴谋简史",
];

function getLocalLines(filename: string) {
  const cached = linesCache.get(filename);
  if (cached) return cached;
  const content = fs.readFileSync(path.join(ROOT, filename), "utf8").replace(/^\uFEFF/, "");
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  linesCache.set(filename, lines);
  return lines;
}

async function getRemoteLines(bucket: BookBucket, key: string) {
  const cached = remoteLinesCache.get(key);
  if (cached) return cached;

  const pending = bucket.get(key).then(async (object) => {
    if (!object) throw new Error(`R2 object not found: ${key}`);
    const content = (await object.text()).replace(/^\uFEFF/, "");
    return content.replace(/\r\n?/g, "\n").split("\n");
  });
  remoteLinesCache.set(key, pending);
  return pending;
}

async function getLines(sourceKey: string, bucket: BookBucket | null) {
  return bucket ? getRemoteLines(bucket, sourceKey) : getLocalLines(sourceKey);
}

function metadata(lines: string[]) {
  const data: Record<string, string> = {};
  for (const line of lines.slice(0, 40)) {
    const match = line.match(/^\*\*(Title|Authors|Publisher|Description):\*\*\s*(.*)$/);
    if (match) data[match[1]] = match[2].trim();
  }
  return data;
}

function plainTitle(value: string) {
  return value.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
}

function slugPart(value: string) {
  const ascii = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return ascii || "section";
}

function isBareSectionTitle(value: string) {
  const title = value.trim().replace(/\\_/g, "_");
  if (!title || title.length > 100 || title.startsWith("**") || title.startsWith("[") || title.startsWith("*") || title.includes("http")) return false;
  if (/^(?:目录|contents|引言|前言|序言|导读|致谢|结束语|译后记|附录|版权信息|献词|上篇|下篇|第一部分|第二部分|第三部分|第四部分|Chapter[_\s\\-]*\d+|第[一二三四五六七八九十百千0-9]+(?:章|节|卷|篇|部)|卷[一二三四五六七八九十百千0-9]+)/iu.test(title)) return true;
  if (/^[一二三四五六七八九十百千0-9]+[、.．]\s*[^。！？；]{1,80}$/u.test(title)) return true;
  if (/^[^。！？；]{1,80}（[^）]{1,50}）$/u.test(title) && /(?:年|纪)/u.test(title)) return true;
  return false;
}

function markersFor(lines: string[]) {
  const headingMarkers = lines.flatMap((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    return match ? [{ title: plainTitle(match[2]), level: match[1].length, startLine: index }] : [];
  });
  const bareMarkers = lines.flatMap((line, index) => {
    const value = line.trim();
    return isBareSectionTitle(value) ? [{ title: plainTitle(value), level: value.startsWith("Chapter") ? 1 : 2, startLine: index }] : [];
  });

  if (headingMarkers.length >= 3) return headingMarkers;
  if (headingMarkers.length) {
    const headingLines = new Set(headingMarkers.map((marker) => marker.startLine));
    return [...headingMarkers, ...bareMarkers.filter((marker) => !headingLines.has(marker.startLine))].sort((a, b) => a.startLine - b.startLine);
  }

  // Avoid turning a long run of bare TOC entries into the only reading experience.
  // The repeated titles in the body are still useful and are retained.
  return bareMarkers;
}

function buildSections(lines: string[]) {
  const markers = markersFor(lines);
  const bodyStart = lines.findIndex((line) => !/^\*\*(Title|Authors|Publisher|Description):\*\*/.test(line.trim()));
  const usefulStart = bodyStart < 0 ? 0 : bodyStart;
  const usableMarkers = markers.filter((marker) => marker.startLine >= usefulStart);

  if (!usableMarkers.length) {
    return [{ slug: "section-001", title: "正文", level: 1, ordinal: 1, startLine: usefulStart, endLine: lines.length }];
  }

  const sections: Section[] = [];
  if (usableMarkers[0].startLine > usefulStart + 4) {
    sections.push({ slug: "section-001", title: "前言与正文信息", level: 1, ordinal: 1, startLine: usefulStart, endLine: usableMarkers[0].startLine });
  }

  for (let index = 0; index < usableMarkers.length; index += 1) {
    const marker = usableMarkers[index];
    const next = usableMarkers[index + 1]?.startLine ?? lines.length;
    const ordinal = sections.length + 1;
    sections.push({
      slug: `section-${String(ordinal).padStart(3, "0")}-${slugPart(marker.title)}`,
      title: marker.title || `第 ${ordinal} 节`,
      level: marker.level,
      ordinal,
      startLine: marker.startLine,
      endLine: next,
    });
  }
  return sections;
}

function compareSources(a: BookSource, b: BookSource) {
    const aIndex = ORDER_HINTS.findIndex((hint) => a.filename.startsWith(hint));
    const bIndex = ORDER_HINTS.findIndex((hint) => b.filename.startsWith(hint));
    if (aIndex !== bIndex) return (aIndex < 0 ? 999 : aIndex) - (bIndex < 0 ? 999 : bIndex);
    return a.filename.localeCompare(b.filename, "zh-CN");
}

function orderedLocalSources() {
  return fs.readdirSync(ROOT)
    .filter((filename) => filename.toLowerCase().endsWith(".md"))
    .map((filename) => ({ key: filename, filename }))
    .sort(compareSources);
}

async function orderedRemoteSources(bucket: BookBucket) {
  const sources: BookSource[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list({ cursor, limit: 1000 });
    sources.push(
      ...page.objects
        .filter((object) => object.key.toLowerCase().endsWith(".md"))
        .map((object) => ({
          key: object.key,
          filename: object.key.split("/").pop() || object.key,
        })),
    );
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return sources.sort(compareSources);
}

async function buildBook(source: BookSource, order: number, bucket: BookBucket | null): Promise<Book> {
  const lines = await getLines(source.key, bucket);
  const data = metadata(lines);
  const sections = buildSections(lines);
  const contentChars = lines.join("\n").replace(/^\*\*(?:Title|Authors|Publisher|Description):\*\*.*$/gm, "").trim().length;
  return {
    slug: `book-${String(order + 1).padStart(2, "0")}`,
    filename: source.filename,
    sourceKey: source.key,
    title: plainTitle(data.Title || source.filename.replace(/\.md$/i, "")),
    author: plainTitle(data.Authors || "作者未知"),
    publisher: plainTitle(data.Publisher || ""),
    description: plainTitle(data.Description || ""),
    order: order + 1,
    readable: contentChars > 300,
    contentChars,
    sectionCount: sections.length,
    sections: sections.map((section) => ({ ...section })),
  };
}

async function loadBooks() {
  const bucket = await getRemoteBucket();
  const sources = bucket ? await orderedRemoteSources(bucket) : orderedLocalSources();
  return Promise.all(sources.map((source, index) => buildBook(source, index, bucket)));
}

export function getBooks() {
  if (!booksCache) booksCache = loadBooks();
  return booksCache;
}

export async function getBook(slug: string) {
  return (await getBooks()).find((book) => book.slug === slug);
}

export function getSection(book: Book, sectionSlug: string) {
  return book.sections.find((section) => section.slug === sectionSlug);
}

export async function getSectionContent(book: Book, section: Section) {
  const lines = await getLines(book.sourceKey || book.filename, await getRemoteBucket());
  const firstLine = lines[section.startLine]?.trim() || "";
  const isSectionMarker = /^#{1,6}\s+/.test(firstLine) || plainTitle(firstLine.replace(/\\_/g, "_")) === section.title;
  const start = isSectionMarker ? section.startLine + 1 : section.startLine;
  return lines.slice(start, section.endLine).join("\n").trim();
}
