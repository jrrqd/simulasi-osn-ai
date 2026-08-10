import Link from "next/link";
import { formatDateTimeWib } from "@/lib/datetime";
import { WHATS_NEW } from "@/lib/whats-new";

export function WhatsNewSection() {
  return (
    <section
      id="yang-baru"
      className="border-t border-[var(--line)] bg-[rgba(255,252,246,0.45)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-14 md:py-16">
        <div className="rise mb-10 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-2)]">
            Pembaruan
          </p>
          <h2 className="display mt-2 text-3xl leading-tight md:text-4xl">
            Yang baru
          </h2>
          <p className="mt-3 text-[var(--muted)]">
            Ringkasan fitur dan perbaikan terbaru di Simulasi OSN AI.
          </p>
        </div>

        <ol className="relative space-y-0">
          {WHATS_NEW.map((item, index) => {
            const isLast = index === WHATS_NEW.length - 1;
            const riseClass =
              index === 0 ? "rise" : index === 1 ? "rise rise-delay-1" : "rise rise-delay-2";
            const timestamp = formatDateTimeWib(item.at, {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <li
                key={item.id}
                className={`${riseClass} relative grid gap-4 pb-8 md:grid-cols-[11rem_1fr] md:gap-8 ${
                  isLast ? "pb-0" : ""
                }`}
              >
                {!isLast ? (
                  <span
                    aria-hidden
                    className="absolute top-3 left-[0.42rem] hidden h-[calc(100%-0.5rem)] w-px bg-[var(--line)] md:left-[5.45rem] md:block"
                  />
                ) : null}

                <div className="relative flex items-start gap-3 md:block md:pt-0.5">
                  <span
                    aria-hidden
                    className="mt-1.5 inline-flex h-3 w-3 shrink-0 rounded-full border-2 border-[var(--accent)] bg-[var(--bg)] md:absolute md:-right-[1.72rem] md:mt-2"
                  />
                  <time
                    dateTime={item.at}
                    className="text-sm font-medium leading-snug text-[var(--muted)] tabular-nums"
                  >
                    {timestamp}
                    <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                      WIB
                    </span>
                  </time>
                </div>

                <article className="panel rounded-2xl p-5 md:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.tag ? (
                      <span className="rounded-full bg-[rgba(15,110,86,0.1)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">
                        {item.tag}
                      </span>
                    ) : null}
                    <h3 className="text-lg font-semibold leading-snug">
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="hover:text-[var(--accent)]"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    {item.story}
                  </p>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
