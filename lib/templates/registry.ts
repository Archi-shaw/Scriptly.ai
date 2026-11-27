import type { CreativityId, FrameworkId, LengthId, StyleId, ToneId } from "@/lib/templates/options";

/**
 * Template library (client-safe metadata). Template-specific AI instructions
 * live server-side in lib/ai/template-instructions.ts.
 */

export type TemplateCategoryId =
  | "blog"
  | "seo"
  | "social"
  | "ads"
  | "marketing"
  | "ecommerce"
  | "email"
  | "website"
  | "business"
  | "video"
  | "writing";

export interface TemplateCategory {
  id: TemplateCategoryId;
  name: string;
  description: string;
  icon: string;
}

export type FieldType = "text" | "textarea" | "select" | "keywords";

export interface TemplateField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  maxLength: number;
  rows?: number;
  options?: { value: string; label: string }[];
}

/** Output shape; drives length guidance, token budget and credit cost. */
export type OutputKind = "list" | "short" | "medium" | "long";

export interface TemplateDefinition {
  id: string;
  name: string;
  category: TemplateCategoryId;
  description: string;
  icon: string;
  kind: OutputKind;
  fields: TemplateField[];
  defaults: { tone: ToneId; length: LengthId; creativity: CreativityId; style?: StyleId; framework?: FrameworkId };
  /** Whether the user may pick AIDA/PAS/BAB for this template. */
  supportsFramework?: boolean;
  /** Framework-specific templates always use this framework. */
  fixedFramework?: Exclude<FrameworkId, "none">;
  /** Shown instead of the generic length labels when the template measures length differently. */
  lengthLabels?: Partial<Record<LengthId, string>>;
  popular?: boolean;
  tags?: string[];
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: "blog", name: "Blog Writing", description: "Ideas, outlines and full articles", icon: "FileText" },
  { id: "seo", name: "SEO", description: "Rank higher and earn the click", icon: "Search" },
  { id: "social", name: "Social Media", description: "Posts, captions, bios and threads", icon: "Hash" },
  { id: "ads", name: "Advertising", description: "High-converting ad copy", icon: "Megaphone" },
  { id: "marketing", name: "Marketing", description: "Frameworks, campaigns and branding", icon: "Target" },
  { id: "ecommerce", name: "E-commerce", description: "Product pages that sell", icon: "ShoppingBag" },
  { id: "email", name: "Email Writing", description: "Outreach, newsletters and replies", icon: "Mail" },
  { id: "website", name: "Website Copy", description: "Landing pages and site sections", icon: "LayoutTemplate" },
  { id: "business", name: "Business Writing", description: "Proposals, pitches and HR docs", icon: "Briefcase" },
  { id: "video", name: "Video & Scripts", description: "Scripts, hooks and descriptions", icon: "Clapperboard" },
  { id: "writing", name: "Writing Tools", description: "Rewrite, summarise and repurpose", icon: "PenLine" },
];

// ---------------------------------------------------------------------------
// Field builders
// ---------------------------------------------------------------------------

type FieldOverrides = Partial<Omit<TemplateField, "name" | "type">>;

const text = (name: string, label: string, o: FieldOverrides = {}): TemplateField => ({
  name,
  label,
  type: "text",
  maxLength: 200,
  ...o,
});

const area = (name: string, label: string, o: FieldOverrides = {}): TemplateField => ({
  name,
  label,
  type: "textarea",
  maxLength: 2000,
  rows: 4,
  ...o,
});

const select = (name: string, label: string, options: string[], o: FieldOverrides = {}): TemplateField => ({
  name,
  label,
  type: "select",
  maxLength: 60,
  options: options.map((v) => ({ value: v, label: v })),
  ...o,
});

const keywords = (o: FieldOverrides = {}): TemplateField => ({
  name: "keywords",
  label: "Keywords",
  type: "keywords",
  maxLength: 300,
  placeholder: "e.g. content marketing, AI writing tools",
  help: "Separate keywords with commas.",
  ...o,
});

const audience = (o: FieldOverrides = {}): TemplateField =>
  text("audience", "Target audience", { placeholder: "e.g. busy startup founders", ...o });

const topic = (o: FieldOverrides = {}): TemplateField =>
  text("topic", "Topic", { required: true, placeholder: "What is it about?", ...o });

const product = (o: FieldOverrides = {}): TemplateField =>
  text("productName", "Product or service name", { required: true, placeholder: "e.g. Scriptly.ai", ...o });

const details = (o: FieldOverrides = {}): TemplateField =>
  area("description", "Key details", { placeholder: "Describe what matters: features, context, goals…", ...o });

const cta = (o: FieldOverrides = {}): TemplateField =>
  text("cta", "Call to action", { placeholder: "e.g. Start your free trial", ...o });

const brand = (o: FieldOverrides = {}): TemplateField =>
  text("brand", "Brand or company name", { placeholder: "e.g. Acme Inc.", ...o });

const content = (o: FieldOverrides = {}): TemplateField =>
  area("content", "Your content", { required: true, maxLength: 12000, rows: 10, placeholder: "Paste the text here…", ...o });

const PLATFORMS = ["Instagram", "TikTok", "LinkedIn", "X (Twitter)", "YouTube", "Facebook", "Pinterest"];

const D = {
  pro: { tone: "professional", length: "medium", creativity: "balanced" },
  friendly: { tone: "friendly", length: "medium", creativity: "balanced" },
  conv: { tone: "conversational", length: "medium", creativity: "balanced" },
  persuasive: { tone: "persuasive", length: "medium", creativity: "balanced" },
  creative: { tone: "creative", length: "medium", creativity: "creative" },
  focused: { tone: "professional", length: "medium", creativity: "focused" },
} satisfies Record<string, TemplateDefinition["defaults"]>;

