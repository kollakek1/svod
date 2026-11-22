import path from "node:path";
import fs from "node:fs";

/**
 * Проверка наличия файла в /public на сервере.
 * Только для серверных компонентов: если файла нет, показываем типографский фолбэк,
 * а не «битую» картинку и не alt-текст поверх плиты.
 */
export function publicFileExists(publicPath: string | undefined | null): boolean {
  if (!publicPath || !publicPath.startsWith("/")) return false;
  // Защита от выхода за /public: только нормальные сегменты пути.
  if (publicPath.includes("..") || publicPath.includes("\\") || publicPath.includes("\0")) return false;
  try {
    const root = path.join(process.cwd(), "public");
    const resolved = path.join(root, publicPath);
    if (!resolved.startsWith(root + path.sep)) return false;
    return fs.existsSync(resolved);
  } catch {
    return false;
  }
}
