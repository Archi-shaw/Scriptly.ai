import React from "react";
import SectionHeading from "@/app/components/Landing/SectionHeading";

const steps = [
  {
    number: "1",
    title: "Pick a template",
    description: "Choose from 80+ templates for blog posts, ads, emails, product pages, social posts and video scripts.",
  },
  {
    number: "2",
    title: "Add your details",
    description: "Tell Scriptly about your topic, audience and brand. Set the tone, language, length and framework.",
  },
  {
    number: "3",
    title: "Generate, refine & export",
    description: "Get a polished draft in seconds, then improve, shorten or rewrite it with one click and export it anywhere.",
  },
];

const HowItWorks = () => {
  return (
    <div className="mx-auto max-w-7xl">
      <SectionHeading eyebrow="Start writing in 3 easy steps" title="How does it work?" />
      <ol className="mt-16 grid gap-8 md:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.number}
            className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-violet-400/40 hover:bg-white/[0.06]"
          >
            <div className="absolute -right-3 -top-4 grid size-14 place-items-center rounded-full bg-[#A380E0] shadow-lg shadow-violet-950/50">
              <span className="text-2xl font-bold text-[#2C1254]">{step.number}</span>
            </div>
            <h3 className="mb-3 text-xl font-semibold text-white">{step.title}</h3>
            <p className="leading-relaxed text-white/70">{step.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default HowItWorks;
