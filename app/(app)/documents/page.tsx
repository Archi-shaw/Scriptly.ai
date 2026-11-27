"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Copy, FilePlus2, FileText, FolderSearch, Loader2, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { ConfirmDialog, EmptyState, ErrorState, PageContainer, PageHeader, Pagination } from "@/app/components/app/primitives";
import TemplateIcon from "@/app/components/app/TemplateIcon";
import { useDebounced } from "@/app/hooks/use-debounced";
import { api, errorMessage } from "@/lib/client/api";
import { formatNumber, formatRelative } from "@/lib/format";
import { TEMPLATE_CATEGORIES, getCategory, getTemplate } from "@/lib/templates/registry";
import type { SerializedDocument } from "@/lib/serializers";

interface ListResponse {
  items: SerializedDocument[];
  page: number;
  totalPages: number;
  total: number;
}

const SORTS = [
  { value: "updated", label: "Last edited" },
  { value: "created", label: "Date created" },
  { value: "title", label: "Title (A–Z)" },
] as const;

export default function DocumentsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const query = useDebounced(search.trim(), 300);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("updated");
  const [page, setPage] = useState(1);
  const [renaming, setRenaming] = useState<{ doc: SerializedDocument; title: string } | null>(null);
  const [deleting, setDeleting] = useState<SerializedDocument | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingRename, setSavingRename] = useState(false);

  useEffect(() => setPage(1), [query, category, sort]);

  const params = new URLSearchParams({
    q: query,
    category,
    sort,
    order: sort === "title" ? "asc" : "desc",
    page: String(page),
    limit: "12",
  });
  const { data, error, isLoading, mutate } = useSWR<ListResponse>(`/api/documents?${params}`, { keepPreviousData: true });
  const filtered = Boolean(query) || category !== "all";

  async function createBlank() {
    setCreating(true);
    try {
      const { document } = await api<{ document: SerializedDocument }>("/api/documents", { body: { title: "Untitled document", content: "" } });
      router.push(`/documents/${document.id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't create a document."));
      setCreating(false);
    }
  }

  async function duplicate(doc: SerializedDocument) {
    try {
      await api(`/api/documents/${doc.id}/duplicate`, { method: "POST" });
      toast.success(`Duplicated “${doc.title}”`);
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't duplicate the document."));
    }
  }

  async function rename() {
    if (!renaming) return;
    const title = renaming.title.trim();
    if (!title) {
      toast.error("Title can't be empty.");
      return;
    }
    setSavingRename(true);
    try {
      await api(`/api/documents/${renaming.doc.id}`, { method: "PATCH", body: { title } });
      toast.success("Document renamed");
      setRenaming(null);
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't rename the document."));
    } finally {
      setSavingRename(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api(`/api/documents/${deleting.id}`, { method: "DELETE" });
      toast.success("Document deleted");
      setDeleting(null);
      if (data && data.items.length === 1 && page > 1) setPage(page - 1);
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't delete the document."));
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="My Documents"
        description={data ? `${formatNumber(data.total)} document${data.total === 1 ? "" : "s"}${filtered ? " found" : ""}` : "Your saved content"}
        actions={
          <>
            <Button variant="outline" onClick={createBlank} disabled={creating}>
              {creating ? <Loader2 className="animate-spin" aria-hidden /> : <FilePlus2 aria-hidden />}
              Blank document
            </Button>
            <Button asChild>
              <Link href="/templates">New from template</Link>
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search titles and content…" className="h-10 pl-9" aria-label="Search documents" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-10 w-full md:w-48" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {TEMPLATE_CATEGORIES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
            <SelectItem value="general">Blank documents</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="h-10 w-full md:w-44" aria-label="Sort documents">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState message={errorMessage(error, "We couldn't load your documents.")} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={FolderSearch}
            title="No matching documents"
            description="Try a different search or category."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Generate content with a template and save it here, or start from a blank document."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/templates">Browse templates</Link>
                </Button>
                <Button variant="outline" onClick={createBlank} disabled={creating}>
                  Blank document
                </Button>
              </div>
            }
          />
        )
      ) : (
        <>
          <div className={`grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${isLoading ? "opacity-60" : ""}`}>
            {data?.items.map((doc) => {
              const template = doc.templateId ? getTemplate(doc.templateId) : undefined;
              return (
                <article key={doc.id} className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition hover:border-violet-400/40">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-violet-300">
                      {template ? <TemplateIcon name={template.icon} /> : <FileText className="size-4" aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold">
                        <Link href={`/documents/${doc.id}`} className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring">
                          {doc.title}
                        </Link>
                      </h2>
                      <p className="truncate text-xs text-muted-foreground">
                        {template?.name ?? getCategory(doc.category)?.name ?? "Blank document"}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative z-10 -mr-2 -mt-1 size-8" aria-label={`Actions for ${doc.title}`}>
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/documents/${doc.id}`}>
                            <FileText aria-hidden /> Open
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setRenaming({ doc, title: doc.title })}>
                          <Pencil aria-hidden /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void duplicate(doc)}>
                          <Copy aria-hidden /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(doc)}>
                          <Trash2 aria-hidden /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">{doc.preview || "Empty document"}</p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {formatNumber(doc.wordCount)} words · edited {formatRelative(doc.updatedAt)}
                  </p>
                </article>
              );
            })}
          </div>
          <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
        </>
      )}

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && !savingRename && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
            <DialogDescription>Give this document a name you&apos;ll recognise later.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void rename();
            }}
          >
            <Input
              value={renaming?.title ?? ""}
              onChange={(e) => setRenaming((r) => (r ? { ...r, title: e.target.value } : r))}
              maxLength={200}
              autoFocus
              aria-label="Document title"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setRenaming(null)} disabled={savingRename}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingRename}>
                {savingRename && <Loader2 className="animate-spin" aria-hidden />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this document?"
        description={`“${deleting?.title ?? ""}” will be permanently deleted. This can't be undone. Your generation history is not affected.`}
        confirmLabel="Delete document"
        destructive
        onConfirm={remove}
      />
    </PageContainer>
  );
}
