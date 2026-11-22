/* eslint-disable @next/next/no-img-element -- статичные webp с точными размерами, lazy loading задан осознанно */
import { ToothArch } from "@/components/site/tooth-arch";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { EQUIPMENT, SECTION_COPY } from "@/content/clinic";
import { publicFileExists } from "@/lib/assets.server";

const INTERIOR_IMAGE = "/images/clinic-interior.webp";
const INSTRUMENTS_IMAGE = "/images/clinic-instruments.webp";

/**
 * Секция 7 — «Клиника». Единственная тёмная секция с чертёжной сеткой.
 * Фото интерьера в арке, четыре строки оборудования и схема дуг FDI.
 */
export function Clinic() {
  const copy = SECTION_COPY.clinic;
  const interiorSrc = publicFileExists(INTERIOR_IMAGE) ? INTERIOR_IMAGE : null;
  const instrumentsSrc = publicFileExists(INSTRUMENTS_IMAGE) ? INSTRUMENTS_IMAGE : null;

  return (
    <section
      id="clinic"
      data-theme="ink"
      aria-labelledby="clinic-title"
      className="relative isolate scroll-mt-[72px] overflow-hidden bg-bg py-[var(--spacing-section)] text-text"
    >
      <div className="blueprint absolute inset-0 -z-10" aria-hidden="true" />

      <div className="container-page">
        <div className="grid-12 items-start">
          <Reveal className="col-span-4 md:col-span-4 lg:col-span-5">
            <figure>
              <div className="arch relative aspect-[4/5] overflow-hidden border border-line-strong bg-surface-2">
                {interiorSrc ? (
                  <img
                    src={interiorSrc}
                    alt="Зал клиники СВОД: четыре кресла, тёплый свет, дерево и камень"
                    width={1000}
                    height={1250}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-end justify-center bg-surface-2 pb-24">
                    <span className="mono-label text-text-muted">интерьер · 4 кресла</span>
                  </div>
                )}
              </div>
              <figcaption className="mt-4 flex items-baseline justify-between gap-6 border-t border-line pt-3">
                <span className="max-w-[34ch] text-[0.75rem] leading-snug text-text-muted">
                  Зал на четыре кресла. Микроскоп у каждого терапевтического места.
                </span>
                <span className="mono-label tnum shrink-0 text-text-muted">рис. 03</span>
              </figcaption>
            </figure>
          </Reveal>

          <Reveal delay={80} className="col-span-4 mt-10 md:col-span-4 md:col-start-5 md:mt-0 lg:col-span-6 lg:col-start-7">
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <h2 id="clinic-title" className="display mt-5 max-w-[18ch] text-h2 text-text">
              {copy.title}
            </h2>
            <p className="mt-4 max-w-[40ch] text-small text-text-muted">{copy.note}</p>

            <ol className="mt-8">
              {EQUIPMENT.map((item) => (
                <li key={item.name} className="border-t border-line py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <h3 className="text-h3 text-text">{item.name}</h3>
                    <span className="mono-label text-accent-text">{item.spec}</span>
                  </div>
                  <p className="mt-2 max-w-[52ch] text-small text-text-muted">{item.text}</p>
                </li>
              ))}
            </ol>

            {instrumentsSrc ? (
              <figure className="mt-4">
                <div className="aspect-[16/10] overflow-hidden border border-line bg-surface-2">
                  <img
                    src={instrumentsSrc}
                    alt="Стерильные инструменты в индивидуальной упаковке на подносе"
                    width={1200}
                    height={750}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </div>
                <figcaption className="mt-3 flex items-baseline justify-between gap-6 border-t border-line pt-3">
                  <span className="max-w-[34ch] text-[0.75rem] leading-snug text-text-muted">
                    Наборы стерилизуем в упаковке класса B и вскрываем при вас.
                  </span>
                  <span className="mono-label tnum shrink-0 text-text-muted">рис. 04</span>
                </figcaption>
              </figure>
            ) : null}
          </Reveal>
        </div>

        <div className="mt-[var(--spacing-stack)] border-t border-line pt-8">
          <div className="grid-12 items-center">
            <div className="col-span-4 md:col-span-8 lg:col-span-4">
              <h3 className="max-w-[16ch] text-h3 text-text">Тридцать две позиции</h3>
              <p className="mt-3 max-w-[34ch] text-small text-text-muted">
                Нумерация FDI: ей мы пользуемся в плане лечения и в карте, чтобы вы и врач говорили об одном зубе.
              </p>
              <p className="mono-num mt-6 max-w-[36ch] leading-relaxed text-text-muted">
                Схема FDI · 32 зуба · верхняя дуга 11–28, нижняя 31–48
              </p>
            </div>

            <div className="col-span-4 mt-8 md:col-span-8 lg:col-span-7 lg:col-start-6 lg:mt-0">
              <ToothArch className="min-w-[300px]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
