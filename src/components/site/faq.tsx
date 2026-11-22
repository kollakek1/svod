import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Eyebrow } from "@/components/ui/eyebrow";
import { CONTACTS, FAQ } from "@/content/clinic";

/**
 * Секция 10 — «Вопросы» (аккордеон, один открытый пункт).
 * Слева sticky-заголовок и телефон, справа аккордеон: один открытый пункт,
 * первый закрыт. Ответы — из контента, без «перезвоните, уточним».
 */
export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-[72px] border-t border-line bg-bg py-[var(--spacing-section)]"
    >
      <div className="container-page">
        <div className="grid-12">
          <div className="col-span-4 md:col-span-8 lg:col-span-4">
            <div className="lg:sticky lg:top-[6.5rem]">
              <Eyebrow>10 — Вопросы</Eyebrow>
              <h2 id="faq-title" className="display mt-5 max-w-[16ch] text-h2 text-text">
                Что спрашивают до записи
              </h2>
              <p className="mt-4 max-w-[34ch] text-small text-text-muted">
                Если вашего вопроса здесь нет — позвоните. Ответим без записи и без «приходите, разберёмся на месте».
              </p>
              <p className="mono-label mt-6 text-text-muted">Телефон</p>
              <a
                href={`tel:${CONTACTS.phoneHref}`}
                className="mono-num link-underline mt-2 whitespace-nowrap text-small text-text"
              >
                {CONTACTS.phone}
              </a>
            </div>
          </div>

          <div className="col-span-4 mt-8 md:col-span-8 lg:col-span-7 lg:col-start-6 lg:mt-0">
            <Accordion type="single" collapsible className="border-b border-line">
              {FAQ.map((item, index) => (
                <AccordionItem key={item.q} value={`faq-${index + 1}`}>
                  <AccordionTrigger>{item.q}</AccordionTrigger>
                  <AccordionContent>{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <p className="mt-6 text-small text-text-muted">
              Не нашли ответ? Позвоните —{" "}
              <a href={`tel:${CONTACTS.phoneHref}`} className="tnum link-underline text-text">
                {CONTACTS.phone}
              </a>
              , ответим в рабочие часы.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
