"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Coins, Loader2, Repeat, Sparkles, Target, TriangleAlert } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import TemplateIcon from "@/app/components/app/TemplateIcon";
import {
  CREATIVITY,
  FRAMEWORKS,
  LANGUAGES,
  LENGTHS,
  STYLES,
  TONES,
  type CreativityId,
  type FrameworkId,
  type LengthId,
} from "@/lib/templates/options";
import { getCategory, getGenerationCost, type TemplateDefinition, type TemplateField } from "@/lib/templates/registry";
import { cn } from "@/lib/utils";

export interface GeneratorSettings {
  language: string;
  tone: string;
  style: string;
  length: LengthId;
  framework: FrameworkId;
  creativity: CreativityId;
  brandVoice: string;
  instructions: string;
}

export interface FormState {
  values: Record<string, string>;
  settings: GeneratorSettings;
}

export function defaultFormState(template: TemplateDefinition, prefs: { language?: string; brandVoice?: string } = {}): FormState {
  return {
    values: {},
    settings: {
      language: prefs.language && LANGUAGES.some((l) => l.id === prefs.language) ? prefs.language : "en-US",
      tone: template.defaults.tone,
      style: template.defaults.style ?? "auto",
      length: template.defaults.length,
      framework: template.fixedFramework ?? template.defaults.framework ?? "none",
      creativity: template.defaults.creativity,
      brandVoice: prefs.brandVoice ?? "",
      instructions: "",
    },
  };
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-2 py-1.5 text-center text-xs font-medium transition",
              value === option.value ? "bg-card text-foreground shadow-sm ring-1 ring-violet-400/40" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="block">{option.label}</span>
            {option.hint && <span className="block text-[10px] font-normal text-muted-foreground">{option.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: TemplateField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `field-${field.name}`;
  const describedBy = error ? `${id}-error` : field.help ? `${id}-help` : undefined;
  const common = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  } as const;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {field.label}
        {field.required ? <span className="text-violet-300">*</span> : <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {field.type === "textarea" ? (
        <Textarea
          {...common}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={field.rows ?? 4}
          maxLength={field.maxLength}
          className="resize-y"
        />
      ) : field.type === "select" ? (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger {...common} className="w-full">
            <SelectValue placeholder="Choose an option" />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input {...common} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} maxLength={field.maxLength} />
      )}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : field.help ? (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {field.help}
        </p>
      ) : null}
      {field.type === "textarea" && field.maxLength > 2000 && value.length > 0 && (
        <p className="text-right text-xs tabular-nums text-muted-foreground">
          {value.length.toLocaleString("en-US")} / {field.maxLength.toLocaleString("en-US")}
        </p>
      )}
    </div>
  );
}

