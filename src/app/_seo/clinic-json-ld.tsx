import { DOCTORS_SEED, SERVICES_SEED } from "@/content/clinic";
import type { ClinicDoctor, ClinicService } from "@/lib/clinic";

import { JsonLd } from "./json-ld";
import { buildClinicJsonLd } from "./jsonld";

/**
 * Готовый блок разметки для лендинга.
 *
 * Если каталог читается из хранилища (админка), передайте живые массивы:
 *   <ClinicJsonLd services={catalog.services} doctors={catalog.doctors} />
 * Если страница статическая — достаточно `<ClinicJsonLdFromContent />`.
 */
export function ClinicJsonLd({
  services,
  doctors,
}: {
  services: ClinicService[];
  doctors: ClinicDoctor[];
}) {
  return <JsonLd data={buildClinicJsonLd({ services, doctors })} />;
}

/** Вариант на сиде из `src/content/clinic.ts` — для статического лендинга. */
export function ClinicJsonLdFromContent() {
  return <ClinicJsonLd services={SERVICES_SEED} doctors={DOCTORS_SEED} />;
}
