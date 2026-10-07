import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/store/CopyButton";
import { Ornament } from "@/components/store/SectionHeading";
import { SuccessTracker } from "@/components/store/SuccessTracker";
import { Icon } from "@/components/ui/Icon";
import { btn } from "@/components/ui/styles";
import { itemLabel, orderStatusLabelBn } from "@/config/order";
import type { OrderStatus } from "@/generated/prisma/enums";
import { getFacebookPageUrl } from "@/config/site";
import { cn } from "@/lib/cn";
import { formatDateBn } from "@/lib/dates";
import { formatTakaBn } from "@/lib/money";
import { findOrderByPublicToken } from "@/lib/orders/public";
import { maskPhone, toBanglaDigits } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { MSG } from "@/lib/validation/messages";

export const metadata: Metadata = {
  title: "অর্ডার সফল হয়েছে",
  robots: { index: false, follow: false },
};

const PROGRESS: { status: OrderStatus; label: string }[] = [
  { status: "PENDING", label: "অর্ডার গ্রহণ" },
  { status: "CONFIRMED", label: "কনফার্মড" },
  { status: "PROCESSING", label: "প্রস্তুত হচ্ছে" },
  { status: "SHIPPED", label: "পাঠানো হয়েছে" },
  { status: "DELIVERED", label: "ডেলিভারি সম্পন্ন" },
];

/** Where the order is in its journey; a cancelled order says so instead. */
function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === "CANCELLED") {
    return (
      <p className="flex items-start gap-2.5 rounded-xl border border-danger-600/30 bg-danger-50 p-4 text-left font-medium text-danger-700">
        <Icon name="x" className="mt-0.5 size-5 shrink-0" />
        অর্ডারটি বাতিল করা হয়েছে। কোনো প্রশ্ন থাকলে আমাদের ফেসবুক পেজে মেসেজ দিন।
      </p>
    );
  }
  // On hold sits between placing and confirming.
  const reached = status === "ON_HOLD" ? 0 : PROGRESS.findIndex((p) => p.status === status);
  return (
    <div>
      <ol className="grid grid-cols-5 gap-1" aria-label="অর্ডারের অগ্রগতি">
        {PROGRESS.map((p, i) => (
          <li key={p.status} className="flex flex-col items-center gap-2 text-center" aria-current={i === reached ? "step" : undefined}>
            <span
              className={cn(
                "grid size-9 place-items-center rounded-full border-2 text-sm font-bold",
                i < reached && "border-pine-700 bg-pine-700 text-white",
                i === reached && "border-pine-700 bg-pine-50 text-pine-800 ring-4 ring-pine-600/15",
                i > reached && "border-line-strong bg-surface text-muted",
              )}
            >
              {i < reached ? <Icon name="check" className="size-4.5" /> : toBanglaDigits(i + 1)}
            </span>
            <span className={cn("text-[0.8rem] leading-tight sm:text-sm", i <= reached ? "font-semibold text-ink" : "text-muted")}>{p.label}</span>
          </li>
        ))}
      </ol>
      {status === "ON_HOLD" && (
        <p className="mt-4 rounded-xl bg-brass-50 p-3 text-sm text-brass-800">অর্ডারটি এই মুহূর্তে হোল্ডে আছে। আমাদের প্রতিনিধি শীঘ্রই আপনার সাথে যোগাযোগ করবেন।</p>
      )}
    </div>
  );
}

