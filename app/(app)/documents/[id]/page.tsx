"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { ArrowLeft, Copy, FileQuestion, MoreHorizontal, Trash2, WandSparkles } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { ConfirmDialog, EmptyState, ErrorState, PageContainer } from "@/app/components/app/primitives";
import TemplateIcon from "@/app/components/app/TemplateIcon";
import ContentEditor from "@/app/components/editor/ContentEditor";
import { useMe } from "@/app/hooks/use-me";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { formatDate } from "@/lib/format";
import { getTemplate } from "@/lib/templates/registry";
import type { SerializedDocument } from "@/lib/serializers";

export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: me } = useMe();
  const { data, error, isLoading, mutate: reload } = useSWR<{ document: SerializedDocument }>(`/api/documents/${id}`, {
    revalidateOnFocus: false,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const document = data?.document;
  const template = document?.templateId ? getTemplate(document.templateId) : undefined;

  async function duplicate() {
    try {
      const { document: copy } = await api<{ document: SerializedDocument }>(`/api/documents/${id}/duplicate`, { method: "POST" });
      toast.success("Copy created");
      router.push(`/documents/${copy.id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't duplicate the document."));
    }
  }

  async function remove() {
    try {
      await api(`/api/documents/${id}`, { method: "DELETE" });
      try {
        localStorage.removeItem(`scriptly:draft:doc:${id}`);
      } catch {
        // ignore
      }
      toast.success("Document deleted");
      void mutate((key) => typeof key === "string" && key.startsWith("/api/documents"));
      router.push("/documents");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't delete the document."));
    }
  }

  return (
    <PageContainer className="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/documents">
            <ArrowLeft aria-hidden /> My Documents
          </Link>
        </Button>
        {document && (
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              {template && <TemplateIcon name={template.icon} className="size-3.5" />}
              {template?.name ?? "Blank document"} · created {formatDate(document.createdAt)}
            </span>
            {template && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/write?template=${template.id}`}>
                  <WandSparkles aria-hidden /> Generate another
                </Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label="Document actions">
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void duplicate()}>
                  <Copy aria-hidden /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                  <Trash2 aria-hidden /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {error ? (
        error instanceof ApiClientError && error.status === 404 ? (
          <EmptyState
            icon={FileQuestion}
            title="Document not found"
            description="It may have been deleted, or the link is incorrect."
            action={
              <Button asChild>
                <Link href="/documents">Back to My Documents</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState message={errorMessage(error, "We couldn't load this document.")} onRetry={() => reload()} />
        )
      ) : isLoading || !document ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <Skeleton className="mb-6 h-7 w-1/2" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <ContentEditor
          key={document.id}
          storageKey={`doc:${document.id}`}
          initialTitle={document.title}
          initialContent={document.content ?? ""}
          document={{ id: document.id, updatedAt: document.updatedAt }}
          context={{ templateId: document.templateId, language: document.language, tone: document.tone, framework: document.framework }}
          aiEnabled={me?.features.ai ?? true}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this document?"
        description="This permanently deletes the document. It can't be undone."
        confirmLabel="Delete document"
        destructive
        onConfirm={remove}
      />
    </PageContainer>
  );
}
