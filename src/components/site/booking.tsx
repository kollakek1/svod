import { BookingForm } from "@/components/booking/booking-form";
import { SectionHeader } from "@/components/ui/section-header";
import { SECTION_COPY } from "@/content/clinic";
import type { ClinicDoctor, ClinicService } from "@/lib/clinic";

/**
 * Секция 11 — «Запись».
 * Фарфоровая поверхность, слева шаги до 40rem, справа sticky-summary.
 * Данные каталога приходят со страницы, окна и цены — только с API.
 */
export function Booking({ services, doctors }: { services: ClinicService[]; doctors: ClinicDoctor[] }) {
  const copy = SECTION_COPY.booking;

  return (
    <section
      id="booking"
      aria-labelledby="booking-title"
      className="scroll-mt-[72px] border-t border-line bg-surface py-[var(--spacing-section)]"
    >
      <div className="container-page">
        <SectionHeader id="booking-title" eyebrow={copy.eyebrow} title={copy.title} note={copy.note} />

        <div className="mt-[var(--spacing-stack)]">
          <BookingForm services={services} doctors={doctors} />
        </div>
      </div>
    </section>
  );
}
