import "server-only";
import dbConnect from "@/lib/db";
import CreditPackage, { type CreditPackageDoc } from "@/models/CreditPackage";

/**
 * Default catalogue, inserted only when the collection is empty. After that
 * the database is the source of truth (edit packages there or re-run the seed).
 */
export const DEFAULT_PACKAGES = [
  {
    slug: "starter",
    name: "Starter",
    description: "For trying Scriptly on real work.",
    credits: 100,
    bonusCredits: 0,
    priceMinor: 19_900,
    currency: "INR",
    features: ["100 credits", "All 80+ templates", "30+ languages", "AIDA, PAS & BAB frameworks", "Credits never expire"],
    isPopular: false,
    sortOrder: 1,
  },
  {
    slug: "pro",
    name: "Pro",
    description: "For creators and marketers publishing every week.",
    credits: 500,
    bonusCredits: 50,
    priceMinor: 79_900,
    currency: "INR",
    features: ["500 + 50 bonus credits", "All 80+ templates", "30+ languages", "Editor with AI rewrite tools", "Credits never expire"],
    isPopular: true,
    sortOrder: 2,
  },
  {
    slug: "business",
    name: "Business",
    description: "For teams and agencies producing content at scale.",
    credits: 1500,
    bonusCredits: 250,
    priceMinor: 1_99_900,
    currency: "INR",
    features: ["1,500 + 250 bonus credits", "Lowest price per credit", "All 80+ templates", "Export to Markdown, Word, HTML & PDF", "Credits never expire"],
    isPopular: false,
    sortOrder: 3,
  },
] as const;

export async function ensureDefaultPackages(): Promise<void> {
  await dbConnect();
  if ((await CreditPackage.estimatedDocumentCount()) > 0) return;
  // Upserts keyed by slug are safe if several instances race on first boot.
  await CreditPackage.bulkWrite(
    DEFAULT_PACKAGES.map((pkg) => ({
      updateOne: { filter: { slug: pkg.slug }, update: { $setOnInsert: { ...pkg, features: [...pkg.features] } }, upsert: true },
    })),
  );
}

export function serializePackage(pkg: CreditPackageDoc) {
  return {
    id: pkg._id.toString(),
    slug: pkg.slug,
    name: pkg.name,
    description: pkg.description ?? "",
    credits: pkg.credits,
    bonusCredits: pkg.bonusCredits ?? 0,
    totalCredits: pkg.credits + (pkg.bonusCredits ?? 0),
    priceMinor: pkg.priceMinor,
    currency: pkg.currency,
    features: pkg.features ?? [],
    isPopular: Boolean(pkg.isPopular),
  };
}

export type SerializedPackage = ReturnType<typeof serializePackage>;

export async function listActivePackages(): Promise<SerializedPackage[]> {
  await ensureDefaultPackages();
  const packages = await CreditPackage.find({ isActive: true }).sort({ sortOrder: 1, priceMinor: 1 }).lean();
  return packages.map(serializePackage);
}
