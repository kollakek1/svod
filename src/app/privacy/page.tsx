import type { Metadata } from "next";
import Link from "next/link";

import { Eyebrow } from "@/components/ui/eyebrow";
import { CONTACTS, HOURS_SUMMARY } from "@/content/clinic";

/**
 * ВНИМАНИЕ: текст политики — шаблон под этот сайт и форму записи.
 * Перед публикацией его должен прочитать юрист: состав данных и сроки
 * хранения зависят от реальных процессов клиники и требований 152-ФЗ.
 * Реквизиты (ИНН, ОГРН, лицензия) намеренно не указаны — их у нас нет.
 */

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description:
    "Как клиника СВОД обращается с данными из формы записи: что собираем, зачем, где храним, сколько и как удалить.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/privacy",
    title: "Политика конфиденциальности — СВОД",
    description:
      "Как клиника СВОД обращается с данными из формы записи: что собираем, зачем, где храним, сколько и как удалить.",
    // Своя openGraph-секция не наследует картинку из layout — ссылаемся на тот же кадр явно.
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "СВОД — стоматология сохранения" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

const REVISION = "22 ноября 2026";

/** Пункт списка: волосяной штрих вместо буллита — как в остальных списках сайта. */
function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-3 h-px w-3.5 shrink-0 bg-line-strong" />
      <span>{children}</span>
    </li>
  );
}

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line pt-6" aria-labelledby={`p-${index}`}>
      <div className="flex gap-3 lg:gap-x-8">
        <p className="mono-label w-6 shrink-0 text-accent-text">{index}</p>
        <div className="flex-1">
          <h2 id={`p-${index}`} className="text-h3 text-text">
            {title}
          </h2>
          <div className="measure mt-4 flex flex-col gap-3 text-body text-text">{children}</div>
        </div>
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <header className="border-b border-line">
        <div className="container-page flex items-center justify-between gap-4 py-5">
          <Link
            href="/"
            aria-label="СВОД — на главную"
            className="font-display text-[1.35rem] leading-none tracking-[0.16em] text-text"
          >
            СВОД
          </Link>
          <p className="mono-label text-text-muted">Правовая информация</p>
        </div>
      </header>

      <main id="main" className="container-page pb-[var(--spacing-section-sm)] pt-7">
        <div className="mt-[var(--spacing-stack)]">
          <Eyebrow>Документы клиники</Eyebrow>

          <h1
            className="display mt-5 max-w-[26ch] leading-none text-text"
            style={{ fontSize: "clamp(1.875rem, 5.2vw, 4.2rem)" }}
          >
            Политика конфиденциальности
          </h1>

          <p className="mt-5 max-w-[46ch] text-lead text-text-muted">
            Мы собираем данные, чтобы записать вас на приём и не потерять вашу запись. Ниже — что именно, зачем, где
            это лежит и как попросить удалить.
          </p>

          <p className="mono-label mt-7 text-text-muted">Редакция от {REVISION}</p>

          <div className="mt-10 flex flex-col gap-y-8">
            <Section index="01" title="Кто отвечает за данные">
              <p>
                Оператор персональных данных — «Клиника СВОД»: {CONTACTS.address}. Телефон{" "}
                <a href={`tel:${CONTACTS.phoneHref}`} className="link-underline tnum">
                  {CONTACTS.phone}
                </a>
                , почта{" "}
                <a href={`mailto:${CONTACTS.email}`} className="link-underline">
                  {CONTACTS.email}
                </a>
                .
              </p>
              <p>По вопросам о данных пишите на эту почту. Отвечает администратор клиники, а не автоответчик.</p>
            </Section>

            <Section index="02" title="Какие данные мы собираем">
              <p>Только то, без чего не получится провести приём:</p>
              <ul className="flex flex-col gap-2">
                <Item>имя;</Item>
                <Item>телефон;</Item>
                <Item>почту — если вы её указали;</Item>
                <Item>комментарий к записи;</Item>
                <Item>выбранные услугу, врача и время визита.</Item>
              </ul>
              <p>
                Дополнительно на несколько минут сохраняем IP-адрес и время отправки формы — только чтобы отличить
                человека от автоматических заявок. Вместе с записью IP не хранится.
              </p>
              <p>
                Снимки, карту лечения и историю визитов ведём в клинике по правилам для медицинских организаций. На
                сайте их нет.
              </p>
            </Section>

            <Section index="03" title="Зачем это нужно">
              <ul className="flex flex-col gap-2">
                <Item>записать вас на приём и подтвердить время звонком;</Item>
                <Item>напомнить о визите, который вы выбрали;</Item>
                <Item>ответить на вопрос, оставленный в комментарии;</Item>
                <Item>защитить форму записи от спама.</Item>
              </ul>
              <p>
                Для рекламных рассылок данные из записи не используем. Если однажды захотите получать напоминания о
                профилактике — спросим отдельно, автоматически не подписываем.
              </p>
            </Section>

            <Section index="04" title="На каком основании">
              <p>
                Вы даёте согласие, когда отмечаете пункт в форме и отправляете её. Второе основание — исполнение
                договора: без имени и телефона приём, который вы запросили, не провести.
              </p>
              <p>
                Согласие можно отозвать в любой момент. Достаточно письма на{" "}
                <a href={`mailto:${CONTACTS.email}`} className="link-underline">
                  {CONTACTS.email}
                </a>{" "}
                — прекратим обработку и скажем, что уже успели сохранить.
              </p>
            </Section>

            <Section index="05" title="Где храним и сколько">
              <p>
                Записи лежат на серверах, доступ к которым есть только у сотрудников, отвечающих за расписание.
                Соединение с сайтом защищено.
              </p>
              <p>
                Срок: пока вы остаётесь пациентом и ещё год после последнего визита. Заявки, которые не стали визитом,
                удаляем через шесть месяцев. Если попросите удалить раньше — удалим.
              </p>
            </Section>

            <Section index="06" title="Передаём ли третьим лицам">
              <p>
                Не продаём данные и не отдаём их для чужих рассылок. Возможны три случая: вы попросили сами; этого
                требует закон; технические подрядчики — хостинг и отправка писем — видят только то, что нужно для их
                задачи, и отвечают за конфиденциальность.
              </p>
              <p>Если для лечения понадобится другая клиника или лаборатория, скажем заранее и спросим согласие.</p>
            </Section>

            <Section index="07" title="Cookies">
              <p>
                Для гостей сайт не ставит cookie: запись работает без них, выбор услуги и времени хранится в памяти
                страницы. Служебная cookie нужна только сотруднику клиники, чтобы войти в кабинет. Аналитики,
                рекламных пикселей и сторонних счётчиков на сайте нет.
              </p>
            </Section>

            <Section index="08" title="Ваши права">
              <p>
                Вы можете посмотреть свои данные, исправить их, удалить или отозвать согласие. Напишите на{" "}
                <a href={`mailto:${CONTACTS.email}`} className="link-underline">
                  {CONTACTS.email}
                </a>{" "}
                с телефона, на который оформлена запись, — так мы поймём, что это вы.
              </p>
              <p>Отвечаем в течение 10 рабочих дней.</p>
            </Section>

            <Section index="09" title="Безопасность">
              <p>
                Доступ к данным есть только у сотрудников, которым он нужен по работе, и закрыт паролем; передача идёт
                по защищённому соединению.
              </p>
            </Section>

            <Section index="10" title="Как связаться">
              <dl className="grid gap-y-6 sm:grid-cols-2 sm:gap-x-6">
                <div className="border-t border-line pt-3">
                  <dt className="mono-label text-text-muted">Телефон</dt>
                  <dd className="mt-2">
                    <a href={`tel:${CONTACTS.phoneHref}`} className="link-underline tnum text-text">
                      {CONTACTS.phone}
                    </a>
                  </dd>
                </div>
                <div className="border-t border-line pt-3">
                  <dt className="mono-label text-text-muted">Почта</dt>
                  <dd className="mt-2">
                    <a href={`mailto:${CONTACTS.email}`} className="link-underline text-text">
                      {CONTACTS.email}
                    </a>
                  </dd>
                </div>
                <div className="border-t border-line pt-3">
                  <dt className="mono-label text-text-muted">Адрес</dt>
                  <dd className="mt-2 text-text">
                    {CONTACTS.address}
                    <span className="block text-small text-text-muted">{CONTACTS.entrance}</span>
                  </dd>
                </div>
                <div className="border-t border-line pt-3">
                  <dt className="mono-label text-text-muted">Часы</dt>
                  <dd className="mt-2 text-text">
                    {HOURS_SUMMARY.map((row) => (
                      <span key={row.days} className="tnum block">
                        {row.days} {row.time}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            </Section>
          </div>

          <p className="measure mt-8 text-small text-text-muted">
            Этот документ описывает работу сайта и формы записи. Медицинскую документацию клиники он не заменяет.
          </p>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="container-page flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="link-underline mono-label text-text">
            ← На главную
          </Link>
          <p className="text-small text-text-muted">© 2026 СВОД · Не является публичной офертой</p>
        </div>
      </footer>
    </>
  );
}
