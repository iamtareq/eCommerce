import type { OrderStatus } from "@/generated/prisma/enums";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { toBanglaDigits } from "@/lib/phone";

const PROGRESS: { status: OrderStatus; label: string }[] = [
  { status: "PENDING", label: "অর্ডার গ্রহণ" },
  { status: "CONFIRMED", label: "কনফার্মড" },
  { status: "PROCESSING", label: "প্রস্তুত হচ্ছে" },
  { status: "SHIPPED", label: "পাঠানো হয়েছে" },
  { status: "DELIVERED", label: "ডেলিভারি সম্পন্ন" },
];

/** Where the order is in its journey; a cancelled order says so instead. */
export function OrderProgress({ status }: { status: OrderStatus }) {
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
