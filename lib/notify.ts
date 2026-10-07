import { itemLabel } from "@/config/order";
import { getSiteUrl } from "@/config/site";
import { prisma } from "@/lib/db";
import { formatTaka } from "@/lib/money";
import { getSettingsFresh } from "@/lib/settings";
import { stockCrossedBy } from "@/lib/stock";

/**
 * Optional Telegram alert for new orders. Enabled when TELEGRAM_BOT_TOKEN and
 * TELEGRAM_CHAT_ID are set. Never throws — a failed alert must not affect orders.
 */
export async function notifyNewOrder(orderId: string): Promise<void> {
  if (!telegramConfig()) return;
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
    await sendTelegram(lines.join("\n"));
  } catch (error) {
    console.error("[notify] telegram failed", error instanceof Error ? error.message : error);
  }
}

/** Telegram alert for variants this order took to the low-stock threshold or below. Never throws. */
export async function notifyLowStock(orderId: string): Promise<void> {
  if (!telegramConfig()) return;
  try {
    const { lowStockThreshold } = await getSettingsFresh();
    const crossed = await stockCrossedBy(orderId, lowStockThreshold);
    if (crossed.length === 0) return;
    const lines = [
      `📦 Low stock (${lowStockThreshold} or fewer left)`,
      ...crossed.map((v) => `• ${v.label}: ${v.stock === 0 ? "OUT OF STOCK" : `${v.stock} left`}`),
      `${getSiteUrl()}/admin`,
    ];
    await sendTelegram(lines.join("\n"));
  } catch (error) {
    console.error("[notify] low-stock alert failed", error instanceof Error ? error.message : error);
  }
}

function telegramConfig(): { token: string; chatId: string } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  return token && chatId ? { token, chatId } : null;
}

async function sendTelegram(text: string): Promise<void> {
  const config = telegramConfig();
  if (!config) return;
  await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: config.chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
}
