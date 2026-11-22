/**
 * Контракт между секциями лендинга и формой записи.
 *
 * Секции не знают, как устроена запись: они только объявляют намерение
 * («выбрана услуга», «выбран врач») и прокручивают страницу к `#booking`.
 * Форма записи (отдельная команда) подписывается на эти события.
 *
 * Имена событий — публичный контракт, менять только вместе с формой.
 */

export const BOOK_SERVICE_EVENT = "svod:book-service" as const;
export const BOOK_DOCTOR_EVENT = "svod:book-doctor" as const;

export interface BookServiceDetail {
  serviceId: string;
}

export interface BookDoctorDetail {
  doctorId: string;
}

export type BookServiceEvent = CustomEvent<BookServiceDetail>;
export type BookDoctorEvent = CustomEvent<BookDoctorDetail>;

/** Reduced motion: без плавной прокрутки, но с тем же результатом. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Прокрутить к блоку записи. Безопасно вызывать на сервере — ничего не сделает. */
export function scrollToBooking(): void {
  if (typeof window === "undefined") return;
  const target = document.getElementById("booking");
  if (!target) return;
  target.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

function announce<T>(name: string, detail: T): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<T>(name, { detail }));
  scrollToBooking();
}

/** Выбрать услугу в записи и перейти к ней. */
export function selectServiceForBooking(serviceId: string): void {
  if (!serviceId) return;
  announce<BookServiceDetail>(BOOK_SERVICE_EVENT, { serviceId });
}

/** Выбрать врача в записи и перейти к ней. */
export function selectDoctorForBooking(doctorId: string): void {
  if (!doctorId) return;
  announce<BookDoctorDetail>(BOOK_DOCTOR_EVENT, { doctorId });
}
