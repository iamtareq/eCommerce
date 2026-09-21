import { Icon } from "@/components/ui/Icon";
import { field } from "@/components/ui/styles";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className={field.error}>
      <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}
