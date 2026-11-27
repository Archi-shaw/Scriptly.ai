/** Generation settings shared by the UI and the server (client-safe). */

export interface LanguageOption {
  id: string;
  label: string;
  native: string;
  rtl?: boolean;
  /** Scripts that need more tokens per word. */
  dense?: boolean;
}

export const LANGUAGES: LanguageOption[] = [
  { id: "en-US", label: "English (US)", native: "English (US)" },
  { id: "en-GB", label: "English (UK)", native: "English (UK)" },
  { id: "es", label: "Spanish", native: "Español" },
  { id: "fr", label: "French", native: "Français" },
  { id: "de", label: "German", native: "Deutsch" },
  { id: "it", label: "Italian", native: "Italiano" },
  { id: "pt-BR", label: "Portuguese (Brazil)", native: "Português (Brasil)" },
  { id: "pt-PT", label: "Portuguese (Portugal)", native: "Português (Portugal)" },
  { id: "nl", label: "Dutch", native: "Nederlands" },
  { id: "pl", label: "Polish", native: "Polski" },
  { id: "sv", label: "Swedish", native: "Svenska" },
  { id: "no", label: "Norwegian", native: "Norsk" },
  { id: "da", label: "Danish", native: "Dansk" },
  { id: "fi", label: "Finnish", native: "Suomi" },
  { id: "cs", label: "Czech", native: "Čeština" },
  { id: "ro", label: "Romanian", native: "Română" },
  { id: "hu", label: "Hungarian", native: "Magyar" },
  { id: "el", label: "Greek", native: "Ελληνικά", dense: true },
  { id: "ru", label: "Russian", native: "Русский", dense: true },
  { id: "uk", label: "Ukrainian", native: "Українська", dense: true },
  { id: "tr", label: "Turkish", native: "Türkçe" },
  { id: "ar", label: "Arabic", native: "العربية", rtl: true, dense: true },
  { id: "he", label: "Hebrew", native: "עברית", rtl: true, dense: true },
  { id: "hi", label: "Hindi", native: "हिन्दी", dense: true },
  { id: "bn", label: "Bengali", native: "বাংলা", dense: true },
  { id: "ur", label: "Urdu", native: "اردو", rtl: true, dense: true },
  { id: "ta", label: "Tamil", native: "தமிழ்", dense: true },
  { id: "te", label: "Telugu", native: "తెలుగు", dense: true },
  { id: "mr", label: "Marathi", native: "मराठी", dense: true },
  { id: "id", label: "Indonesian", native: "Bahasa Indonesia" },
  { id: "ms", label: "Malay", native: "Bahasa Melayu" },
  { id: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { id: "th", label: "Thai", native: "ไทย", dense: true },
  { id: "tl", label: "Filipino", native: "Filipino" },
  { id: "ja", label: "Japanese", native: "日本語", dense: true },
  { id: "ko", label: "Korean", native: "한국어", dense: true },
  { id: "zh-CN", label: "Chinese (Simplified)", native: "简体中文", dense: true },
  { id: "zh-TW", label: "Chinese (Traditional)", native: "繁體中文", dense: true },
  { id: "sw", label: "Swahili", native: "Kiswahili" },
];

export interface ToneOption {
  id: string;
  label: string;
  description: string;
}

export const TONES: ToneOption[] = [
  { id: "professional", label: "Professional", description: "polished, credible and clear; confident without jargon" },
  { id: "friendly", label: "Friendly", description: "warm, approachable and positive" },
  { id: "conversational", label: "Conversational", description: "natural and easy-going, like talking to a smart friend; contractions are fine" },
  { id: "persuasive", label: "Persuasive", description: "benefit-driven and confident, giving clear reasons to act" },
  { id: "humorous", label: "Humorous", description: "light, witty and playful while still delivering the message" },
  { id: "formal", label: "Formal", description: "precise, respectful and businesslike; no slang or contractions" },
  { id: "casual", label: "Casual", description: "relaxed, informal and down-to-earth" },
  { id: "creative", label: "Creative", description: "imaginative, vivid and original in word choice" },
  { id: "inspirational", label: "Inspirational", description: "uplifting, motivating and aspirational" },
  { id: "authoritative", label: "Authoritative", description: "expert, decisive and grounded in clear reasoning" },
  { id: "empathetic", label: "Empathetic", description: "understanding, supportive and reassuring" },
  { id: "bold", label: "Bold", description: "punchy, confident and attention-grabbing" },
  { id: "luxury", label: "Luxurious", description: "elegant, refined and exclusive" },
  { id: "urgent", label: "Urgent", description: "time-sensitive and action-oriented, without inventing false scarcity" },
];

export interface StyleOption {
  id: string;
  label: string;
  description: string;
}

export const STYLES: StyleOption[] = [
  { id: "auto", label: "Best for this template", description: "" },
  { id: "clear", label: "Clear & concise", description: "short sentences, plain language and no filler" },
  { id: "storytelling", label: "Storytelling", description: "narrative-driven with relatable scenarios and a clear arc" },
  { id: "educational", label: "Educational", description: "explains step by step with concrete examples" },
  { id: "analytical", label: "Analytical", description: "logical and specific, comparing options and reasoning explicitly (never invent statistics)" },
  { id: "descriptive", label: "Descriptive", description: "vivid, sensory detail that helps the reader picture it" },
  { id: "seo", label: "SEO-focused", description: "scannable structure, descriptive headings and natural keyword use" },
  { id: "technical", label: "Technical", description: "precise terminology for an expert audience" },
  { id: "minimalist", label: "Minimalist", description: "as few words as possible while staying complete" },
];

export interface LengthOption {
  id: "short" | "medium" | "long";
  label: string;
}

export const LENGTHS: LengthOption[] = [
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
];

export interface FrameworkOption {
  id: "none" | "aida" | "pas" | "bab";
  label: string;
  short: string;
  description: string;
}

export const FRAMEWORKS: FrameworkOption[] = [
  { id: "none", label: "No framework", short: "None", description: "Let Scriptly choose the best structure for the format." },
  { id: "aida", label: "AIDA", short: "AIDA", description: "Attention → Interest → Desire → Action" },
  { id: "pas", label: "PAS", short: "PAS", description: "Problem → Agitate → Solution" },
  { id: "bab", label: "BAB", short: "BAB", description: "Before → After → Bridge" },
];

export interface CreativityOption {
  id: "focused" | "balanced" | "creative";
  label: string;
  description: string;
  temperature: number;
}

export const CREATIVITY: CreativityOption[] = [
  { id: "focused", label: "Focused", description: "Precise and predictable", temperature: 0.4 },
  { id: "balanced", label: "Balanced", description: "Natural variety", temperature: 0.7 },
  { id: "creative", label: "Creative", description: "Bolder, more original ideas", temperature: 1.0 },
];

export type LanguageId = string;
export type ToneId = string;
export type StyleId = string;
export type LengthId = LengthOption["id"];
export type FrameworkId = FrameworkOption["id"];
export type CreativityId = CreativityOption["id"];

export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id) as [string, ...string[]];
export const TONE_IDS = TONES.map((t) => t.id) as [string, ...string[]];
export const STYLE_IDS = STYLES.map((s) => s.id) as [string, ...string[]];
export const LENGTH_IDS = ["short", "medium", "long"] as const;
export const FRAMEWORK_IDS = ["none", "aida", "pas", "bab"] as const;
export const CREATIVITY_IDS = ["focused", "balanced", "creative"] as const;

