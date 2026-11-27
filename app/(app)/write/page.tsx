"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { FileCheck2, Lightbulb, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { PageContainer } from "@/app/components/app/primitives";
import GeneratorForm, { defaultFormState, type FormState } from "@/app/components/writer/GeneratorForm";
import TemplatePicker from "@/app/components/writer/TemplatePicker";
import ContentEditor from "@/app/components/editor/ContentEditor";
import { useMe } from "@/app/hooks/use-me";
import { api, ApiClientError, errorMessage, newRequestId } from "@/lib/client/api";
import { getGenerationCost, getTemplate } from "@/lib/templates/registry";
import { validateTemplateInputs } from "@/lib/templates/validate";
import { FRAMEWORK_IDS, type CreativityId, type FrameworkId, type LengthId } from "@/lib/templates/options";
import { deriveTitle } from "@/lib/text";
import type { SerializedGeneration } from "@/lib/serializers";

const DEFAULT_TEMPLATE = "ai-writer";
const FORM_KEY = (id: string) => `scriptly:form:${id}`;
const BRAND_KEY = "scriptly:brand";
const LANGUAGE_KEY = "scriptly:language";

interface GenerateResponse {
  generation: SerializedGeneration;
  credits: number | null;
  reused: boolean;
  truncated: boolean;
}

