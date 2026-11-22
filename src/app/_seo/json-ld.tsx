import { serializeJsonLd } from "./jsonld";

/**
 * Вставка JSON-LD в документ.
 *
 * `dangerouslySetInnerHTML` здесь оправдан: это данные, а не разметка.
 * `<` экранируется в `\u003c`, поэтому `</script>` из текста услуги не закроет тег.
 * Скрипт не блокирует рендер: он лежит в конце разметки страницы, без `async` и загрузок.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