export const findLanguage = (id: string) => LANGUAGES.find((l) => l.id === id);
export const findTone = (id: string) => TONES.find((t) => t.id === id);
export const findStyle = (id: string) => STYLES.find((s) => s.id === id);
export const findFramework = (id: string) => FRAMEWORKS.find((f) => f.id === id);
export const findCreativity = (id: string) => CREATIVITY.find((c) => c.id === id);

/** Editor refinement actions (each is a real AI operation). */
export const REFINE_ACTIONS = [
  { id: "improve", label: "Improve writing", description: "Sharper wording, better flow", cost: 1 },
  { id: "expand", label: "Expand", description: "Add depth and detail", cost: 1 },
  { id: "shorten", label: "Shorten", description: "Make it more concise", cost: 1 },
  { id: "rewrite", label: "Rewrite", description: "Fresh wording, same meaning", cost: 1 },
  { id: "tone", label: "Change tone", description: "Rewrite in another tone", cost: 1 },
  { id: "grammar", label: "Fix grammar", description: "Spelling, grammar and punctuation", cost: 1 },
  { id: "continue", label: "Continue writing", description: "Write the next part", cost: 1 },
  { id: "variants", label: "Alternative versions", description: "Three different takes", cost: 2 },
] as const;

export type RefineActionId = (typeof REFINE_ACTIONS)[number]["id"];
export const REFINE_ACTION_IDS = REFINE_ACTIONS.map((a) => a.id) as [RefineActionId, ...RefineActionId[]];

export function getRefineCost(action: RefineActionId): number {
  return REFINE_ACTIONS.find((a) => a.id === action)?.cost ?? 1;
}
