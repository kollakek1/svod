import { Fragment } from "react";

import { Marquee } from "@/components/site/marquee";
import { SectionHeader } from "@/components/ui/section-header";
import { REVIEWS, SECTION_COPY } from "@/content/clinic";
import { pluralRu } from "@/lib/format";

/**
 * Секция 9 — «Отзывы». Маркиза с паузой: остановка по кнопке, наведению
 * и фокусу. Текст отзыва — цитата, имя и услуга — подпись. Дубль ленты
 * скрыт от скринридера.
 */
export function Reviews() {
  const copy = SECTION_COPY.reviews;
  const label = `${REVIEWS.length} ${pluralRu(REVIEWS.length, ["отзыв", "отзыва", "отзывов"])}`;

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-title"
      className="scroll-mt-[72px] border-t border-line bg-surface py-[var(--spacing-section)]"
    >
      <div className="container-page">
        <SectionHeader id="reviews-title" eyebrow={copy.eyebrow} title={copy.title} note={copy.note} />

        {REVIEWS.length === 0 ? (
          <p className="mt-8 border-t border-line pt-5 text-body text-text-muted">
            Отзывы собираем и скоро добавим. Пока — спросите на ресепшене, покажем журнал записей.
          </p>
        ) : (
          <Marquee label={label}>
            {REVIEWS.map((review) => (
              <Fragment key={review.id}>
                <figure className="flex w-[min(82vw,22rem)] shrink-0 flex-col justify-between gap-6 pr-8 pt-2">
                  <blockquote className="text-small leading-relaxed text-text">«{review.text}»</blockquote>
                  <figcaption>
                    <span className="block text-[0.9375rem] font-medium leading-snug text-text">{review.name}</span>
                    <span className="mono-label mt-1.5 block leading-relaxed text-text-muted">
                      {review.service} · {review.meta}
                    </span>
                  </figcaption>
                </figure>
                <span className="h-[100px] w-px shrink-0 self-center" aria-hidden="true" />
              </Fragment>
            ))}
          </Marquee>
        )}
      </div>
    </section>
  );
}