const OPTIONS_LENGTH = { short: "3 options", medium: "5 options", long: "10 options" } as const;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const TEMPLATES: TemplateDefinition[] = [
  // ── Blog Writing ──────────────────────────────────────────────────────────
  {
    id: "blog-post",
    name: "Blog Post Generator",
    category: "blog",
    description: "A complete, SEO-friendly blog post with clear headings, an engaging intro and a strong conclusion.",
    icon: "FileText",
    kind: "long",
    fields: [
      topic({ label: "Blog title or topic", placeholder: "e.g. How to build a content calendar that actually works" }),
      keywords(),
      audience(),
      details({ label: "Points to cover (optional)" }),
    ],
    defaults: D.conv,
    supportsFramework: false,
    popular: true,
    tags: ["article", "long-form", "seo"],
  },
  {
    id: "article-generator",
    name: "Article Generator",
    category: "blog",
    description: "Turn a title and an outline into a fully written, well-structured long-form article.",
    icon: "Newspaper",
    kind: "long",
    fields: [
      text("title", "Article title", { required: true, placeholder: "e.g. The 15 Best Places to Live in the US" }),
      area("outline", "Outline", {
        required: true,
        placeholder: "One subheading per line (at least 3)",
        help: "Each line becomes a section of the article.",
        rows: 6,
      }),
      keywords({ label: "Focus keywords" }),
      audience(),
    ],
    defaults: D.pro,
    tags: ["long-form", "outline"],
  },
  {
    id: "blog-ideas",
    name: "Blog Ideas",
    category: "blog",
    description: "Fresh, audience-focused article ideas with a one-line angle for each.",
    icon: "Lightbulb",
    kind: "list",
    fields: [topic({ label: "Niche or topic", placeholder: "e.g. personal finance for freelancers" }), audience(), details({ label: "Goals or angle (optional)" })],
    defaults: D.creative,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["brainstorm", "content plan"],
  },
  {
    id: "blog-titles",
    name: "Blog Titles",
    category: "blog",
    description: "Catchy, click-worthy titles that promise value without clickbait.",
    icon: "Heading",
    kind: "list",
    fields: [topic(), keywords(), audience()],
    defaults: D.creative,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["headline"],
  },
  {
    id: "listicle-titles",
    name: "Listicle Titles",
    category: "blog",
    description: "Numbered headlines for list posts — the most clicked title format.",
    icon: "ListOrdered",
    kind: "list",
    fields: [topic(), audience()],
    defaults: D.creative,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["headline", "list"],
  },
  {
    id: "blog-intro",
    name: "Blog Introduction",
    category: "blog",
    description: "An opening that hooks readers and makes them want the rest of the article.",
    icon: "AlignLeft",
    kind: "short",
    fields: [text("title", "Blog title", { required: true }), audience(), details({ label: "Main angle or key takeaway (optional)" })],
    defaults: D.conv,
    tags: ["intro", "hook"],
  },
  {
    id: "blog-outline",
    name: "Blog Outline",
    category: "blog",
    description: "A structured H2/H3 outline with notes, ready to write from.",
    icon: "ListTree",
    kind: "medium",
    fields: [topic({ label: "Blog title or topic" }), keywords(), audience()],
    defaults: D.focused,
    tags: ["structure", "plan"],
  },
  {
    id: "blog-section",
    name: "Blog Section Writer",
    category: "blog",
    description: "Write a complete section — several paragraphs — for one subheading of your article.",
    icon: "Rows3",
    kind: "medium",
    fields: [
      text("title", "Article title (optional)"),
      text("subheading", "Section subheading", { required: true, placeholder: "e.g. Why consistency beats intensity" }),
      details({ label: "Points to cover (optional)" }),
    ],
    defaults: D.conv,
    tags: ["section", "paragraphs"],
  },
  {
    id: "blog-paragraph",
    name: "Blog Paragraph Writer",
    category: "blog",
    description: "An original, human-sounding paragraph from a subheading and a few key points.",
    icon: "Pilcrow",
    kind: "short",
    fields: [
      text("subheading", "Subheading", { required: true }),
      details({ label: "Key points (optional)" }),
      keywords(),
    ],
    defaults: D.conv,
    tags: ["paragraph"],
  },
  {
    id: "blog-conclusion",
    name: "Blog Conclusion",
    category: "blog",
    description: "A memorable conclusion that summarises, lands the takeaway and prompts action.",
    icon: "Flag",
    kind: "short",
    fields: [text("title", "Blog title", { required: true }), details({ label: "Main points of the article" }), cta()],
    defaults: D.conv,
    tags: ["outro", "ending"],
  },
  {
    id: "talking-points",
    name: "Talking Points",
    category: "blog",
    description: "Short, informative points to develop under each subheading of an article.",
    icon: "MessageSquareText",
    kind: "medium",
    fields: [text("title", "Article title", { required: true }), area("subheadings", "Subheadings", { required: true, placeholder: "One per line" })],
    defaults: D.focused,
    tags: ["bullets", "notes"],
  },
  {
    id: "pros-cons",
    name: "Pros & Cons",
    category: "blog",
    description: "A balanced list of pros and cons for a product, service, tool or decision.",
    icon: "Scale",
    kind: "medium",
    fields: [topic({ label: "Product, service or decision" }), details({ label: "Context (optional)" }), audience()],
    defaults: D.focused,
    tags: ["comparison", "review"],
  },

  // ── SEO ───────────────────────────────────────────────────────────────────
  {
    id: "seo-meta-description",
    name: "SEO Meta Description",
    category: "seo",
    description: "Search-friendly meta descriptions under 155 characters that earn the click.",
    icon: "Search",
    kind: "list",
    fields: [text("title", "Page title", { required: true }), details({ label: "What the page is about" }), keywords({ label: "Target keyword" })],
    defaults: D.persuasive,
    lengthLabels: OPTIONS_LENGTH,
    popular: true,
    tags: ["meta", "serp"],
  },
  {
    id: "seo-title",
    name: "SEO Title Generator",
    category: "seo",
    description: "Title tags under 60 characters that balance keywords and click-through rate.",
    icon: "Type",
    kind: "list",
    fields: [topic({ label: "Page topic" }), keywords({ label: "Target keyword" }), brand({ label: "Brand name (optional)" })],
    defaults: D.focused,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["title tag", "serp"],
  },
  {
    id: "keyword-article",
    name: "Keyword-Based Article",
    category: "seo",
    description: "A long-form article built around a primary keyword and its search intent.",
    icon: "FileSearch",
    kind: "long",
    fields: [
      text("primaryKeyword", "Primary keyword", { required: true, placeholder: "e.g. best running shoes for flat feet" }),
      keywords({ label: "Secondary keywords" }),
      select("searchIntent", "Search intent", ["Informational", "Commercial investigation", "Transactional", "Navigational"]),
      audience(),
      details({ label: "Notes or angle (optional)" }),
    ],
    defaults: D.pro,
    tags: ["seo article", "ranking"],
  },
  {
    id: "keyword-ideas",
    name: "Keyword Ideas",
    category: "seo",
    description: "Long-tail keyword ideas grouped by search intent, with content suggestions.",
    icon: "KeyRound",
    kind: "list",
    fields: [topic({ label: "Seed keyword or topic" }), audience(), text("market", "Market or location (optional)", { placeholder: "e.g. India, US small businesses" })],
    defaults: D.focused,
    lengthLabels: { short: "10 keywords", medium: "20 keywords", long: "40 keywords" },
    tags: ["research", "long-tail"],
  },
  {
    id: "content-brief",
    name: "SEO Content Brief",
    category: "seo",
    description: "A writer-ready brief: intent, angle, outline, questions to answer and on-page tips.",
    icon: "ClipboardList",
    kind: "medium",
    fields: [text("primaryKeyword", "Primary keyword", { required: true }), audience(), details({ label: "Business goal or notes (optional)" })],
    defaults: D.focused,
    tags: ["brief", "planning"],
  },
  {
    id: "faq-generator",
    name: "FAQ Generator",
    category: "seo",
    description: "Helpful questions and answers for a page, product or topic — great for FAQ rich results.",
    icon: "CircleHelp",
    kind: "medium",
    fields: [topic({ label: "Page, product or topic" }), details({ label: "Context and facts to rely on" }), audience()],
    defaults: D.friendly,
    tags: ["faq", "schema"],
  },

  // ── Social Media ──────────────────────────────────────────────────────────
  {
    id: "linkedin-post",
    name: "LinkedIn Post",
    category: "social",
    description: "Thoughtful, scannable posts that start conversations on LinkedIn.",
    icon: "Linkedin",
    kind: "short",
    fields: [topic({ placeholder: "e.g. What I learned from our first 100 customers" }), details({ label: "Story, insight or key message" }), audience(), cta({ label: "Call to action (optional)" })],
    defaults: D.conv,
    supportsFramework: true,
    popular: true,
    tags: ["linkedin", "thought leadership"],
  },
  {
    id: "instagram-caption",
    name: "Instagram Caption",
    category: "social",
    description: "Scroll-stopping captions with emojis and a relevant hashtag set.",
    icon: "Instagram",
    kind: "short",
    fields: [details({ label: "What is the post about?", required: true }), audience(), cta({ label: "Call to action (optional)" })],
    defaults: D.friendly,
    popular: true,
    tags: ["instagram", "caption", "hashtags"],
  },
  {
    id: "instagram-bio",
    name: "Instagram Bio",
    category: "social",
    description: "A memorable bio that says who you are and what you offer in 150 characters.",
    icon: "UserRound",
    kind: "list",
    fields: [brand({ label: "Name or brand", required: true }), details({ label: "What you do / what you offer", required: true }), cta({ label: "Link or CTA (optional)" })],
    defaults: D.creative,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["instagram", "profile"],
  },
  {
    id: "twitter-post",
    name: "X / Twitter Post",
    category: "social",
    description: "Punchy posts under 280 characters built for replies and reposts.",
    icon: "Twitter",
    kind: "list",
    fields: [topic(), details({ label: "Angle or key point (optional)" }), audience()],
    defaults: D.conv,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["twitter", "x", "tweet"],
  },
  {
    id: "twitter-thread",
    name: "X / Twitter Thread",
    category: "social",
    description: "An engaging numbered thread that teaches something or tells a story.",
    icon: "MessagesSquare",
    kind: "medium",
    fields: [topic(), details({ label: "Key points to include" }), audience()],
    defaults: D.conv,
    lengthLabels: { short: "5 posts", medium: "8 posts", long: "12 posts" },
    tags: ["twitter", "x", "thread"],
  },
  {
    id: "facebook-post",
    name: "Facebook Post",
    category: "social",
    description: "Friendly, engaging posts for your page or community group.",
    icon: "Facebook",
    kind: "short",
    fields: [topic(), details({ label: "Details (optional)" }), cta({ label: "Call to action (optional)" })],
    defaults: D.friendly,
    tags: ["facebook", "community"],
  },
  {
    id: "tiktok-caption",
    name: "TikTok Caption & Hashtags",
    category: "social",
    description: "Short, catchy TikTok captions with trending-style hashtags.",
    icon: "Music2",
    kind: "list",
    fields: [details({ label: "What happens in the video?", required: true }), audience()],
    defaults: D.creative,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["tiktok", "short video"],
  },
  {
    id: "hashtag-generator",
    name: "Hashtag Generator",
    category: "social",
    description: "A balanced mix of broad, niche and branded hashtags for more reach.",
    icon: "Hash",
    kind: "list",
    fields: [topic(), select("platform", "Platform", PLATFORMS, { required: true }), audience()],
    defaults: D.focused,
    lengthLabels: { short: "10 hashtags", medium: "20 hashtags", long: "30 hashtags" },
    tags: ["hashtags", "reach"],
  },
  {
    id: "pinterest-pin",
    name: "Pinterest Pin Description",
    category: "social",
    description: "Keyword-rich pin titles and descriptions that get saved and clicked.",
    icon: "Pin",
    kind: "short",
    fields: [topic({ label: "What is the pin about?" }), keywords(), details({ label: "Details (optional)" })],
    defaults: D.friendly,
    tags: ["pinterest"],
  },

  // ── Advertising ───────────────────────────────────────────────────────────
  {
    id: "facebook-ad",
    name: "Facebook Ad Copy",
    category: "ads",
    description: "Primary text, headline and description variations for Meta (Facebook & Instagram) ads.",
    icon: "Facebook",
    kind: "medium",
    fields: [
      product(),
      details({ label: "Product details", required: true }),
      audience(),
      text("usp", "Unique selling proposition", { placeholder: "What makes it different?" }),
      text("offer", "Offer (optional)", { placeholder: "e.g. 20% off this week" }),
      cta(),
    ],
    defaults: D.persuasive,
    supportsFramework: true,
    popular: true,
    tags: ["meta ads", "paid social"],
  },
  {
    id: "google-ad",
    name: "Google Ads Copy",
    category: "ads",
    description: "Responsive search ad headlines (≤30 chars) and descriptions (≤90 chars).",
    icon: "Search",
    kind: "medium",
    fields: [product(), details({ label: "Product details", required: true }), keywords({ label: "Target keywords" }), text("usp", "Unique selling proposition"), cta()],
    defaults: D.persuasive,
    tags: ["google ads", "ppc", "sem"],
  },
  {
    id: "linkedin-ad",
    name: "LinkedIn Ad Copy",
    category: "ads",
    description: "B2B ad copy that speaks to decision-makers and drives qualified clicks.",
    icon: "Linkedin",
    kind: "medium",
    fields: [product(), details({ label: "Product details", required: true }), audience({ placeholder: "e.g. HR directors at mid-size companies" }), text("offer", "Offer (optional)", { placeholder: "e.g. free ebook" }), cta()],
    defaults: D.pro,
    supportsFramework: true,
    tags: ["b2b", "linkedin ads"],
  },
  {
    id: "instagram-ad",
    name: "Instagram Ad Copy",
    category: "ads",
    description: "Visual-first ad captions with a strong hook and a clear CTA.",
    icon: "Instagram",
    kind: "short",
    fields: [product(), details({ label: "Product details", required: true }), audience(), text("offer", "Offer (optional)"), cta()],
    defaults: D.persuasive,
    supportsFramework: true,
    tags: ["instagram ads"],
  },
  {
    id: "ad-headlines",
    name: "Ad Headlines",
    category: "ads",
    description: "High-converting headlines for any ad platform, built around one clear benefit.",
    icon: "Zap",
    kind: "list",
    fields: [product(), details({ label: "Product details", required: true }), audience(), text("usp", "Unique selling proposition")],
    defaults: D.persuasive,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["headline", "ads"],
  },

  // ── Marketing ─────────────────────────────────────────────────────────────
  {
    id: "aida-copywriter",
    name: "AIDA Copywriter",
    category: "marketing",
    description: "Attention, Interest, Desire, Action — the classic framework for persuasive copy.",
    icon: "Sparkles",
    kind: "medium",
    fields: [product(), details({ label: "Product details", required: true }), audience(), cta()],
    defaults: { ...D.persuasive, framework: "aida" },
    fixedFramework: "aida",
    popular: true,
    tags: ["framework", "copywriting"],
  },
  {
    id: "pas-copywriter",
    name: "PAS Copywriter",
    category: "marketing",
    description: "Problem, Agitate, Solution — copy that starts from your customer's pain.",
    icon: "Target",
    kind: "medium",
    fields: [product(), details({ label: "Product details", required: true }), audience(), text("problem", "Customer problem (optional)", { placeholder: "e.g. hours lost writing content" })],
    defaults: { ...D.persuasive, framework: "pas" },
    fixedFramework: "pas",
    tags: ["framework", "copywriting"],
  },
  {
    id: "bab-copywriter",
    name: "BAB Copywriter",
    category: "marketing",
    description: "Before, After, Bridge — show the transformation your product makes possible.",
    icon: "ArrowRightLeft",
    kind: "medium",
    fields: [product(), details({ label: "Product details", required: true }), audience(), cta()],
    defaults: { ...D.persuasive, framework: "bab" },
    fixedFramework: "bab",
    tags: ["framework", "copywriting"],
  },
  {
    id: "marketing-campaign",
    name: "Marketing Campaign Plan",
    category: "marketing",
    description: "A multi-channel campaign: big idea, messaging, channels, timeline and KPIs.",
    icon: "CalendarDays",
    kind: "long",
    fields: [
      product(),
      area("goal", "Campaign goal", { required: true, placeholder: "e.g. 500 trial signups for our new feature" }),
      audience(),
      text("channels", "Preferred channels (optional)", { placeholder: "e.g. email, Instagram, LinkedIn" }),
      text("budget", "Budget and duration (optional)", { placeholder: "e.g. ₹2 lakh over 6 weeks" }),
    ],
    defaults: D.pro,
    tags: ["campaign", "strategy", "launch"],
  },
  {
    id: "headline-generator",
    name: "Headline Generator",
    category: "marketing",
    description: "Attention-grabbing headlines for pages, emails, ads and articles.",
    icon: "Heading1",
    kind: "list",
    fields: [topic({ label: "What is the headline for?" }), details({ label: "Main benefit or message" }), audience()],
    defaults: D.creative,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["headline", "copy"],
  },
  {
    id: "brand-tagline",
    name: "Brand Tagline",
    category: "marketing",
    description: "Short, memorable taglines and slogans that capture your brand.",
    icon: "Quote",
    kind: "list",
    fields: [brand({ required: true }), details({ label: "What the brand does and stands for", required: true }), audience()],
    defaults: D.creative,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["slogan", "branding"],
  },
  {
    id: "brand-story",
    name: "Brand Story",
    category: "marketing",
    description: "A compelling origin story that connects your mission with your customers.",
    icon: "BookOpen",
    kind: "medium",
    fields: [brand({ required: true }), details({ label: "Origin, mission and values", required: true }), audience()],
    defaults: { ...D.conv, style: "storytelling" },
    tags: ["branding", "story"],
  },
  {
    id: "value-proposition",
    name: "Value Proposition",
    category: "marketing",
    description: "A crisp value proposition: headline, sub-headline and three proof points.",
    icon: "Gem",
    kind: "medium",
    fields: [product(), details({ label: "What it does and for whom", required: true }), audience(), text("competitors", "Main alternatives (optional)")],
    defaults: D.persuasive,
    tags: ["positioning", "messaging"],
  },
  {
    id: "cta-generator",
    name: "Call-to-Action Generator",
    category: "marketing",
    description: "Clear, specific CTAs for buttons, emails and ads.",
    icon: "MousePointerClick",
    kind: "list",
    fields: [details({ label: "What should people do?", required: true }), product({ required: false }), audience()],
    defaults: D.persuasive,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["cta", "conversion"],
  },
  {
    id: "press-release",
    name: "Press Release",
    category: "marketing",
    description: "A newsroom-ready press release with headline, dateline, quotes and boilerplate.",
    icon: "Radio",
    kind: "long",
    fields: [
      text("title", "Announcement", { required: true, placeholder: "e.g. Acme launches AI-powered invoicing" }),
      details({ label: "Key facts (who, what, when, where, why)", required: true }),
      brand({ label: "Company name", required: true }),
      area("quote", "Quote to include (optional)", { rows: 2, placeholder: "Quote, with the speaker's name and title" }),
    ],
    defaults: { ...D.pro, length: "medium", style: "clear" },
    tags: ["pr", "announcement", "news"],
  },
  {
    id: "customer-persona",
    name: "Customer Persona",
    category: "marketing",
    description: "A detailed buyer persona: goals, pains, objections and messaging tips.",
    icon: "Users",
    kind: "medium",
    fields: [product(), details({ label: "What you know about your customers" }), audience({ label: "Market or segment" })],
    defaults: D.focused,
    tags: ["persona", "research"],
  },

  // ── E-commerce ────────────────────────────────────────────────────────────
  {
    id: "product-description",
    name: "Product Description",
    category: "ecommerce",
    description: "Benefit-driven product descriptions that turn browsers into buyers.",
    icon: "ShoppingBag",
    kind: "medium",
    fields: [product({ label: "Product name" }), area("features", "Key features", { required: true, placeholder: "One feature per line" }), audience(), keywords()],
    defaults: D.persuasive,
    supportsFramework: true,
    popular: true,
    tags: ["product page", "shopify", "amazon"],
  },
  {
    id: "product-benefits",
    name: "Product Benefits",
    category: "ecommerce",
    description: "Turn dry features into benefits customers actually care about.",
    icon: "BadgeCheck",
    kind: "list",
    fields: [product({ label: "Product name" }), area("features", "Features", { required: true, placeholder: "One feature per line" }), audience()],
    defaults: D.persuasive,
    lengthLabels: { short: "3 benefits", medium: "5 benefits", long: "8 benefits" },
    tags: ["benefits", "features"],
  },
  {
    id: "product-features",
    name: "Product Features",
    category: "ecommerce",
    description: "Clear, scannable feature bullets for product pages and spec sheets.",
    icon: "ListChecks",
    kind: "list",
    fields: [product({ label: "Product name" }), details({ label: "Product details and specs", required: true })],
    defaults: D.focused,
    lengthLabels: { short: "4 bullets", medium: "6 bullets", long: "10 bullets" },
    tags: ["bullets", "specs"],
  },
  {
    id: "product-title",
    name: "Product Listing Title",
    category: "ecommerce",
    description: "Keyword-rich titles for Amazon, Flipkart, Shopify, Etsy and other marketplaces.",
    icon: "Tag",
    kind: "list",
    fields: [
      product({ label: "Product name" }),
      area("features", "Key attributes", { placeholder: "Brand, size, material, colour, quantity…" }),
      keywords(),
      select("platform", "Marketplace", ["Amazon", "Flipkart", "Shopify", "Etsy", "eBay", "Other"], { required: true }),
    ],
    defaults: D.focused,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["marketplace", "listing"],
  },
  {
    id: "amazon-listing",
    name: "Amazon Product Listing",
    category: "ecommerce",
    description: "Title, five bullet points and a description optimised for Amazon search and conversion.",
    icon: "Store",
    kind: "medium",
    fields: [product({ label: "Product name" }), area("features", "Features and specs", { required: true }), keywords(), audience()],
    defaults: D.persuasive,
    tags: ["amazon", "listing", "bullets"],
  },
  {
    id: "review-response",
    name: "Review Response",
    category: "ecommerce",
    description: "Professional, on-brand replies to positive or negative customer reviews.",
    icon: "Star",
    kind: "short",
    fields: [area("review", "Customer review", { required: true, placeholder: "Paste the review here" }), brand(), details({ label: "Context or resolution offered (optional)" })],
    defaults: { ...D.friendly, tone: "empathetic", length: "short" },
    tags: ["reviews", "customer service"],
  },

  // ── Email Writing ─────────────────────────────────────────────────────────
  {
    id: "email-subject-lines",
    name: "Email Subject Lines",
    category: "email",
    description: "Subject lines (with preview text) that get opened, not ignored.",
    icon: "MailOpen",
    kind: "list",
    fields: [details({ label: "What is the email about?", required: true }), audience(), brand()],
    defaults: D.creative,
    lengthLabels: OPTIONS_LENGTH,
    popular: true,
    tags: ["subject line", "open rate"],
  },
  {
    id: "professional-email",
    name: "Professional Email",
    category: "email",
    description: "A clear, well-structured email for any work situation.",
    icon: "Mail",
    kind: "medium",
    fields: [
      text("recipient", "Recipient and relationship", { required: true, placeholder: "e.g. my manager, Priya" }),
      text("purpose", "Purpose of the email", { required: true, placeholder: "e.g. request a deadline extension" }),
      area("keyPoints", "Key points to include", { placeholder: "One point per line" }),
      text("sender", "Your name and role (optional)"),
    ],
    defaults: { ...D.pro, length: "short" },
    popular: true,
    tags: ["work email", "business email"],
  },
  {
    id: "cold-outreach-email",
    name: "Cold Outreach Email",
    category: "email",
    description: "Personalised cold emails that earn replies instead of the spam folder.",
    icon: "Send",
    kind: "medium",
    fields: [
      text("recipient", "Prospect (person, role, company)", { required: true, placeholder: "e.g. Head of Marketing at a D2C brand" }),
      product({ label: "What you offer" }),
      details({ label: "Why it's relevant to them" }),
      cta({ placeholder: "e.g. a 15-minute call next week" }),
    ],
    defaults: { ...D.conv, length: "short" },
    supportsFramework: true,
    tags: ["sales", "prospecting", "outreach"],
  },
  {
    id: "follow-up-email",
    name: "Follow-up Email",
    category: "email",
    description: "Polite, persuasive follow-ups after meetings, proposals or no reply.",
    icon: "Reply",
    kind: "short",
    fields: [
      text("recipient", "Recipient", { required: true }),
      area("context", "Previous interaction", { required: true, placeholder: "e.g. sent a proposal last Tuesday, no reply yet" }),
      text("purpose", "Goal of this follow-up", { placeholder: "e.g. get a decision by Friday" }),
    ],
    defaults: { ...D.friendly, length: "short" },
    tags: ["follow up", "sales"],
  },
  {
    id: "welcome-email",
    name: "Welcome Email",
    category: "email",
    description: "Onboarding emails that make new customers feel at home and take the first step.",
    icon: "PartyPopper",
    kind: "medium",
    fields: [brand({ required: true }), details({ label: "What new users should do first", required: true }), audience(), cta()],
    defaults: D.friendly,
    tags: ["onboarding", "lifecycle"],
  },
  {
    id: "newsletter",
    name: "Newsletter",
    category: "email",
    description: "A newsletter issue with a strong opener, well-organised sections and a sign-off.",
    icon: "Newspaper",
    kind: "medium",
    fields: [brand({ label: "Newsletter or brand name" }), topic({ label: "Theme of this issue" }), area("updates", "Stories, updates or links to include", { required: true }), audience(), cta({ label: "Call to action (optional)" })],
    defaults: D.conv,
    tags: ["newsletter", "email marketing"],
  },
  {
    id: "promotional-email",
    name: "Promotional Email",
    category: "email",
    description: "Sales and promotion emails with a compelling offer and a clear CTA.",
    icon: "BadgePercent",
    kind: "medium",
    fields: [product(), text("offer", "Offer", { required: true, placeholder: "e.g. 30% off annual plans until Sunday" }), audience(), details({ label: "Extra details (optional)" }), cta()],
    defaults: D.persuasive,
    supportsFramework: true,
    tags: ["sale", "promotion", "email marketing"],
  },
  {
    id: "email-reply",
    name: "Email Reply",
    category: "email",
    description: "Reply to any email quickly with the right tone and all the key points.",
    icon: "MessageSquareReply",
    kind: "short",
    fields: [area("email", "Email you received", { required: true, maxLength: 8000, rows: 6, placeholder: "Paste the email here" }), text("purpose", "How do you want to respond?", { required: true, placeholder: "e.g. accept and propose Thursday 3pm" })],
    defaults: { ...D.pro, length: "short" },
    tags: ["reply", "inbox"],
  },

  // ── Website Copy ──────────────────────────────────────────────────────────
  {
    id: "landing-page",
    name: "Landing Page Copy",
    category: "website",
    description: "Complete landing page copy: hero, benefits, how it works, social proof, FAQ and CTA.",
    icon: "LayoutTemplate",
    kind: "long",
    fields: [product(), details({ label: "What it does and key features", required: true }), audience(), text("usp", "Unique selling proposition"), cta()],
    defaults: D.persuasive,
    supportsFramework: true,
    popular: true,
    tags: ["landing page", "conversion"],
  },
  {
    id: "homepage-copy",
    name: "Website Homepage Copy",
    category: "website",
    description: "Homepage copy that explains what you do in seconds and guides visitors onward.",
    icon: "House",
    kind: "long",
    fields: [brand({ required: true }), details({ label: "What you do and for whom", required: true }), audience(), text("usp", "What makes you different")],
    defaults: D.pro,
    tags: ["homepage", "website"],
  },
  {
    id: "about-us",
    name: "About Us Page",
    category: "website",
    description: "An authentic About page covering your story, mission, values and team.",
    icon: "Building2",
    kind: "medium",
    fields: [brand({ required: true }), details({ label: "Story, mission, values and team", required: true }), audience()],
    defaults: { ...D.friendly, style: "storytelling" },
    tags: ["about", "company"],
  },
  {
    id: "hero-section",
    name: "Hero Section",
    category: "website",
    description: "Headline, sub-headline and button text options for the top of your page.",
    icon: "PanelTop",
    kind: "list",
    fields: [product(), details({ label: "What it does", required: true }), audience()],
    defaults: D.persuasive,
    lengthLabels: { short: "3 variations", medium: "5 variations", long: "8 variations" },
    tags: ["headline", "above the fold"],
  },
  {
    id: "features-section",
    name: "Features Section",
    category: "website",
    description: "Feature blocks with benefit-led titles and short descriptions.",
    icon: "Columns3",
    kind: "medium",
    fields: [product(), area("features", "Features", { required: true, placeholder: "One feature per line" }), audience()],
    defaults: D.persuasive,
    tags: ["features", "website"],
  },
  {
    id: "services-page",
    name: "Services Page",
    category: "website",
    description: "A services page that explains each offering, who it's for and how to get started.",
    icon: "Handshake",
    kind: "medium",
    fields: [brand({ required: true }), area("services", "Services you offer", { required: true, placeholder: "One service per line, with a short note" }), audience(), cta()],
    defaults: D.pro,
    tags: ["services", "agency"],
  },

  // ── Business Writing ──────────────────────────────────────────────────────
  {
    id: "business-proposal",
    name: "Business Proposal",
    category: "business",
    description: "A structured proposal: summary, problem, solution, scope, timeline, pricing and next steps.",
    icon: "FileSignature",
    kind: "long",
    fields: [
      text("recipient", "Client or recipient", { required: true }),
      details({ label: "Project, problem and your proposed solution", required: true }),
      brand({ label: "Your company (optional)" }),
      text("budget", "Budget and timeline (optional)"),
    ],
    defaults: { ...D.pro, length: "medium" },
    tags: ["proposal", "sales", "rfp"],
  },
  {
    id: "elevator-pitch",
    name: "Elevator Pitch",
    category: "business",
    description: "A 30–60 second pitch that explains what you do and why it matters.",
    icon: "Rocket",
    kind: "short",
    fields: [product({ label: "You, your company or product" }), details({ label: "What you do and the problem you solve", required: true }), audience({ label: "Who you're pitching to" })],
    defaults: D.persuasive,
    tags: ["pitch", "networking", "startup"],
  },
  {
    id: "sales-pitch",
    name: "Sales Pitch",
    category: "business",
    description: "A persuasive pitch that handles objections and closes with a clear next step.",
    icon: "Presentation",
    kind: "medium",
    fields: [product(), details({ label: "Product details and proof", required: true }), audience(), cta()],
    defaults: D.persuasive,
    supportsFramework: true,
    tags: ["sales", "pitch"],
  },
  {
    id: "job-description",
    name: "Job Description",
    category: "business",
    description: "Inclusive job descriptions that attract the right candidates.",
    icon: "Briefcase",
    kind: "medium",
    fields: [
      text("jobTitle", "Job title", { required: true }),
      brand({ label: "Company name", required: true }),
      details({ label: "Responsibilities and requirements" }),
      text("location", "Location and work type (optional)", { placeholder: "e.g. Bengaluru · Hybrid · Full-time" }),
    ],
    defaults: D.pro,
    tags: ["hiring", "hr", "recruiting"],
  },
  {
    id: "resume-summary",
    name: "Resume Summary",
    category: "business",
    description: "A punchy professional summary tailored to the role you want.",
    icon: "IdCard",
    kind: "list",
    fields: [text("jobTitle", "Target role", { required: true }), details({ label: "Experience, skills and achievements", required: true })],
    defaults: D.pro,
    lengthLabels: { short: "2 versions", medium: "3 versions", long: "5 versions" },
    tags: ["resume", "cv", "career"],
  },
  {
    id: "cover-letter",
    name: "Cover Letter",
    category: "business",
    description: "A tailored cover letter that connects your experience to the role.",
    icon: "ScrollText",
    kind: "medium",
    fields: [text("jobTitle", "Role you're applying for", { required: true }), brand({ label: "Company", required: true }), details({ label: "Your experience and why you're a fit", required: true })],
    defaults: D.pro,
    tags: ["career", "job application"],
  },
  {
    id: "company-bio",
    name: "Company Bio",
    category: "business",
    description: "Short and long company descriptions for profiles, decks and directories.",
    icon: "Building",
    kind: "short",
    fields: [brand({ required: true }), details({ label: "What the company does", required: true }), audience()],
    defaults: D.pro,
    tags: ["boilerplate", "profile"],
  },
  {
    id: "meeting-summary",
    name: "Meeting Summary",
    category: "business",
    description: "Turn raw meeting notes into a summary with decisions and action items.",
    icon: "NotebookPen",
    kind: "medium",
    fields: [content({ label: "Meeting notes or transcript" })],
    defaults: { ...D.focused, length: "short" },
    tags: ["notes", "action items"],
  },

  // ── Video & Scripts ───────────────────────────────────────────────────────
  {
    id: "youtube-script",
    name: "YouTube Video Script",
    category: "video",
    description: "A full video script with a hook, structured segments, B-roll cues and a CTA.",
    icon: "Youtube",
    kind: "long",
    fields: [topic({ label: "Video topic" }), audience(), details({ label: "Key points to cover (optional)" }), cta({ label: "Call to action (optional)" })],
    defaults: D.conv,
    lengthLabels: { short: "~3 minutes", medium: "~6 minutes", long: "~10+ minutes" },
    popular: true,
    tags: ["youtube", "script", "video"],
  },
  {
    id: "youtube-description",
    name: "YouTube Description",
    category: "video",
    description: "SEO-friendly video descriptions with chapters, links and hashtags.",
    icon: "MonitorPlay",
    kind: "medium",
    fields: [text("title", "Video title", { required: true }), details({ label: "What the video covers", required: true }), keywords(), cta({ label: "Links or CTA (optional)" })],
    defaults: D.friendly,
    tags: ["youtube", "seo"],
  },
  {
    id: "youtube-titles",
    name: "YouTube Titles",
    category: "video",
    description: "Click-worthy video titles that stay honest to the content.",
    icon: "SquarePlay",
    kind: "list",
    fields: [topic({ label: "Video topic" }), audience(), keywords()],
    defaults: D.creative,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["youtube", "titles"],
  },
  {
    id: "video-hook",
    name: "Video Hooks",
    category: "video",
    description: "Scroll-stopping opening lines for the first three seconds of a video.",
    icon: "Magnet",
    kind: "list",
    fields: [topic({ label: "Video topic" }), audience(), select("platform", "Platform", ["TikTok", "Instagram Reels", "YouTube Shorts", "YouTube", "LinkedIn"], { required: true })],
    defaults: D.creative,
    lengthLabels: OPTIONS_LENGTH,
    tags: ["hook", "short video"],
  },
  {
    id: "short-video-script",
    name: "Short-Form Video Script",
    category: "video",
    description: "Scripts for TikTok, Reels and Shorts with a hook, beats, on-screen text and CTA.",
    icon: "Smartphone",
    kind: "short",
    fields: [topic({ label: "Video topic" }), audience(), cta({ label: "Call to action (optional)" })],
    defaults: D.conv,
    lengthLabels: { short: "~15 seconds", medium: "~30 seconds", long: "~60 seconds" },
    tags: ["reels", "shorts", "tiktok"],
  },
  {
    id: "podcast-outline",
    name: "Podcast Episode Outline",
    category: "video",
    description: "An episode run-of-show with intro, segments, questions and outro.",
    icon: "Podcast",
    kind: "medium",
    fields: [topic({ label: "Episode topic" }), details({ label: "Guest, format or segments (optional)" }), audience()],
    defaults: D.conv,
    tags: ["podcast", "audio"],
  },

  // ── Writing Tools ─────────────────────────────────────────────────────────
  {
    id: "ai-writer",
    name: "AI Writer (Free-form)",
    category: "writing",
    description: "Describe anything you need — Scriptly writes it in your chosen tone and language.",
    icon: "WandSparkles",
    kind: "medium",
    fields: [area("description", "What should Scriptly write?", { required: true, rows: 6, maxLength: 4000, placeholder: "e.g. A heartfelt thank-you note to our first 100 customers…" }), audience()],
    defaults: D.conv,
    supportsFramework: true,
    popular: true,
    tags: ["custom", "anything", "prompt"],
  },
  {
    id: "content-rewriter",
    name: "Content Rewriter",
    category: "writing",
    description: "Rewrite any text so it's fresh and original while keeping the meaning.",
    icon: "Repeat2",
    kind: "medium",
    fields: [content()],
    defaults: D.conv,
    tags: ["rewrite", "paraphrase"],
  },
  {
    id: "paragraph-generator",
    name: "Paragraph Generator",
    category: "writing",
    description: "Well-formed paragraphs about any topic, including your keywords.",
    icon: "Pilcrow",
    kind: "short",
    fields: [topic(), keywords()],
    defaults: D.conv,
    tags: ["paragraph"],
  },
  {
    id: "content-outline",
    name: "Content Outline",
    category: "writing",
    description: "A clear outline for any format — guide, ebook, webinar, course or talk.",
    icon: "ListTree",
    kind: "medium",
    fields: [topic(), select("format", "Format", ["Guide", "Ebook", "Webinar", "Course", "Talk / presentation", "Report", "Video series"], { required: true }), audience()],
    defaults: D.focused,
    tags: ["outline", "planning"],
  },
  {
    id: "content-repurposer",
    name: "Content Repurposer",
    category: "writing",
    description: "Turn one piece of content into ready-to-post content for another channel.",
    icon: "Recycle",
    kind: "medium",
    fields: [
      content({ label: "Original content" }),
      select("platform", "Turn it into", ["LinkedIn post", "X (Twitter) thread", "Newsletter section", "Instagram carousel", "Short video script", "Blog summary"], { required: true }),
    ],
    defaults: D.conv,
    tags: ["repurpose", "multichannel"],
  },
  {
    id: "summarizer",
    name: "Text Summarizer",
    category: "writing",
    description: "Summarise long text into the key points and a short TL;DR.",
    icon: "Shrink",
    kind: "short",
    fields: [content(), text("focus", "Focus on (optional)", { placeholder: "e.g. decisions and risks" })],
    defaults: { ...D.focused, length: "short" },
    tags: ["summary", "tldr"],
  },
];

