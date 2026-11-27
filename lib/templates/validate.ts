import { z } from "@/lib/zod";
import {
  CREATIVITY_IDS,
  FRAMEWORK_IDS,
  LANGUAGE_IDS,
  LENGTH_IDS,
  STYLE_IDS,
  TONE_IDS,
} from "@/lib/templates/options";
import type { TemplateDefinition } from "@/lib/templates/registry";

/** Shared (client + server) validation for generation requests. */

export const generationSettingsSchema = z.object({
  language: z.enum(LANGUAGE_IDS, { error: "Choose a supported language." }),
  tone: z.enum(TONE_IDS, { error: "Choose a tone." }),
  style: z.enum(STYLE_IDS).default("auto"),
  length: z.enum(LENGTH_IDS, { error: "Choose a length." }),
  framework: z.enum(FRAMEWORK_IDS).default("none"),
  creativity: z.enum(CREATIVITY_IDS).default("balanced"),
  brandVoice: z.string().trim().max(1500, "Brand information must be 1,500 characters or fewer.").optional(),
  instructions: z.string().trim().max(1500, "Additional instructions must be 1,500 characters or fewer.").optional(),
});

export type GenerationSettingsInput = z.infer<typeof generationSettingsSchema>;

export interface InputValidationResult {
  values: Record<string, string>;
  errors: Record<string, string>;
}

/** Keeps only the template's fields, trims them and checks required/length/option rules. */
export function validateTemplateInputs(template: TemplateDefinition, raw: Record<string, unknown>): InputValidationResult {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const field of template.fields) {
    const rawValue = raw[field.name];
    const value = typeof rawValue === "string" ? rawValue.trim() : "";

    if (!value) {
      if (field.required) errors[field.name] = `${field.label} is required.`;
      continue;
    }
    if (value.length > field.maxLength) {
      errors[field.name] = `${field.label} must be ${field.maxLength.toLocaleString("en-US")} characters or fewer.`;
      continue;
    }
    if (field.type === "select" && field.options && !field.options.some((o) => o.value === value)) {
      errors[field.name] = `Choose a valid option for ${field.label}.`;
      continue;
    }
    if (field.name === "outline" && value.split("\n").filter((line) => line.trim()).length < 3) {
      errors[field.name] = "Add at least 3 subheadings (one per line).";
      continue;
    }
    values[field.name] = value;
  }

  return { values, errors };
}
