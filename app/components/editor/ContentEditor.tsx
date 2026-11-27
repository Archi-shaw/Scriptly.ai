"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  Download,
  Eye,
  FileCode2,
  FileText,
  FileType,
  Loader2,
  PenLine,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import MarkdownPreview from "@/app/components/editor/MarkdownPreview";
import { api, ApiClientError, errorMessage, newRequestId } from "@/lib/client/api";
import { copyToClipboard, exportContent, type ExportFormat } from "@/lib/client/export";
import { formatRelative } from "@/lib/format";
import { REFINE_ACTIONS, TONES, type RefineActionId } from "@/lib/templates/options";
import { countWords, readingTimeMinutes } from "@/lib/text";
import type { SerializedDocument } from "@/lib/serializers";
import { cn } from "@/lib/utils";

export interface EditorContext {
  templateId?: string | null;
  language?: string | null;
  tone?: string | null;
  framework?: string | null;
  generationId?: string | null;
}

interface ContentEditorProps {
  /** Key for the local unsaved-changes backup (document id or generation id). */
  storageKey: string;
  initialTitle: string;
  initialContent: string;
  /** Present when the content is already saved as a document (enables autosave). */
  document?: { id: string; updatedAt: string | null } | null;
  context: EditorContext;
  aiEnabled: boolean;
  onDocumentSaved?: (document: SerializedDocument) => void;
  regenerate?: { onClick: () => void; cost: number; busy: boolean; disabled?: boolean };
  className?: string;
}

type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

interface RefineResponse {
  output: string;
  variants?: string[];
  credits: number | null;
  truncated: boolean;
}

const BACKUP_PREFIX = "scriptly:draft:";