// ---------------------------------------------------------------------------
// Lookups and pricing
// ---------------------------------------------------------------------------

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): TemplateDefinition | undefined {
  return BY_ID.get(id);
}

export function getCategory(id: string): TemplateCategory | undefined {
  return TEMPLATE_CATEGORIES.find((c) => c.id === id);
}

export function templatesInCategory(id: TemplateCategoryId): TemplateDefinition[] {
  return TEMPLATES.filter((t) => t.category === id);
}

const BASE_COST: Record<OutputKind, number> = { list: 1, short: 1, medium: 2, long: 3 };

/** Credits charged for one generation. The server is the authority; the UI shows the same number. */
export function getGenerationCost(template: Pick<TemplateDefinition, "kind">, length: LengthId): number {
  const base = BASE_COST[template.kind];
  return template.kind === "long" && length === "long" ? base + 1 : base;
}

export function searchTemplates(query: string, category?: string): TemplateDefinition[] {
  const q = query.trim().toLowerCase();
  return TEMPLATES.filter((t) => {
    if (category && category !== "all" && t.category !== category) return false;
    if (!q) return true;
    const haystack = [t.name, t.description, getCategory(t.category)?.name ?? "", ...(t.tags ?? [])].join(" ").toLowerCase();
    return q.split(/\s+/).every((word) => haystack.includes(word));
  });
}
