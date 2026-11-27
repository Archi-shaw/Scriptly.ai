import "server-only";

/**
 * Template-specific writing instructions (server-only). Every template in
 * lib/templates/registry.ts must have an entry; a unit test enforces this.
 */
export const TEMPLATE_INSTRUCTIONS: Record<string, string> = {
  // ── Blog Writing ──────────────────────────────────────────────────────────
  "blog-post": `Write a complete blog post.
- Infer the search intent behind the topic and satisfy it fully.
- Start with an H1 title (improve the given title if needed), then a 2–4 sentence hook introduction that states the problem and promises the payoff.
- Use a logical H2/H3 hierarchy; each section delivers concrete, actionable value (steps, examples, tips). Use bullet or numbered lists where they aid scanning.
- Work the keywords in naturally (title, an early paragraph, at least one subheading) without stuffing.
- End with a "Conclusion" or similar section that summarises key takeaways and includes a soft call to action.`,
  "article-generator": `Write a long-form article that follows the provided outline exactly.
- Use the article title as the H1. Each outline line becomes an H2 section in the same order; add H3s inside sections when helpful.
- Open with a short introduction before the first section and close with a conclusion after the last.
- Give every section substantive, specific paragraphs (explanations, examples, practical advice). Use the focus keywords naturally.`,
  "blog-ideas": `Generate blog post ideas.
- Return a numbered list. For each idea give a bold working title followed by one sentence describing the angle and why the audience will care.
- Mix formats (how-to, listicle, case study, opinion, comparison, beginner guide) and cover different stages of the reader's journey.
- Avoid generic or overlapping ideas.`,
  "blog-titles": `Write blog post titles.
- Return a numbered list of titles only (no commentary).
- Vary the formulas: how-to, numbers, questions, curiosity, benefit-led, "without" constructions.
- Keep each under ~65 characters where possible, include the main keyword naturally, and never promise what an article can't deliver.`,
  "listicle-titles": `Write listicle (list-post) titles.
- Return a numbered list of titles only. Every title must contain a specific number (odd numbers are welcome) and a clear benefit.
- Vary structure and specificity; keep each under ~70 characters.`,
  "blog-intro": `Write a blog introduction (no heading).
- Open with a hook: a relatable problem, surprising insight, vivid scenario or sharp question.
- Establish why the topic matters to the audience, then preview what the article will deliver.
- Finish with a transition sentence that leads into the first section. 1–3 short paragraphs.`,
  "blog-outline": `Create a detailed blog outline.
- Start with a proposed H1 title and a one-line description of the target reader and search intent.
- Provide an H2/H3 structure (Markdown headings) covering intro, 5–8 main sections and a conclusion.
- Under each heading add 2–4 bullet notes on what to cover, examples to use, and where the keywords fit.`,
  "blog-section": `Write one complete blog section.
- Begin with the subheading as an H2, then 3–5 well-developed paragraphs (or paragraphs plus a short list) that thoroughly cover it.
- Stay focused on this subheading only; it should read as part of a larger article (no full introduction or conclusion).`,
  "blog-paragraph": `Write a single, well-developed paragraph for the given subheading (do not repeat the subheading).
- Clear topic sentence, supporting detail or example, and a closing sentence that flows onward. Include keywords naturally if provided.`,
  "blog-conclusion": `Write a blog conclusion (no heading unless natural).
- Recap the key takeaways in fresh words, reinforce the main benefit for the reader, and end with a clear next step or call to action.
- Keep it energising and specific; don't introduce new topics.`,
  "talking-points": `Write talking points for each subheading.
- Use each subheading as an H3 in the given order.
- Under each, give 3–5 concise bullet points that are specific and informative, ready to be expanded into paragraphs.`,
  "pros-cons": `Write a balanced pros and cons analysis.
- Brief one-paragraph overview, then "Pros" and "Cons" sections as bullet lists with a bold label and a one-sentence explanation each.
- Finish with a short "Bottom line" on who it suits best and who should look elsewhere. Be fair; do not invent facts or prices.`,

  // ── SEO ───────────────────────────────────────────────────────────────────
  "seo-meta-description": `Write SEO meta descriptions.
- Return a numbered list. Each description must be 140–155 characters (count carefully), include the target keyword naturally, state a clear benefit and end with an implicit or explicit call to action.
- No quotation marks around them; no clickbait.`,
  "seo-title": `Write SEO title tags.
- Return a numbered list. Each must be 50–60 characters, start with or include the target keyword near the front, and be compelling to click.
- If a brand name is provided, append it after a separator (e.g. " | Brand") within the limit.`,
  "keyword-article": `Write a long-form SEO article targeting the primary keyword.
- Match the stated search intent: informational → teach comprehensively; commercial → compare options and criteria; transactional → help the reader choose and act.
- Include the primary keyword in the H1, the first 100 words and at least one H2. Weave secondary keywords and natural variants throughout.
- Use a clear H2/H3 hierarchy, short paragraphs, lists and a FAQ section (3–5 questions) near the end, then a conclusion.
- Demonstrate experience and expertise with specific, practical detail. Do not fabricate statistics or sources.`,
  "keyword-ideas": `Generate long-tail keyword ideas.
- Group them under headings by search intent (Informational, Commercial, Transactional).
- For each keyword give a bullet: the keyword in bold, followed by a suggested content type (e.g. guide, comparison, landing page). Do not invent search volumes or difficulty numbers.`,
  "content-brief": `Create an SEO content brief for a writer.
Include these sections with Markdown headings: Search intent & target reader; Recommended title (and 2 alternatives); Meta description; Angle that beats existing results; Detailed outline (H2/H3 with notes); Questions to answer; Keywords & entities to include; Internal/external linking suggestions (describe page types, don't invent URLs); Word count recommendation.`,
  "faq-generator": `Write a FAQ section.
- Format each item as a bold question followed by a concise, genuinely helpful answer (2–4 sentences).
- Cover the questions real customers ask: what, how, cost/value, comparisons, objections, getting started.
- Base answers only on the provided context; where specifics are unknown, answer generally without inventing facts.`,

  // ── Social Media ──────────────────────────────────────────────────────────
  "linkedin-post": `Write a LinkedIn post.
- First line is a strong hook that earns the "see more" click (no hashtags in it).
- Short paragraphs or single lines with white space; share a story, lesson or insight with specifics.
- End with a question or call to action to invite comments, then 3–5 relevant hashtags on the last line.
- Avoid corporate jargon and engagement-bait clichés.`,
  "instagram-caption": `Write an Instagram caption.
- Hook in the first line, then 2–4 short lines of value or story, tasteful emojis where they add meaning.
- Include a call to action (comment, save, share, link in bio).
- Finish with a blank line and 8–15 relevant hashtags mixing broad and niche tags.`,
  "instagram-bio": `Write Instagram bio options.
- Return a numbered list. Each bio must be at most 150 characters, communicate who it's for and what they get, show personality, and use line breaks or emojis sparingly.
- Include the CTA if provided.`,
  "twitter-post": `Write posts for X (Twitter).
- Return a numbered list. Each post must be under 280 characters including spaces.
- Lead with the most interesting idea; be specific and opinionated where appropriate. At most one or two hashtags, only if natural.`,
  "twitter-thread": `Write an X (Twitter) thread.
- Number each post (1/, 2/, …). Each post must be under 280 characters.
- Post 1 is a strong hook that promises clear value. The middle posts deliver one idea each with specifics. The final post summarises and includes a call to action (follow, reply, or link).`,
  "facebook-post": `Write a Facebook post.
- Conversational and community-minded; open with a hook, add the details in short paragraphs, and end with a question or call to action.
- Emojis are fine in moderation; 0–3 hashtags.`,
  "tiktok-caption": `Write TikTok captions.
- Return a numbered list. Each caption is one or two punchy lines (under 150 characters) that add curiosity or context to the video, followed by 3–6 relevant hashtags.`,
  "hashtag-generator": `Generate hashtags for the selected platform.
- Group them under three headings: Broad reach, Niche & community, Specific / long-tail.
- Follow the platform's norms (e.g. LinkedIn and X use few, Instagram and TikTok use more). Output hashtags only, each starting with #, no spaces inside tags.`,
  "pinterest-pin": `Write Pinterest pin copy.
- Provide a "Pin title" (under 100 characters, keyword-first) and a "Description" (under 500 characters) that uses keywords naturally, explains the value and ends with a call to action. Add 2–5 hashtags at the end.`,

  // ── Advertising ───────────────────────────────────────────────────────────
  "facebook-ad": `Write Meta (Facebook/Instagram) ad copy.
- Provide 3 variations. For each, label "Primary text" (lead with a hook that names the audience's desire or pain, highlight the USP and offer, end with the CTA), "Headline" (under 40 characters) and "Description" (under 30 characters).
- Each variation should use a different angle (e.g. benefit, social-proof-style framing without fabricated numbers, objection handling).`,
  "google-ad": `Write a Google responsive search ad.
- "Headlines": 10 headlines, each 30 characters or fewer (count carefully), covering keywords, benefits, USP, offer and CTA.
- "Descriptions": 4 descriptions, each 90 characters or fewer.
- Use a numbered list for each group. No exclamation mark in headlines; follow Google Ads editorial norms.`,
  "linkedin-ad": `Write LinkedIn ad copy for a B2B audience.
- Provide 3 variations, each with "Intro text" (under 150 characters before truncation; lead with a business outcome or pain), "Headline" (under 70 characters) and "CTA button" (e.g. Learn more, Download, Register).
- Speak to professional goals: time, revenue, risk, efficiency.`,
  "instagram-ad": `Write Instagram ad captions.
- Provide 3 variations. Each opens with a thumb-stopping first line, then 1–3 short lines about the benefit or offer, and ends with a clear call to action. Emojis welcome, max 3 hashtags.`,
  "ad-headlines": `Write ad headlines.
- Return a numbered list. Each headline focuses on one clear benefit or outcome, is specific, and stays under 60 characters. Vary the angle: benefit, curiosity, urgency, social framing, question.`,

  // ── Marketing ─────────────────────────────────────────────────────────────
  "aida-copywriter": `Write persuasive copy using the AIDA framework, with each stage as a bold label:
**Attention** — a headline or opening that stops the reader.
**Interest** — why this matters to them, with specific, relevant detail.
**Desire** — benefits and the outcome they'll enjoy; make it vivid and personal.
**Action** — a clear, low-friction call to action.`,
  "pas-copywriter": `Write persuasive copy using the PAS framework, with each stage as a bold label:
**Problem** — name a specific, painful problem the audience recognises.
**Agitate** — deepen it: consequences, frustrations and the cost of doing nothing (empathetic, not fear-mongering).
**Solution** — present the product as the answer with concrete benefits and finish with a call to action.`,
  "bab-copywriter": `Write persuasive copy using the BAB framework, with each stage as a bold label:
**Before** — the reader's current situation and frustrations.
**After** — what life looks like once the problem is solved.
**Bridge** — how the product gets them there, ending with a call to action.`,
  "marketing-campaign": `Create a marketing campaign plan.
Sections (Markdown headings): Campaign overview & objective (with measurable KPIs); Target audience & insight; Big idea / creative concept and campaign name; Key messages; Channel plan (what to do on each channel, with example copy); Content calendar / timeline by week; Budget allocation guidance (proportions, not invented totals unless a budget is given); Measurement & optimisation plan.`,
  "headline-generator": `Write headlines.
- Return a numbered list of headlines only. Vary the formulas (benefit, how-to, number, question, curiosity, bold claim) and keep each concise and specific to the message and audience.`,
  "brand-tagline": `Write brand taglines.
- Return a numbered list. Each tagline is 2–7 words, memorable, easy to say, and captures the brand's promise or personality. Avoid clichés and generic phrases.`,
  "brand-story": `Write a brand story.
- Narrative arc: the founding spark or problem, the struggle or insight, the mission, and the difference the brand makes for customers today.
- Ground it in the details provided; keep it authentic and human. End with what the brand stands for going forward.`,
  "value-proposition": `Write a value proposition.
Provide: a headline (the core promise), a sub-headline (what it is, who it's for, why it's better), three bullet proof points (benefit + supporting feature), and a one-sentence positioning statement in the form "For [audience] who [need], [product] is a [category] that [benefit]. Unlike [alternatives], it [differentiator]."`,
  "cta-generator": `Write calls to action.
- Return a numbered list of CTAs (button-length, 2–6 words) followed by a short section with 3 longer CTA sentences for emails or page footers.
- Start with strong verbs, make the value explicit, reduce friction.`,
  "press-release": `Write a press release in standard format.
- Headline, optional sub-headline, then a dateline placeholder like "[CITY], [Date] —" followed by the lead paragraph answering who, what, when, where and why.
- Body paragraphs with supporting details; include the provided quote (or a clearly marked placeholder quote attributed to [Name, Title]).
- "About [Company]" boilerplate and a media contact placeholder. Factual, third-person, no hype.`,
  "customer-persona": `Create a buyer persona.
Sections: Persona name & snapshot; Demographics & role; Goals; Pain points & frustrations; Buying triggers; Objections; Where they spend time (channels); Preferred content; Messaging that resonates (with 3 example lines). Make it specific and plausible, clearly a representative profile.`,

  // ── E-commerce ────────────────────────────────────────────────────────────
  "product-description": `Write a product description that converts.
- Open with a benefit-led hook that speaks to the target customer.
- Translate features into benefits (what each feature lets the customer do or feel). Use a short paragraph plus a scannable bullet list of key benefits/features.
- Address one likely objection and end with a confident call to action. Use keywords naturally for product-page SEO.`,
  "product-benefits": `Write product benefits.
- Return a numbered list. For each: a bold benefit headline (what the customer gains) followed by one sentence linking it to the feature behind it.`,
  "product-features": `Write product feature bullets.
- Return a bullet list. Each bullet starts with a bold feature name, followed by a concise explanation that includes the practical benefit or spec. Keep bullets parallel in structure and scannable.`,
  "product-title": `Write marketplace product titles.
- Return a numbered list. Follow the selected marketplace's conventions (e.g. Amazon/Flipkart: Brand + Product + Key attributes like size, material, colour, quantity; Etsy: descriptive and keyword-rich; Shopify: clean and brandable).
- Front-load the most important keywords. Keep Amazon/Flipkart titles under 200 characters and others under 140. No promotional claims like "best" or "sale".`,
  "amazon-listing": `Write an Amazon product listing.
- "Title": under 200 characters, keyword-rich, following Brand + Product + Key attributes.
- "Bullet points": exactly 5 bullets, each starting with a capitalised benefit label, then details (under ~250 characters each).
- "Product description": 2–3 short paragraphs expanding on benefits and use cases.
- "Backend search terms": a single line of relevant terms not already used, space-separated. Follow Amazon policies (no prices, promotions or unverifiable claims).`,
  "review-response": `Write a reply to the customer review.
- Thank the reviewer by name if given. For positive reviews: be warm and specific, reinforce what they liked, invite them back.
- For negative or mixed reviews: acknowledge the issue sincerely, apologise without being defensive, explain the resolution or offer to continue privately, and keep it brief. Never argue or reveal private details.`,

  // ── Email Writing ─────────────────────────────────────────────────────────
  "email-subject-lines": `Write email subject lines.
- Return a numbered list. Each item: the subject line (under 50 characters where possible), then " — Preview: " and a preview text (under 90 characters) that complements it.
- Mix approaches: curiosity, benefit, urgency, personalisation, question. Avoid spammy words and ALL CAPS.`,
  "professional-email": `Write a professional email.
- Start with "Subject:" on its own line, then the greeting addressed appropriately to the recipient.
- State the purpose in the first two sentences, cover each key point clearly (bullets if there are several), propose next steps, and close politely with a sign-off and the sender's name/role (or [Your Name]).`,
  "cold-outreach-email": `Write a cold outreach email.
- Start with "Subject:" (short, specific, personal — no clickbait).
- Opening line personalised to the prospect's role or company (no "I hope this finds you well").
- One or two sentences on the problem you solve and the specific value for them; keep the email under ~150 words.
- End with a single low-friction call to action and a simple sign-off. No fabricated case studies or numbers.`,
  "follow-up-email": `Write a follow-up email.
- Start with "Subject:" (e.g. referencing the earlier conversation).
- Briefly reference the previous interaction, add something new of value (a resource, answer, or reason to act now), restate the ask clearly and make replying easy. Courteous and concise; never guilt-trip.`,
  "welcome-email": `Write a welcome email.
- Start with "Subject:" and a preview line.
- Warm welcome that confirms they made a good choice, explain the single most important first step, optionally list 2–3 quick wins, and end with the call to action and a friendly sign-off from the brand.`,
  "newsletter": `Write a newsletter issue.
- Start with "Subject:" and a preview line, then a personal, engaging opener tied to the issue's theme.
- Organise the updates into clearly headed sections with short, skimmable paragraphs; add a "why it matters" angle for each.
- Close with the call to action (if any) and a friendly sign-off.`,
  "promotional-email": `Write a promotional email.
- Start with "Subject:" and a preview line.
- Lead with the offer and its main benefit, build desire with 2–3 specific reasons, include deadline or terms from the details provided (don't invent any), and repeat the call to action as a clear button-style line (e.g. **[Claim 30% off →]**).`,
  "email-reply": `Write a reply to the email provided.
- Address every question or request in the original email, following the user's intended response.
- Mirror the original's level of formality, keep it clear and concise, and end with an appropriate sign-off using [Your Name]. Do not repeat the original email.`,

  // ── Website Copy ──────────────────────────────────────────────────────────
  "landing-page": `Write complete landing page copy, using Markdown headings for each section:
Hero (headline, sub-headline, primary CTA button text); Problem/agitation; Solution overview; Key benefits (3–6 blocks with titles and short descriptions); How it works (3 steps); Social proof section with clearly marked placeholders for testimonials/logos (do not invent quotes or numbers); Objection-handling FAQ (4–6 Q&As); Final call to action.`,
  "homepage-copy": `Write website homepage copy, using Markdown headings for each section:
Hero (headline that says what you do, sub-headline, CTA), Who it's for, Core offerings/services (cards with titles and descriptions), Why choose us (differentiators), How it works, Testimonials placeholder (no invented quotes), and a closing CTA band. Make the value clear within 5 seconds of reading.`,
  "about-us": `Write an About Us page.
Sections: an opening line that captures who you are; Our story; Mission and values (with short explanations); What makes us different; The team (general, unless names are given); a closing invitation/CTA. Authentic, specific, and grounded in the provided details.`,
  "hero-section": `Write hero section variations.
- Return a numbered list. Each variation has "Headline" (under 10 words, outcome-focused), "Sub-headline" (one or two sentences clarifying what it is and who it's for) and "Button" (2–4 words). Vary the angle across variations.`,
  "features-section": `Write a features section for a website.
- A short section headline and intro line, then one block per feature: an H3 benefit-led title and a 1–2 sentence description that explains what it does and why it matters. Finish with a one-line CTA.`,
  "services-page": `Write a services page.
- Intro that frames the client's goal. For each service: an H2 name, who it's for, what's included (bullets), and the outcome they get.
- Add a short "How we work" process (3–5 steps) and a closing call to action.`,

  // ── Business Writing ──────────────────────────────────────────────────────
  "business-proposal": `Write a business proposal.
Sections (Markdown headings): Executive summary; Understanding of the client's needs; Proposed solution; Scope of work & deliverables; Timeline & milestones; Investment (use the budget provided or bracketed placeholders — never invent prices); Why us; Next steps. Professional, client-centred and specific.`,
  "elevator-pitch": `Write an elevator pitch that can be spoken in 30–60 seconds.
- Hook, the problem, your solution and what makes it different, a credibility point (only from details given), and a clear ask or next step. Natural spoken language, no bullet points.`,
  "sales-pitch": `Write a sales pitch.
- Open with the prospect's goal or pain, present the solution and its 2–3 most relevant benefits, handle the two most likely objections, and close with a specific next step. Conversational enough to deliver live or adapt to email.`,
  "job-description": `Write a job description.
Sections: Job title and one-line summary; About the company; What you'll do (responsibilities as bullets); What you'll bring (requirements split into must-have and nice-to-have); What we offer; How to apply.
Use inclusive, bias-free language, avoid unnecessary jargon, and don't invent salary figures or benefits that weren't given.`,
  "resume-summary": `Write resume summaries.
- Return a numbered list. Each is 2–4 sentences in first person without "I" (resume style), tailored to the target role, highlighting years of experience, core strengths and a quantified achievement only if provided.`,
  "cover-letter": `Write a cover letter.
- Greeting (to the hiring manager or a placeholder), an opening that names the role and a compelling reason for interest, one or two paragraphs connecting specific experience to the role's needs, a paragraph on fit with the company, and a confident close requesting an interview. Under ~350 words unless length says otherwise.`,
  "company-bio": `Write company descriptions.
Provide three versions with bold labels: "One-liner" (under 20 words), "Short bio" (about 50 words) and "Full bio" (about 120 words). Third person, factual, based only on the details provided.`,
  "meeting-summary": `Summarise the meeting notes.
Sections: Summary (3–5 sentences); Key discussion points (bullets); Decisions made; Action items as a Markdown table with columns Owner, Task, Due date (use "TBD" where not stated); Open questions. Only use information present in the notes.`,

  // ── Video & Scripts ───────────────────────────────────────────────────────
  "youtube-script": `Write a YouTube video script.
- Title suggestion, then a HOOK (first 15 seconds) that states the payoff, a brief intro, and clearly labelled segments with spoken narration.
- Include [B-ROLL: …] and [ON-SCREEN TEXT: …] cues where useful, pattern interrupts to keep retention, a mid-video engagement prompt, and an outro with the call to action.
- Write for the ear: short sentences, conversational. Target the duration implied by the length setting (~150 spoken words per minute).`,
  "youtube-description": `Write a YouTube video description.
- First 2 lines: a compelling summary with the main keyword (this shows above "Show more").
- Then a fuller description, a "Chapters" list with placeholder timestamps (00:00 Intro, …) based on the content, links/CTA section using the provided CTA or placeholders, and 3–5 hashtags at the end.`,
  "youtube-titles": `Write YouTube titles.
- Return a numbered list. Each under 60 characters, curiosity- or benefit-driven, keyword near the front, honest to the topic. Vary formats (how-to, list, challenge, question, result).`,
  "video-hook": `Write opening hooks for short videos on the selected platform.
- Return a numbered list. Each hook is one or two lines that can be spoken in under 3 seconds and creates immediate curiosity, tension or a promise. Optionally add an [ON-SCREEN TEXT] suggestion after each.`,
  "short-video-script": `Write a short-form vertical video script (TikTok, Reels, Shorts).
- HOOK (0–3s), then numbered beats with spoken lines and [VISUAL] / [ON-SCREEN TEXT] cues, ending with a CTA.
- Fast-paced, one idea per beat, written for the ear. Match the duration in the length setting (~2.5 spoken words per second).`,
  "podcast-outline": `Create a podcast episode outline (run of show).
Sections: Episode title options (3); Cold open/teaser; Intro script; Segments with timing estimates, talking points and guest questions (if a guest is mentioned); Listener takeaway; Outro with call to action; Show notes summary.`,

  // ── Writing Tools ─────────────────────────────────────────────────────────
  "ai-writer": `Write exactly what the user describes in the request.
- Infer the most suitable format, structure and length for the request and the chosen settings.
- If the request is ambiguous, make sensible assumptions and produce a complete, polished result rather than asking questions.`,
  "content-rewriter": `Rewrite the provided content.
- Preserve the meaning, facts, key terms and overall structure, but use fresh wording and sentence structures throughout so it reads as original writing.
- Improve clarity and flow. Keep Markdown formatting (headings, lists) if the original has it. Do not add new claims.`,
  "paragraph-generator": `Write well-formed paragraphs about the topic.
- Each paragraph has a clear topic sentence, supporting detail and a natural transition. Include keywords naturally. No headings.`,
  "content-outline": `Create an outline for the selected format.
- Title, objective and target audience at the top, then a hierarchical outline (Markdown headings or nested bullets) with section-level notes on key points, examples and activities appropriate to the format (e.g. modules/lessons for a course, slides for a talk, chapters for an ebook).`,
  "content-repurposer": `Repurpose the original content into the format given under "Turn it into".
- Keep the core ideas and any facts exactly; adapt structure, length and voice to the destination format's best practices (e.g. hook + line breaks for LinkedIn, numbered posts under 280 characters for X, slide-by-slide text for an Instagram carousel, spoken beats for a short video).
- Output only the finished repurposed content.`,
  "summarizer": `Summarise the provided text.
- Start with a one-sentence **TL;DR**, then the key points as bullets, then (if relevant) notable details, numbers or decisions exactly as stated.
- Respect the requested focus if given. Never add information that isn't in the text.`,
};