function readBackup(key: string): { title: string; content: string; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(BACKUP_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ContentEditor({
  storageKey,
  initialTitle,
  initialContent,
  document: initialDocument = null,
  context,
  aiEnabled,
  onDocumentSaved,
  regenerate,
  className,
}: ContentEditorProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [doc, setDoc] = useState(initialDocument);
  const [saved, setSaved] = useState({ title: initialTitle, content: initialContent });
  const [saveState, setSaveState] = useState<SaveState>(initialDocument ? "saved" : "idle");
  const [conflict, setConflict] = useState<SerializedDocument | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  // Ref-backed so toast "Undo" actions created in earlier renders still see the latest stack.
  const undoStack = useRef<string[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [busyAction, setBusyAction] = useState<RefineActionId | null>(null);
  const [variants, setVariants] = useState<{ items: string[]; selection: { start: number; end: number } | null } | null>(null);
  const [backup, setBackup] = useState<{ title: string; content: string; savedAt: number } | null>(null);

  const dirty = title !== saved.title || content !== saved.content;
  const latest = useRef({ title, content, doc });
  useEffect(() => {
    latest.current = { title, content, doc };
  });

  // Offer to restore unsaved changes left from a previous visit.
  useEffect(() => {
    const stored = readBackup(storageKey);
    if (stored && (stored.content !== initialContent || stored.title !== initialTitle)) setBackup(stored);
  }, [storageKey, initialContent, initialTitle]);

  // Keep a local backup of unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(BACKUP_PREFIX + storageKey, JSON.stringify({ title, content, savedAt: Date.now() }));
      } catch {
        // Storage full or unavailable: autosave/explicit save still protect the work.
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [title, content, dirty, storageKey]);

  const clearBackup = useCallback(() => {
    try {
      localStorage.removeItem(BACKUP_PREFIX + storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const saving = useRef(false);
  const queued = useRef(false);

  const saveDocument = useCallback(
    async (options: { force?: boolean } = {}) => {
      const current = latest.current;
      if (!current.doc) return;
      if (saving.current) {
        queued.current = true;
        return;
      }
      saving.current = true;
      setSaveState("saving");
      const snapshot = { title: current.title.trim() || "Untitled document", content: current.content };
      try {
        const result = await api<{ document: SerializedDocument }>(`/api/documents/${current.doc.id}`, {
          method: "PATCH",
          body: {
            title: snapshot.title,
            content: snapshot.content,
            ...(options.force || !current.doc.updatedAt ? {} : { baseUpdatedAt: current.doc.updatedAt }),
          },
        });
        const nextDoc = { id: result.document.id, updatedAt: result.document.updatedAt };
        latest.current.doc = nextDoc;
        setDoc(nextDoc);
        setSaved({ title: current.title, content: snapshot.content });
        setConflict(null);
        setSaveState("saved");
        if (latest.current.content === snapshot.content && latest.current.title === current.title) clearBackup();
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "EDIT_CONFLICT") {
          setConflict((err.details?.document as SerializedDocument) ?? null);
          setSaveState("conflict");
        } else {
          setSaveState("error");
          toast.error(errorMessage(err, "Couldn't save your changes."));
        }
      } finally {
        saving.current = false;
        if (queued.current) {
          queued.current = false;
          void saveDocument();
        }
      }
    },
    [clearBackup],
  );

  // Autosave saved documents shortly after the user stops typing.
  useEffect(() => {
    if (!doc || !dirty || saveState === "conflict") return;
    const timer = setTimeout(() => void saveDocument(), 1200);
    return () => clearTimeout(timer);
  }, [title, content, doc, dirty, saveState, saveDocument]);

  async function createDocument() {
    setSaveState("saving");
    try {
      const result = await api<{ document: SerializedDocument }>("/api/documents", {
        body: {
          title: title.trim() || undefined,
          content,
          templateId: context.templateId ?? undefined,
          generationId: context.generationId ?? undefined,
          language: context.language ?? undefined,
          tone: context.tone ?? undefined,
          framework: context.framework && context.framework !== "none" ? context.framework : undefined,
        },
      });
      const created = result.document;
      setDoc({ id: created.id, updatedAt: created.updatedAt });
      setTitle(created.title);
      setSaved({ title: created.title, content });
      setSaveState("saved");
      clearBackup();
      void mutate("/api/dashboard");
      onDocumentSaved?.(created);
      toast.success("Saved to My Documents", {
        action: { label: "Open", onClick: () => router.push(`/documents/${created.id}`) },
      });
    } catch (err) {
      setSaveState("error");
      toast.error(errorMessage(err, "Couldn't save the document."));
    }
  }

  function pushUndo(previous: string) {
    undoStack.current = [...undoStack.current.slice(-19), previous];
    setUndoCount(undoStack.current.length);
  }

  function undo() {
    const stack = undoStack.current;
    if (stack.length === 0) return;
    const previous = stack[stack.length - 1];
    undoStack.current = stack.slice(0, -1);
    setUndoCount(undoStack.current.length);
    setContent(previous);
  }

  function currentSelection() {
    const el = textareaRef.current;
    if (!el || view !== "edit") return null;
    const { selectionStart: start, selectionEnd: end } = el;
    return end > start ? { start, end } : null;
  }

  async function runAction(action: RefineActionId, tone?: string) {
    if (!aiEnabled) {
      toast.error("AI generation isn't configured on this server yet.");
      return;
    }
    const selection = action === "continue" ? null : currentSelection();
    const target = selection ? content.slice(selection.start, selection.end) : content;
    if (!target.trim()) {
      toast.error("There's no text to work with yet.");
      return;
    }
    const meta = REFINE_ACTIONS.find((a) => a.id === action);
    setBusyAction(action);
    try {
      const result = await api<RefineResponse>("/api/refine", {
        body: {
          action,
          content: action === "continue" ? content.slice(-12_000) : target,
          tone,
          language: context.language ?? undefined,
          templateId: context.templateId ?? undefined,
          requestId: newRequestId(),
        },
      });
      void mutate("/api/me");
      if (action === "variants") {
        setVariants({ items: result.variants?.length ? result.variants : [result.output], selection });
        return;
      }
      const output = result.output.trim();
      pushUndo(content);
      if (action === "continue") setContent(`${content.trimEnd()}\n\n${output}`);
      else if (selection) setContent(content.slice(0, selection.start) + output + content.slice(selection.end));
      else setContent(output);
      toast.success(`${meta?.label ?? "Edit"} applied${selection ? " to your selection" : ""}${result.truncated ? " (output was cut short)" : ""}.`, {
        action: { label: "Undo", onClick: undo },
      });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "INSUFFICIENT_CREDITS") {
        toast.error(err.message, { action: { label: "Buy credits", onClick: () => router.push("/billing") } });
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setBusyAction(null);
    }
  }

  function applyVariant(text: string) {
    if (!variants) return;
    pushUndo(content);
    const sel = variants.selection;
    setContent(sel ? content.slice(0, sel.start) + text.trim() + content.slice(sel.end) : text.trim());
    setVariants(null);
    toast.success("Version applied.", { action: { label: "Undo", onClick: undo } });
  }

  async function handleCopy() {
    try {
      await copyToClipboard(content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  function handleExport(format: ExportFormat) {
    if (!content.trim()) {
      toast.error("There's nothing to export yet.");
      return;
    }
    try {
      exportContent(format, title.trim() || "Scriptly document", content);
    } catch (err) {
      toast.error(errorMessage(err, "Export failed."));
    }
  }

  const stats = useMemo(
    () => ({ words: countWords(content), characters: content.length, minutes: readingTimeMinutes(content) }),
    [content],
  );
  const busy = busyAction !== null;
  const actionLabel = REFINE_ACTIONS.find((a) => a.id === busyAction)?.label;

  return (
    <div className={cn("flex flex-col rounded-2xl border border-border bg-card", className)}>
      {backup && (
        <div className="flex flex-col gap-2 border-b border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center">
          <span className="flex-1">You have unsaved changes from {formatRelative(new Date(backup.savedAt).toISOString())}.</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                pushUndo(content);
                setTitle(backup.title);
                setContent(backup.content);
                setBackup(null);
              }}
            >
              Restore
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearBackup();
                setBackup(null);
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      {saveState === "conflict" && (
        <div className="flex flex-col gap-2 border-b border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100 sm:flex-row sm:items-center">
          <span className="flex-1">This document was changed in another tab or device. Choose which version to keep.</span>
          <div className="flex gap-2">
            {conflict && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  pushUndo(content);
                  setTitle(conflict.title);
                  setContent(conflict.content ?? "");
                  setSaved({ title: conflict.title, content: conflict.content ?? "" });
                  setDoc({ id: conflict.id, updatedAt: conflict.updatedAt });
                  setConflict(null);
                  setSaveState("saved");
                }}
              >
                Load latest
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => void saveDocument({ force: true })}>
              Keep mine
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 200))}
          placeholder="Untitled document"
          aria-label="Document title"
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
        />
        <SaveIndicator state={saveState} dirty={dirty} saved={Boolean(doc)} />
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Editor view">
          {(["edit", "preview"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                view === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {mode === "edit" ? <PenLine className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
              {mode === "edit" ? "Write" : "Preview"}
            </button>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={busy || !aiEnabled} className="text-violet-200">
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              AI tools
              <ChevronDown className="size-3.5 opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Applies to selected text, or the whole document
            </DropdownMenuLabel>
            {REFINE_ACTIONS.filter((a) => a.id !== "tone").map((action) => (
              <DropdownMenuItem key={action.id} onSelect={() => void runAction(action.id)}>
                <span className="flex-1">
                  <span className="block">{action.label}</span>
                  <span className="block text-xs text-muted-foreground">{action.description}</span>
                </span>
                <span className="text-xs text-muted-foreground">{action.cost} cr</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className="flex-1">Change tone</span>
                <span className="text-xs text-muted-foreground">1 cr</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                {TONES.map((tone) => (
                  <DropdownMenuItem key={tone.id} onSelect={() => void runAction("tone", tone.id)}>
                    {tone.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" onClick={undo} disabled={undoCount === 0 || busy} aria-label="Undo last AI change">
          <Undo2 aria-hidden />
          <span className="hidden sm:inline">Undo</span>
        </Button>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleCopy} aria-label="Copy to clipboard">
            <Copy aria-hidden />
            <span className="hidden sm:inline">Copy</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Download aria-hidden />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => handleExport("md")}>
                <FileCode2 aria-hidden /> Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport("txt")}>
                <FileText aria-hidden /> Plain text (.txt)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport("html")}>
                <FileCode2 aria-hidden /> HTML (.html)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport("doc")}>
                <FileType aria-hidden /> Word (.doc)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport("pdf")}>
                <Printer aria-hidden /> PDF (print)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {regenerate && (
            <Button variant="outline" size="sm" onClick={regenerate.onClick} disabled={regenerate.busy || regenerate.disabled || busy}>
              {regenerate.busy ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
              Regenerate · {regenerate.cost} cr
            </Button>
          )}
          {doc ? (
            <Button size="sm" variant="secondary" onClick={() => void saveDocument()} disabled={!dirty || saveState === "saving"}>
              {saveState === "saving" ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              Save
            </Button>
          ) : (
            <Button size="sm" onClick={() => void createDocument()} disabled={saveState === "saving" || !content.trim()}>
              {saveState === "saving" ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              Save document
            </Button>
          )}
        </div>
      </div>

      <div className="relative flex-1">
        {view === "edit" ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            dir="auto"
            spellCheck
            aria-label="Content"
            placeholder="Start writing, or generate content with a template…"
            disabled={busy}
            className="block min-h-[460px] w-full resize-y bg-transparent px-5 py-4 text-[15px] leading-7 outline-none [field-sizing:content] placeholder:text-muted-foreground disabled:opacity-60"
          />
        ) : (
          <div className="min-h-[460px] px-5 py-4">
            {content.trim() ? <MarkdownPreview content={content} /> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
          </div>
        )}
        {busy && (
          <div className="absolute inset-x-0 top-3 flex justify-center" aria-live="polite">
            <span className="flex items-center gap-2 rounded-full border border-border bg-popover px-3 py-1.5 text-xs shadow-lg">
              <Loader2 className="size-3.5 animate-spin text-violet-300" aria-hidden /> {actionLabel}…
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {stats.words.toLocaleString("en-US")} words · {stats.characters.toLocaleString("en-US")} characters · {stats.minutes} min read
        </span>
        {doc ? (
          <Link href={`/documents/${doc.id}`} className="hover:text-foreground">
            Saved in My Documents
          </Link>
        ) : (
          <span>Tip: select text to apply AI tools to just that part.</span>
        )}
      </div>

      <Dialog open={variants !== null} onOpenChange={(open) => !open && setVariants(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Alternative versions</DialogTitle>
            <DialogDescription>Pick the version you like best — you can undo afterwards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {variants?.items.map((item, i) => (
              <div key={i} className="rounded-xl border border-border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Version {i + 1}</span>
                  <Button size="sm" onClick={() => applyVariant(item)}>
                    <Check aria-hidden /> Use this version
                  </Button>
                </div>
                <MarkdownPreview content={item} className="text-sm" />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SaveIndicator({ state, dirty, saved }: { state: SaveState; dirty: boolean; saved: boolean }) {
  if (state === "saving") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Saving…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-red-300">
        <CircleAlert className="size-3.5" aria-hidden /> Not saved
      </span>
    );
  }
  if (!saved) return <span className="shrink-0 text-xs text-muted-foreground">Not saved yet</span>;
  if (dirty) return <span className="shrink-0 text-xs text-muted-foreground">Unsaved changes</span>;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-emerald-300">
      <Check className="size-3.5" aria-hidden /> Saved
    </span>
  );
}