export default async function OrderSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [{ token }, { view }] = await Promise.all([params, searchParams]);
  const order = await findOrderByPublicToken(token);
  if (!order) notFound();
  // Opened from order tracking (maybe days later, on another device): show the status, not a fresh "success".
  const statusView = view === "status";

  const settings = await getSettings();
  const facebookUrl = settings.facebookPageUrl || getFacebookPageUrl();

  return (
    <section className="bg-sand py-10 sm:py-14">
      {!statusView && <SuccessTracker orderNumber={order.orderNumber} value={order.totalAmount} itemCount={order.itemCount} />}
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <div className="rounded-card border border-line bg-surface p-6 text-center shadow-soft sm:p-8">
          {statusView ? (
            <h1 className="text-balance text-[1.6rem] font-semibold text-pine-900 sm:text-[2rem]">আপনার অর্ডারের অবস্থা</h1>
          ) : (
            <>
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-success-50 text-success-700">
                <Icon name="checkCircle" className="size-9" />
              </span>
              <h1 className="mt-4 text-balance text-[1.6rem] font-semibold text-pine-900 sm:text-[2rem]">
                অর্ডার সফলভাবে গ্রহণ করা হয়েছে! 🎉
              </h1>
              <p className="mt-2 text-muted">{MSG.success}</p>
            </>
          )}

          <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-brass-300 bg-brass-50 p-4">
            <p className="text-sm font-medium text-brass-800">আপনার অর্ডার নম্বর</p>
            <p className="mt-1 font-mono text-xl font-bold tracking-wide text-ink sm:text-2xl">{order.orderNumber}</p>
            <div className="mt-3 flex justify-center">
              <CopyButton value={order.orderNumber} label="নম্বর কপি করুন" />
            </div>
          </div>

          <div className="mt-6">
            <OrderProgress status={order.orderStatus} />
          </div>

          {order.orderStatus === "PENDING" && (
            <p className="mx-auto mt-6 flex max-w-md items-start gap-2.5 rounded-xl bg-pine-50 p-4 text-left text-[0.97rem] leading-7 text-pine-900">
              <Icon name="phone" className="mt-1 size-5 shrink-0 text-pine-700" />
              আমাদের প্রতিনিধি শীঘ্রই {toBanglaDigits(maskPhone(order.mobileNumber))} নম্বরে ফোন করে আপনার অর্ডারটি কনফার্ম করবেন। অনুগ্রহ করে ফোনটি কাছে রাখুন।
            </p>
          )}
        </div>

        <div className="mt-5 rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6">
          <Ornament className="mb-4" />
          <h2 className="text-center font-sans text-lg font-semibold text-ink">অর্ডারের বিবরণ</h2>
          <dl className="mt-5 grid gap-4 text-[0.97rem] sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">গ্রাহকের নাম</dt>
              <dd className="font-semibold text-ink">{order.customerName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">মোবাইল নম্বর</dt>
              <dd className="font-semibold text-ink">{toBanglaDigits(maskPhone(order.mobileNumber))}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted">ডেলিভারি ঠিকানা</dt>
              <dd className="font-semibold text-ink">
                {order.address}
                <span className="block font-normal text-ink-soft">
                  {order.area}, {order.district}, {order.division}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">অর্ডারের সময়</dt>
              <dd className="font-semibold text-ink">{formatDateBn(order.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">অবস্থা</dt>
              <dd className="font-semibold text-ink">{orderStatusLabelBn(order.orderStatus)}</dd>
            </div>
          </dl>

          <table className="mt-6 w-full text-left text-[0.95rem]">
            <caption className="sr-only">অর্ডারকৃত পণ্য</caption>
            <thead>
              <tr className="border-b border-line text-sm text-muted">
                <th scope="col" className="py-2 font-medium">পণ্য</th>
                <th scope="col" className="py-2 text-center font-medium">পরিমাণ</th>
                <th scope="col" className="py-2 text-right font-medium">মূল্য</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-2">
                    <span className="font-medium text-ink">{itemLabel(item.productName, item.variantName)}</span>
                    <span className="block text-sm text-muted">একক মূল্য {formatTakaBn(item.unitPrice)}</span>
                  </td>
                  <td className="py-3 text-center tabular-nums">{toBanglaDigits(item.quantity)}</td>
                  <td className="py-3 text-right font-semibold tabular-nums">{formatTakaBn(item.lineSubtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[0.97rem]">
            <div className="flex justify-between">
              <dt className="text-ink-soft">সাবটোটাল</dt>
              <dd className="tabular-nums">{formatTakaBn(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">
                ডেলিভারি চার্জ <span className="text-sm text-muted">({order.deliveryZoneName})</span>
              </dt>
              <dd className="tabular-nums">{order.deliveryCharge === 0 ? "ফ্রি" : formatTakaBn(order.deliveryCharge)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">ছাড়{order.couponCode ? ` (কুপন ${order.couponCode})` : ""}</dt>
              <dd className="tabular-nums text-success-700">
                {order.discount > 0 ? `− ${formatTakaBn(order.discount)}` : formatTakaBn(0)}
              </dd>
            </div>
            {order.giftWrapCharge > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-soft">গিফট র‍্যাপ</dt>
                <dd className="tabular-nums">{formatTakaBn(order.giftWrapCharge)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-3 text-lg font-bold">
              <dt>সর্বমোট</dt>
              <dd className="tabular-nums text-pine-800">{formatTakaBn(order.totalAmount)}</dd>
            </div>
          </dl>
          {order.giftMessage && (
            <p className="mt-4 rounded-xl bg-brass-50 p-3 text-sm whitespace-pre-line text-ink-soft">
              <span className="font-semibold">উপহার বার্তা:</span> {order.giftMessage}
            </p>
          )}
          {order.customerNote && (
            <p className="mt-4 rounded-xl bg-paper p-3 text-sm text-ink-soft">
              <span className="font-semibold">আপনার নির্দেশনা:</span> {order.customerNote}
            </p>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {facebookUrl && (
            <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className={cn(btn.primary, btn.size.lg)}>
              <Icon name="facebook" className="size-5" /> ফেসবুক পেজে যান
            </a>
          )}
          <Link href="/" className={cn(btn.outline, btn.size.lg)}>
            <Icon name="bag" className="size-5" /> আবার অর্ডার করুন
          </Link>
        </div>
        <p className="mt-5 text-center text-sm text-muted">
          এই পেজের লিংকটি সংরক্ষণ করে রাখতে পারেন। লিংক হারালে{" "}
          <Link href="/track" className="font-semibold text-pine-700 underline">
            অর্ডার ট্র্যাক
          </Link>{" "}
          পেজে অর্ডার নম্বর ও মোবাইল নম্বর দিয়ে অবস্থা দেখতে পারবেন।
        </p>
      </div>
    </section>
  );
}
