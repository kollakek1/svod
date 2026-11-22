import type { RefObject } from "react";

/**
 * Заголовок шага. После смены шага в него переводится фокус,
 * поэтому он фокусируемый, но не участвует в порядке табуляции.
 */
export function StepHeading({
  title,
  lead,
  headingRef,
}: {
  title: string;
  lead?: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div>
      <h3 ref={headingRef} tabIndex={-1} className="display scroll-mt-24 text-h3 text-text focus:outline-none">
        {title}
      </h3>
      {lead ? <p className="mt-2 max-w-[46ch] text-small leading-relaxed text-text-muted">{lead}</p> : null}
    </div>
  );
}
