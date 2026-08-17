import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  description,
}: {
  kicker?: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <div>
      {kicker ? (
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          {kicker}
        </p>
      ) : null}
      <h1 className="display text-4xl">{title}</h1>
      {description ? (
        <p className="mt-1 text-[var(--muted)]">{description}</p>
      ) : null}
    </div>
  );
}
