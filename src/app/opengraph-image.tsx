import { OG_ALT, OG_SIZE } from "./_seo/site";
import { ogImageResponse } from "./_seo/og-frame";

export const alt = OG_ALT;
export const size = { width: OG_SIZE.width, height: OG_SIZE.height };
export const contentType = "image/png";

export default function Image() {
  return ogImageResponse();
}
