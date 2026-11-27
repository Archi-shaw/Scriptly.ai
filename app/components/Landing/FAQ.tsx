"use client";

import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/app/components/ui/accordion";
import SectionHeading from "@/app/components/Landing/SectionHeading";

const faqs = [
  {
    question: "What is Scriptly.ai?",
    answer:
      "Scriptly.ai is an AI writing workspace. You pick a template — a blog post, Facebook ad, cold email, product description, YouTube script and many more — fill in a few details, and Scriptly writes a polished first draft that you can edit, refine, save and export.",
  },
  {
    question: "How do credits work?",
    answer:
      "Every generation uses credits based on its length: 1 credit for short-form content like captions and headlines, 2 for emails, ads and product descriptions, and 3–4 for long-form posts and scripts. Editor actions such as improve or shorten cost 1 credit. If a generation fails, the credits are refunded automatically. Credits never expire.",
  },
  {
    question: "Is there a free plan? Do I need a credit card?",
    answer:
      "Yes. Every new account receives free credits, and you don't need a credit card to sign up. When you need more, buy a credit package from the Billing page — there's no subscription.",
  },
  {
    question: "Which languages can Scriptly write in?",
    answer:
      "More than 30, including English (US & UK), Spanish, French, German, Portuguese, Hindi, Bengali, Tamil, Arabic, Japanese, Korean and Chinese. The content is written directly in the language you choose rather than translated afterwards.",
  },
  {
    question: "What are the AIDA, PAS and BAB frameworks?",
    answer:
      "They are proven copywriting structures. AIDA moves readers through Attention, Interest, Desire and Action. PAS names a Problem, Agitates it and presents your Solution. BAB shows the Before, the After, and the Bridge that gets them there. Choose one on supported templates, or use the dedicated framework templates.",
  },
  {
    question: "Can I edit the content after it's generated?",
    answer:
      "Absolutely. Every result opens in an editor where you can change anything by hand or use one-click AI actions: improve, expand, shorten, rewrite, change tone, fix grammar, continue writing, or generate alternative versions. Save it to My Documents and come back any time.",
  },
  {
    question: "Is the generated content original?",
    answer:
      "Content is generated fresh for each request based on your inputs. As with any AI tool, we recommend reviewing drafts for accuracy and checking any facts before you publish.",
  },
  {
    question: "Can I export my work?",
    answer: "Yes — copy to clipboard or download as Markdown, plain text, HTML or a Word document, or print to PDF.",
  },
  {
    question: "How is my account kept secure?",
    answer:
      "Email addresses are verified with a one-time code before an account is created, and every password sign-in also requires a code sent to your email. Passwords are stored only as salted hashes, and you can sign out of all devices from Settings.",
  },
];

const FAQSection = () => {
  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
      <Accordion type="single" collapsible defaultValue="item-1" className="mt-12 space-y-3">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={faq.question}
            value={`item-${index}`}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-5 last:border-b data-[state=open]:border-violet-400/30 data-[state=open]:bg-white/[0.05]"
          >
            <AccordionTrigger className="py-5 text-left text-base font-semibold text-white hover:no-underline">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-[15px] leading-relaxed text-white/70">{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default FAQSection;
