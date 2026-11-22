import { ClinicJsonLd } from "@/app/_seo/clinic-json-ld";
import { Approach } from "@/components/site/approach";
import { Booking } from "@/components/site/booking";
import { Cases } from "@/components/site/cases";
import { Clinic } from "@/components/site/clinic";
import { Doctors } from "@/components/site/doctors";
import { Faq } from "@/components/site/faq";
import { Footer } from "@/components/site/footer";
import { Hero } from "@/components/site/hero";
import { Manifesto } from "@/components/site/manifesto";
import { Programmes } from "@/components/site/programmes";
import { Reviews } from "@/components/site/reviews";
import { Services } from "@/components/site/services";
import { TopBar } from "@/components/site/top-bar";
import { DOCTORS_SEED, SERVICES_SEED } from "@/content/clinic";
import { getCatalog } from "@/lib/catalog-store";
import type { ClinicDoctor, ClinicService } from "@/lib/clinic";

/**
 * Каталог читается из хранилища на каждый запрос: правка цены или услуги
 * в админке должна быть видна на сайте сразу, без пересборки.
 * Если хранилище недоступно, сайт остаётся живым на сиде.
 */
export const dynamic = "force-dynamic";

async function loadCatalog(): Promise<{ services: ClinicService[]; doctors: ClinicDoctor[] }> {
  try {
    const catalog = await getCatalog();
    return { services: catalog.services, doctors: catalog.doctors };
  } catch {
    return { services: [...SERVICES_SEED], doctors: [...DOCTORS_SEED] };
  }
}

export default async function HomePage() {
  const { services, doctors } = await loadCatalog();

  return (
    <>
      <TopBar />
      <main id="main">
        <Hero />
        <Manifesto />
        <Approach />
        <Services services={services} />
        <Programmes />
        <Doctors doctors={doctors} />
        <Clinic />
        <Cases />
        <Reviews />
        <Faq />
        <Booking services={services} doctors={doctors} />
        <ClinicJsonLd services={services} doctors={doctors} />
      </main>
      <Footer />
    </>
  );
}
