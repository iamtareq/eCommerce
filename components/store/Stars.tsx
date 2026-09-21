import { Icon } from "@/components/ui/Icon";
import { toBanglaDigits } from "@/lib/phone";

export function Stars({ rating, className = "size-4" }: { rating: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`৫-এর মধ্যে ${toBanglaDigits(rating)} রেটিং`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" className={`${className} ${i <= rating ? "text-brass-500" : "text-line-strong"}`} />
      ))}
    </span>
  );
}
