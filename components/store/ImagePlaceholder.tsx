import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * Shown where a product has no photo yet. Deliberately looks like a
 * placeholder so it is never mistaken for a real product image.
 */
export function ImagePlaceholder({ className, label = "ছবি শীঘ্রই যোগ করা হবে" }: { className?: string; label?: string }) {
  return (
    <div
      className={cn(
        "bg-girih flex h-full w-full flex-col items-center justify-center gap-2 bg-pine-50 text-center text-pine-700",
        className,
      )}
      role="img"
      aria-label={label}
    >
      <span className="grid size-14 place-items-center rounded-full bg-white/80 shadow-soft">
        <Icon name="gift" className="size-7" />
      </span>
      <span className="px-4 text-sm font-medium text-muted">{label}</span>
    </div>
  );
}
