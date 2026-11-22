/* eslint-disable @next/next/no-img-element -- статичный webp с точными размерами и фолбэком */
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { PRINCIPLES, SECTION_COPY } from "@/content/clinic";
import { publicFileExists } from "@/lib/assets.server";

const DETAIL_IMAGE = "/images/clinic-detail.webp";

/**
 * Секция 2 — «Свод правил».
 * Позиция бренда: сохраняем, а не меняем. Заявление крупно, врезка основателя
 * и фотоплита 1:1 справа. Без карточек и заливок — только линии и набор.
 */
export function Manifesto() {
  const copy = SECTION_COPY.manifesto;
  const detailSrc = publicFileExists(DETAIL_IMAGE) ? DETAIL_IMAGE : null;

  return (
    <section
      id="manifesto"
      aria-labelledby="manifesto-title"
      className="scroll-mt-[72px] border-t border-line bg-bg py-[var(--spacing-section)]"
    >
      <div className="container-page">
        <div className="grid-12">
          <Reveal className="col-span-4 md:col-span-8 lg:col-span-7">
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <h2 id="manifesto-title" className="display mt-6 max-w-[22ch] text-h1 text-text">
              {copy.statement}
            </h2>
            <p className="mt-7 max-w-[46ch] text-body text-text-muted">{copy.note}</p>
          </Reveal>

          <Reveal delay={80} className="col-span-4 mt-10 md:col-span-6 lg:col-span-4 lg:col-start-9 lg:mt-0">
            <figure>
              <div className="relative aspect-square overflow-hidden border border-line bg-surface-2">
                {detailSrc ? (
                  <img
                    src={detailSrc}
                    alt="Керамическая реставрация после обжига на фарфоровой плите"
                    width={800}
                    height={800}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface-2">
                    <span className="mono-label text-text-muted">керамика · фарфор</span>
                  </div>
                )}
              </div>
              <figcaption className="mt-3 flex items-baseline justify-between gap-4 border-t border-line pt-3">
                <span className="max-w-[28ch] text-[0.75rem] leading-snug text-text-muted">
                  Реставрация из своей лаборатории. Съёмка при дневном свете.
                </span>
                <span className="mono-label tnum shrink-0 text-text-muted">рис. 02</span>
              </figcaption>
            </figure>

            <blockquote className="mt-8 border-t border-line pt-5">
              <p className="quote text-text">«{copy.quote}»</p>
              <footer className="mono-label mt-4 text-text-muted">{copy.signature}</footer>
            </blockquote>
          </Reveal>
        </div>

        <Reveal delay={60}>
          <ol className="mt-[var(--spacing-stack)] grid gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:gap-x-8">
            {PRINCIPLES.map((principle) => (
              <li key={principle.index} className="border-t border-line pt-5">
                <span className="mono-label tnum text-accent-text">{principle.index}</span>
                <h3 className="mt-3 text-h3 text-text">{principle.title}</h3>
                <p className="mt-2 max-w-[36ch] text-small text-text-muted">{principle.text}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
