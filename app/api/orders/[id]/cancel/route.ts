import { apiRoute, notFound, ok } from "@/lib/api";
import dbConnect, { isValidObjectId } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import Order from "@/models/Order";

/** Marks an unpaid order as cancelled when the user closes the checkout. A later confirmed payment still fulfils it. */
export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await params;
  if (!isValidObjectId(id)) throw notFound("Order not found.");
  await dbConnect();
  const order = await Order.findOneAndUpdate(
    { _id: id, userId: user._id, status: "created" },
    { $set: { status: "cancelled" } },
    { new: true },
  ).lean();
  if (!order && !(await Order.exists({ _id: id, userId: user._id }))) throw notFound("Order not found.");
  return ok({ cancelled: Boolean(order) });
});
