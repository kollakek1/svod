import { DoctorsRail, type DoctorCard } from "@/components/site/doctors-rail";
import { SectionHeader } from "@/components/ui/section-header";
import { SECTION_COPY } from "@/content/clinic";
import { publicFileExists } from "@/lib/assets.server";
import type { ClinicDoctor } from "@/lib/clinic";
import { pluralRu } from "@/lib/format";

/**
 * Секция 6 — «Врачи».
 * Сервер проверяет, что фото врача действительно лежит в /public,
 * и отдаёт ленте уже готовые пути. Остальное — клиентская лента.
 */
export function Doctors({ doctors }: { doctors: ClinicDoctor[] }) {
  const copy = SECTION_COPY.doctors;

  const cards: DoctorCard[] = doctors.map((doctor) => ({
    ...doctor,
    photoSrc: doctor.photo && publicFileExists(doctor.photo) ? doctor.photo : null,
  }));

  // Заголовок считает реальное число врачей: каталог редактируется в админке.
  const count = doctors.length;
  const title =
    count > 0
      ? `${count} ${pluralRu(count, ["врач", "врача", "врачей"])}. Один из них — ваш`
      : "Врачи клиники";

  return (
    <section
      id="doctors"
      aria-labelledby="doctors-title"
      className="scroll-mt-[72px] border-t border-line bg-bg py-[var(--spacing-section)]"
    >
      <div className="container-page">
        <SectionHeader id="doctors-title" eyebrow={copy.eyebrow} title={title} note={copy.note} />
        <div className="mt-[var(--spacing-stack)]">
          <DoctorsRail doctors={cards} />
        </div>
      </div>
    </section>
  );
}
