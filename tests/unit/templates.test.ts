import { describe, expect, it } from "vitest";
import { TEMPLATE_INSTRUCTIONS } from "@/lib/ai/template-instructions";
import { LANGUAGES, TONES } from "@/lib/templates/options";
import { TEMPLATES, TEMPLATE_CATEGORIES, getGenerationCost, getTemplate, searchTemplates } from "@/lib/templates/registry";
import { generationSettingsSchema, validateTemplateInputs } from "@/lib/templates/validate";

describe("template library", () => {
  it("has at least 50 distinct templates with unique ids and names", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    expect(new Set(TEMPLATES.map((t) => t.name)).size).toBe(TEMPLATES.length);
  });

  it("covers every category and every template belongs to a known category", () => {
    const categories = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
    for (const t of TEMPLATES) expect(categories.has(t.category)).toBe(true);
    for (const c of TEMPLATE_CATEGORIES) expect(TEMPLATES.some((t) => t.category === c.id)).toBe(true);
  });

  it("gives every template server-side AI instructions (and no orphans)", () => {
    for (const t of TEMPLATES) expect(TEMPLATE_INSTRUCTIONS[t.id], t.id).toBeTruthy();
    for (const id of Object.keys(TEMPLATE_INSTRUCTIONS)) expect(getTemplate(id), id).toBeDefined();
  });

  it("defines usable fields and defaults", () => {
    for (const t of TEMPLATES) {
      expect(t.fields.length, t.id).toBeGreaterThan(0);
      expect(t.fields.some((f) => f.required), `${t.id} needs at least one required field`).toBe(true);
      expect(new Set(t.fields.map((f) => f.name)).size, t.id).toBe(t.fields.length);
      for (const f of t.fields) {
        expect(f.maxLength).toBeGreaterThan(0);
        if (f.type === "select") expect(f.options?.length).toBeGreaterThan(0);
      }
      expect(TONES.some((tone) => tone.id === t.defaults.tone), t.id).toBe(true);
      expect(generationSettingsSchema.safeParse({ ...t.defaults, language: "en-US" }).success, t.id).toBe(true);
    }
  });

  it("supports the AIDA, PAS and BAB frameworks", () => {
    expect(getTemplate("aida-copywriter")?.fixedFramework).toBe("aida");
    expect(getTemplate("pas-copywriter")?.fixedFramework).toBe("pas");
    expect(getTemplate("bab-copywriter")?.fixedFramework).toBe("bab");
    expect(TEMPLATES.filter((t) => t.supportsFramework).length).toBeGreaterThan(5);
  });

  it("offers at least 25 languages and 10 tones", () => {
    expect(LANGUAGES.length).toBeGreaterThanOrEqual(25);
    expect(new Set(LANGUAGES.map((l) => l.id)).size).toBe(LANGUAGES.length);
    expect(TONES.length).toBeGreaterThanOrEqual(10);
  });

  it("prices generations by output size", () => {
    expect(getGenerationCost(getTemplate("instagram-caption")!, "medium")).toBe(1);
    expect(getGenerationCost(getTemplate("professional-email")!, "medium")).toBe(2);
    expect(getGenerationCost(getTemplate("blog-post")!, "medium")).toBe(3);
    expect(getGenerationCost(getTemplate("blog-post")!, "long")).toBe(4);
  });

  it("searches by name, description, category and tags", () => {
    expect(searchTemplates("youtube").map((t) => t.id)).toContain("youtube-script");
    expect(searchTemplates("amazon").map((t) => t.id)).toContain("amazon-listing");
    expect(searchTemplates("", "email").every((t) => t.category === "email")).toBe(true);
    expect(searchTemplates("zzzz-nothing")).toHaveLength(0);
  });
});

describe("template input validation", () => {
  const blog = getTemplate("blog-post")!;

  it("requires required fields and trims values", () => {
    expect(validateTemplateInputs(blog, {}).errors.topic).toMatch(/required/);
    const ok = validateTemplateInputs(blog, { topic: "  Content calendars  ", keywords: "" });
    expect(ok.errors).toEqual({});
    expect(ok.values).toEqual({ topic: "Content calendars" });
  });

  it("drops unknown fields and non-string values", () => {
    const { values } = validateTemplateInputs(blog, { topic: "x", evil: "y", audience: { $ne: 1 } as unknown as string });
    expect(values).toEqual({ topic: "x" });
  });

  it("enforces max length, select options and outline size", () => {
    expect(validateTemplateInputs(blog, { topic: "x".repeat(201) }).errors.topic).toMatch(/200/);
    const hashtags = getTemplate("hashtag-generator")!;
    expect(validateTemplateInputs(hashtags, { topic: "x", platform: "MySpace" }).errors.platform).toBeDefined();
    expect(validateTemplateInputs(hashtags, { topic: "x", platform: "TikTok" }).errors).toEqual({});
    const article = getTemplate("article-generator")!;
    expect(validateTemplateInputs(article, { title: "T", outline: "One\nTwo" }).errors.outline).toMatch(/3/);
  });
});
