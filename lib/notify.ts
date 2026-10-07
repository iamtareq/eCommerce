import { itemLabel } from "@/config/order";
import { getSiteUrl } from "@/config/site";
import { prisma } from "@/lib/db";
import { formatTaka } from "@/lib/money";

/**
 * Optional Telegram alert for new orders. Enabled when TELEGRAM_BOT_TOKEN and
 * TELEGRAM_CHAT_ID are set. Never throws — a failed alert must not affect orders.
 */
export async function notifyNewOrder(orderId: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return;
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return;
    const lines = [
      `🛒 New order ${order.orderNumber}`,
      `${order.customerName} · ${order.mobileNumber}`,
      `${order.area}, ${order.district}`,
      ...order.items.map((i) => `• ${itemLabel(i.productName, i.variantName)} × ${i.quantity}`),
      order.giftWrap ? `🎁 Gift wrap (${formatTaka(order.giftWrapCharge)})` : "",
      order.giftMessage ? `💌 ${order.giftMessage}` : "",
      `Total: ${formatTaka(order.totalAmount)}`,
      order.isFlagged ? `⚠️ ${order.flagReason}` : "",
      `${getSiteUrl()}/admin/orders/${order.id}`,
    ].filter(Boolean);
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: lines.join("\n"), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("[notify] telegram failed", error instanceof Error ? error.message : error);
  }
}