export default function GeneratorForm({
  template,
  state,
  onChange,
  errors,
  onSubmit,
  generating,
  credits,
  aiEnabled,
  onChangeTemplate,
}: {
  template: TemplateDefinition;
  state: FormState;
  onChange: (state: FormState) => void;
  errors: Record<string, string>;
  onSubmit: () => void;
  generating: boolean;
  credits: number;
  aiEnabled: boolean;
  onChangeTemplate: () => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(state.settings.brandVoice || state.settings.instructions));
  const cost = getGenerationCost(template, state.settings.length);
  const insufficient = credits < cost;
  const setValue = (name: string, value: string) => onChange({ ...state, values: { ...state.values, [name]: value } });
  const setSetting = <K extends keyof GeneratorSettings>(key: K, value: GeneratorSettings[K]) =>
    onChange({ ...state, settings: { ...state.settings, [key]: value } });
  const fixedFramework = template.fixedFramework ? FRAMEWORKS.find((f) => f.id === template.fixedFramework) : null;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-5"
    >
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-violet-300">
            <TemplateIcon name={template.icon} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug">{template.name}</p>
            <p className="text-xs text-muted-foreground">{getCategory(template.category)?.name}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onChangeTemplate}>
            <Repeat aria-hidden /> Change
          </Button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{template.description}</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
        {template.fields.map((field) => (
          <FieldInput key={field.name} field={field} value={state.values[field.name] ?? ""} error={errors[field.name]} onChange={(v) => setValue(field.name, v)} />
        ))}
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="setting-language">Language</Label>
            <Select value={state.settings.language} onValueChange={(v) => setSetting("language", v)}>
              <SelectTrigger id="setting-language" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.id} value={lang.id}>
                    {lang.label}
                    {lang.native !== lang.label && <span className="text-muted-foreground"> · {lang.native}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="setting-tone">Tone of voice</Label>
            <Select value={state.settings.tone} onValueChange={(v) => setSetting("tone", v)}>
              <SelectTrigger id="setting-tone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {TONES.map((tone) => (
                  <SelectItem key={tone.id} value={tone.id}>
                    {tone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Segmented<LengthId>
          label="Length"
          value={state.settings.length}
          onChange={(v) => setSetting("length", v)}
          options={LENGTHS.map((l) => ({
            value: l.id,
            label: template.lengthLabels?.[l.id] ?? l.label,
            hint: `${getGenerationCost(template, l.id)} cr`,
          }))}
        />

        {fixedFramework ? (
          <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Target className="size-4 text-violet-300" aria-hidden />
            Structured with <span className="font-medium text-foreground">{fixedFramework.label}</span> ({fixedFramework.description})
          </p>
        ) : template.supportsFramework ? (
          <Segmented<FrameworkId>
            label="Copywriting framework"
            value={state.settings.framework}
            onChange={(v) => setSetting("framework", v)}
            options={FRAMEWORKS.map((f) => ({ value: f.id, label: f.short }))}
          />
        ) : null}

        <Segmented<CreativityId>
          label="Creativity"
          value={state.settings.creativity}
          onChange={(v) => setSetting("creativity", v)}
          options={CREATIVITY.map((c) => ({ value: c.id, label: c.label }))}
        />

        <div className="space-y-2">
          <Label htmlFor="setting-style">Writing style</Label>
          <Select value={state.settings.style} onValueChange={(v) => setSetting("style", v)}>
            <SelectTrigger id="setting-style" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STYLES.map((style) => (
                <SelectItem key={style.id} value={style.id}>
                  {style.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
            className="flex w-full items-center justify-between text-sm font-medium"
          >
            Brand information & extra instructions
            <ChevronDown className={cn("size-4 transition", advancedOpen && "rotate-180")} aria-hidden />
          </button>
          {advancedOpen && (
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setting-brand">Brand information</Label>
                <Textarea
                  id="setting-brand"
                  rows={3}
                  maxLength={1500}
                  value={state.settings.brandVoice}
                  onChange={(e) => setSetting("brandVoice", e.target.value)}
                  placeholder="Who you are, what you sell, words you always/never use…"
                  aria-invalid={errors.brandVoice ? true : undefined}
                />
                <p className="text-xs text-muted-foreground">Remembered in this browser for your next generations.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="setting-instructions">Additional instructions</Label>
                <Textarea
                  id="setting-instructions"
                  rows={3}
                  maxLength={1500}
                  value={state.settings.instructions}
                  onChange={(e) => setSetting("instructions", e.target.value)}
                  placeholder="e.g. Mention free shipping. Avoid the word “revolutionary”."
                  aria-invalid={errors.instructions ? true : undefined}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {!aiEnabled ? (
          <p className="flex gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            AI generation isn&apos;t configured on this server yet (OPENAI_API_KEY is missing).
          </p>
        ) : insufficient ? (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            You need {cost} credit{cost === 1 ? "" : "s"} but have {credits}.
            <Link href="/billing" className="font-medium underline underline-offset-4">
              Buy credits
            </Link>
          </p>
        ) : null}
        <Button type="submit" className="h-11 w-full text-base" disabled={generating || !aiEnabled || insufficient}>
          {generating ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
          {generating ? "Generating…" : "Generate"}
          <span className="ml-1 flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs">
            <Coins className="size-3" aria-hidden /> {cost}
          </span>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {credits.toLocaleString("en-US")} credits available · failed generations are refunded automatically
        </p>
      </div>
    </form>
  );
}
