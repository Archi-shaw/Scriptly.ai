import { apiRoute, ok } from "@/lib/api";
import dbConnect from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { serializeDocument, serializeGeneration, serializeTransaction } from "@/lib/serializers";
import DocumentModel from "@/models/Document";
import GeneratedContent from "@/models/GeneratedContent";
import CreditTransaction from "@/models/CreditTransaction";

const DAYS = 14;

/** Real, per-user dashboard data (no placeholder statistics). */
export const GET = apiRoute(async (req) => {
  const user = await requireUser(req);
  await dbConnect();
  const userId = user._id;
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (DAYS - 1));

  const [documents, generations, words, recentGenerations, recentDocuments, recentActivity, daily, topTemplates] =
    await Promise.all([
      DocumentModel.countDocuments({ userId }),
      GeneratedContent.countDocuments({ userId, kind: "generate", status: "completed" }),
      GeneratedContent.aggregate<{ total: number }>([
        { $match: { userId, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$wordCount" } } },
      ]),
      GeneratedContent.find({ userId, kind: "generate", status: { $ne: "pending" } })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      DocumentModel.find({ userId }).sort({ updatedAt: -1 }).limit(5).lean(),
      CreditTransaction.find({ userId }).sort({ createdAt: -1 }).limit(6).lean(),
      GeneratedContent.aggregate<{ _id: string; count: number; words: number }>([
        { $match: { userId, status: "completed", createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            words: { $sum: "$wordCount" },
          },
        },
      ]),
      GeneratedContent.aggregate<{ _id: string; count: number }>([
        { $match: { userId, kind: "generate", status: "completed" } },
        { $group: { _id: "$templateId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 4 },
      ]),
    ]);

  const byDay = new Map(daily.map((d) => [d._id, d]));
  const usage = Array.from({ length: DAYS }, (_, i) => {
    const day = new Date(since);
    day.setUTCDate(since.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    return { date: key, generations: byDay.get(key)?.count ?? 0, words: byDay.get(key)?.words ?? 0 };
  });

  return ok({
    stats: {
      credits: user.availableCredits ?? 0,
      creditsUsed: user.totalCreditsUsed ?? 0,
      documents,
      generations,
      words: words[0]?.total ?? 0,
    },
    recentGenerations: recentGenerations.map((g) => serializeGeneration(g, { includeOutput: false })),
    recentDocuments: recentDocuments.map((d) => serializeDocument(d, { includeContent: false })),
    recentActivity: recentActivity.map(serializeTransaction),
    usage,
    topTemplates: topTemplates.map((t) => ({ templateId: t._id, count: t.count })),
  });
});