function storageGet(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function storageSet(storage: "local" | "session", key: string, value: string) {
  try {
    (storage === "local" ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    // Storage unavailable (private mode / quota): the form still works, it just isn't restored.
  }
}

function initialForm(templateId: string): FormState {
  const template = getTemplate(templateId) ?? getTemplate(DEFAULT_TEMPLATE)!;
  const base = defaultFormState(template, {
    language: storageGet("local", LANGUAGE_KEY) ?? undefined,
    brandVoice: storageGet("local", BRAND_KEY) ?? undefined,
  });
  const saved = storageGet("session", FORM_KEY(template.id));
  if (!saved) return base;
  try {
    const parsed = JSON.parse(saved) as FormState;
    return { values: parsed.values ?? {}, settings: { ...base.settings, ...parsed.settings } };
  } catch {
    return base;
  }
}

function formFromGeneration(generation: SerializedGeneration): FormState {
  const template = getTemplate(generation.templateId) ?? getTemplate(DEFAULT_TEMPLATE)!;
  const base = defaultFormState(template, { brandVoice: storageGet("local", BRAND_KEY) ?? undefined });
  const framework = (FRAMEWORK_IDS as readonly string[]).includes(generation.framework ?? "") ? (generation.framework as FrameworkId) : base.settings.framework;
  return {
    values: generation.inputs ?? {},
    settings: {
      ...base.settings,
      language: generation.language ?? base.settings.language,
      tone: generation.tone ?? base.settings.tone,
      style: generation.style ?? base.settings.style,
      length: (generation.length as LengthId) ?? base.settings.length,
      framework,
      creativity: (generation.creativity as CreativityId) ?? base.settings.creativity,
      brandVoice: generation.brandVoice ?? base.settings.brandVoice,
      instructions: generation.instructions ?? "",
    },
  };
}

function GeneratingState({ templateName, elapsed }: { templateName: string; elapsed: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6" aria-live="polite" aria-busy="true">
      <div className="mb-6 flex items-center gap-3">
        <Loader2 className="size-5 animate-spin text-violet-300" aria-hidden />
        <div>
          <p className="font-medium">Writing your {templateName.toLowerCase()}…</p>
          <p className="text-xs text-muted-foreground">
            {elapsed}s elapsed · long-form content can take up to a minute
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-6 h-5 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-10/12" />
      </div>
    </div>
  );
}

function WriterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();
  const { data: me } = useMe();
  const templateParam = searchParams.get("template");
  const generationParam = searchParams.get("generation");

  const [templateId, setTemplateId] = useState(() => (templateParam && getTemplate(templateParam) ? templateParam : DEFAULT_TEMPLATE));
  const template = getTemplate(templateId) ?? getTemplate(DEFAULT_TEMPLATE)!;
  const [form, setForm] = useState<FormState>(() => initialForm(templateId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(Boolean(generationParam));
  const [result, setResult] = useState<{ generation: SerializedGeneration; truncated: boolean } | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const loadedGeneration = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const credits = me?.user.credits ?? 0;
  const aiEnabled = me?.features.ai ?? true;

  const switchTemplate = useCallback((id: string) => {
    if (!getTemplate(id)) return;
    setTemplateId(id);
    setForm(initialForm(id));
    setErrors({});
    setError(null);
    setResult(null);
    loadedGeneration.current = null;
  }, []);

  // Follow ?template= changes (e.g. quick-start links while already on this page).
  useEffect(() => {
    if (!generationParam && templateParam && templateParam !== templateId && getTemplate(templateParam)) {
      switchTemplate(templateParam);
    }
  }, [templateParam, generationParam, templateId, switchTemplate]);

  // Reopen a result from history: /write?generation=<id>
  useEffect(() => {
    if (!generationParam || loadedGeneration.current === generationParam) return;
    loadedGeneration.current = generationParam;
    setLoadingHistory(true);
    api<{ generation: SerializedGeneration }>(`/api/history/${generationParam}`)
      .then(({ generation }) => {
        if (getTemplate(generation.templateId)) setTemplateId(generation.templateId);
        setForm(formFromGeneration(generation));
        setErrors({});
        setError(null);
        if (generation.status === "completed" && generation.output) {
          setResult({ generation, truncated: false });
        } else {
          setResult(null);
          setError({ message: generation.errorMessage ?? "This generation didn't complete. Adjust the inputs and generate again." });
        }
      })
      .catch((err) => {
        toast.error(errorMessage(err, "Couldn't open that result."));
      })
      .finally(() => setLoadingHistory(false));
  }, [generationParam]);

  // Persist the form for this template (session) and preferences (browser).
  useEffect(() => {
    const timer = setTimeout(() => {
      storageSet("session", FORM_KEY(templateId), JSON.stringify(form));
      storageSet("local", LANGUAGE_KEY, form.settings.language);
      storageSet("local", BRAND_KEY, form.settings.brandVoice);
    }, 400);
    return () => clearTimeout(timer);
  }, [form, templateId]);

  useEffect(() => {
    if (!generating) return;
    setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [generating]);

  async function generate() {
    const { values, errors: fieldErrors } = validateTemplateInputs(template, form.values);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      document.getElementById(`field-${Object.keys(fieldErrors)[0]}`)?.focus();
      return;
    }
    setErrors({});
    setError(null);
    setGenerating(true);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
    try {
      const response = await api<GenerateResponse>("/api/generate", {
        body: {
          templateId: template.id,
          inputs: values,
          settings: {
            ...form.settings,
            brandVoice: form.settings.brandVoice.trim() || undefined,
            instructions: form.settings.instructions.trim() || undefined,
          },
          requestId: newRequestId(),
        },
      });
      setResult({ generation: response.generation, truncated: response.truncated });
      loadedGeneration.current = response.generation.id;
      router.replace(`/write?template=${template.id}&generation=${response.generation.id}`, { scroll: false });
      void mutate("/api/me");
      void mutate("/api/dashboard");
      if (response.truncated) toast.warning("The output hit the length limit and may be cut short. Try “Continue writing”.");
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : undefined;
      if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR" && Object.keys(err.fields).length > 0) {
        setErrors(err.fields);
      }
      setError({ message: errorMessage(err, "Generation failed. Please try again."), code });
      void mutate("/api/me");
    } finally {
      setGenerating(false);
    }
  }

  const generation = result?.generation;

  return (
    <PageContainer className="max-w-[1500px]">
      <div className="grid gap-6 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] xl:grid-cols-[460px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <GeneratorForm
            template={template}
            state={form}
            onChange={setForm}
            errors={errors}
            onSubmit={() => void generate()}
            generating={generating}
            credits={credits}
            aiEnabled={aiEnabled}
            onChangeTemplate={() => setPickerOpen(true)}
          />
        </aside>

        <section ref={resultRef} className="min-w-0 scroll-mt-20 space-y-4" aria-label="Result">
          {error && (
            <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm sm:flex-row sm:items-center">
              <TriangleAlert className="size-5 shrink-0 text-red-300" aria-hidden />
              <p className="flex-1 text-red-100">{error.message}</p>
              {error.code === "INSUFFICIENT_CREDITS" ? (
                <Button asChild size="sm">
                  <Link href="/billing">Buy credits</Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void generate()} disabled={generating}>
                  Try again
                </Button>
              )}
            </div>
          )}

          {generation?.documentId && (
            <div className="flex flex-col gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm sm:flex-row sm:items-center">
              <FileCheck2 className="size-5 shrink-0 text-emerald-300" aria-hidden />
              <p className="flex-1 text-emerald-100">This result is saved in My Documents. Edits below are a fresh copy.</p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/documents/${generation.documentId}`}>Open document</Link>
              </Button>
            </div>
          )}

          {loadingHistory ? (
            <div className="rounded-2xl border border-border bg-card p-6">
              <Skeleton className="mb-4 h-7 w-1/2" />
              <Skeleton className="h-80 w-full" />
            </div>
          ) : generating ? (
            <GeneratingState templateName={template.name} elapsed={elapsed} />
          ) : generation ? (
            <ContentEditor
              key={generation.id}
              storageKey={`gen:${generation.id}`}
              initialTitle={deriveTitle(generation.output ?? "", `${template.name} draft`)}
              initialContent={generation.output ?? ""}
              context={{
                templateId: generation.templateId,
                language: generation.language,
                tone: generation.tone,
                framework: generation.framework,
                generationId: generation.documentId ? null : generation.id,
              }}
              aiEnabled={aiEnabled}
              regenerate={{
                onClick: () => void generate(),
                cost: getGenerationCost(template, form.settings.length),
                busy: generating,
                disabled: !aiEnabled || credits < getGenerationCost(template, form.settings.length),
              }}
            />
          ) : (
            <div className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary/15 text-violet-300">
                <Sparkles className="size-7" aria-hidden />
              </span>
              <h2 className="text-lg font-semibold">Your content will appear here</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Fill in the details on the left and press <span className="font-medium text-foreground">Generate</span>. You&apos;ll be
                able to edit, refine with AI, save and export the result.
              </p>
              <ul className="mt-6 space-y-2 text-left text-sm text-muted-foreground">
                {[
                  "Specific details (audience, offer, key points) produce sharper copy.",
                  "Add brand information once — it's remembered for next time.",
                  "Select part of the result to improve or rewrite just that section.",
                ].map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-violet-300" aria-hidden />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <TemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        currentId={template.id}
        onSelect={(id) => {
          switchTemplate(id);
          router.replace(`/write?template=${id}`, { scroll: false });
        }}
      />
    </PageContainer>
  );
}

export default function WritePage() {
  return (
    <Suspense fallback={null}>
      <WriterContent />
    </Suspense>
  );
}
