import { CaseDiagram } from "@/components/site/case-diagram";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeader } from "@/components/ui/section-header";
import { CASES, SECTION_COPY } from "@/content/clinic";
import { formatRub } from "@/lib/format";

/**
 * Секция 8 — «Случаи».
 * Три истории без фото «до и после»: схема, диагноз, решение, срок и сумма.
 * Карточки без заливки, только линия сверху.
 */
export function Cases() {
  const copy = SECTION_COPY.cases;

  return (
    <section
      id="cases"
      aria-labelledby="cases-title"
      className="scroll-mt-[72px] border-t border-line bg-bg py-[var(--spacing-section)]"
    >
      <div className="container-page">
        <SectionHeader id="cases-title" eyebrow={copy.eyebrow} title={copy.title} note={copy.note} />

        <Reveal delay={40}>
          <div className="mt-[var(--spacing-stack)] grid gap-y-12 md:grid-cols-3 md:gap-x-6 lg:gap-x-8">
            {CASES.map((item, index) => (
              <article key={item.id} className="border-t border-line-strong pt-5">
                <div className="flex items-start gap-4 sm:gap-5">
                  <CaseDiagram
                    variant={item.diagram}
                    className="h-[96px] w-[96px] shrink-0 sm:h-[120px] sm:w-[120px]"
                  />
                  <div className="min-w-0 pt-1">
                    <p className="mono-label tnum text-text-muted">
                      Случай {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-2 text-h3 text-text">{item.title}</h3>
                  </div>
                </div>

                <dl className="mt-6 space-y-4">
                  <div>
                    <dt className="mono-label text-text-muted">Ситуация</dt>
                    <dd className="mt-1 text-small text-text">{item.situation}</dd>
                  </div>
                  <div>
                    <dt className="mono-label text-text-muted">Решение</dt>
                    <dd className="mt-1 text-small text-text">{item.solution}</dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-line pt-4 text-small text-text">
                  <span className="whitespace-nowrap tnum">{item.visits}</span>
                  <span aria-hidden="true" className="text-text-muted">
                    ·
                  </span>
                  <span className="whitespace-nowrap tnum">{item.term}</span>
                  <span aria-hidden="true" className="text-text-muted">
                    ·
                  </span>
                  <span className="whitespace-nowrap tnum text-price">{formatRub(item.priceRub)}</span>
                </div>
              </article>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
