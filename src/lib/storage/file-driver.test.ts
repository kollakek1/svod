/**
 * Файловый драйвер: атомарная запись, `.bak`, различение «нет» и «испорчен»
 * и мьютекс на документ. Каждый тест — в своей временной папке.
 */

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dataDirectory, documentFilePath, fileDriver } from "@/lib/storage/file-driver";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "svod-storage-"));
  process.env.SVOD_DATA_DIR = dir;
});

afterEach(() => {
  delete process.env.SVOD_DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("файловый драйвер", () => {
  it("складывает документы в каталог из env", () => {
    expect(dataDirectory()).toBe(dir);
    expect(documentFilePath("bookings")).toBe(join(dir, "bookings.json"));
  });

  it("различает отсутствующий документ", async () => {
    expect(await fileDriver.getDocument("catalog")).toBeNull();
    expect(await fileDriver.readDocument("catalog")).toEqual({ state: "missing" });
  });

  it("пишет и читает документ", async () => {
    const value = await fileDriver.withLockedDocument<{ items: string[] }, number>(
      "bookings",
      async () => ({ next: { items: ["a"] }, result: 1 }),
    );
    expect(value).toBe(1);
    expect(await fileDriver.getDocument("bookings")).toEqual({ items: ["a"] });
  });

  it("держит предыдущую версию в .bak и читает её после порчи основного файла", async () => {
    await fileDriver.withLockedDocument("bookings", async () => ({ next: { items: [1] }, result: null }));
    await fileDriver.withLockedDocument("bookings", async () => ({ next: { items: [2] }, result: null }));

    const file = documentFilePath("bookings");
    expect(existsSync(`${file}.bak`)).toBe(true);
    expect(await fileDriver.getDocument("bookings")).toEqual({ items: [2] });

    writeFileSync(file, "{ это не json", "utf8");
    expect(await fileDriver.readDocument("bookings")).toEqual({ state: "ok", value: { items: [1] } });
  });

  it("сообщает о порче, когда битые оба файла", async () => {
    await fileDriver.withLockedDocument("catalog", async () => ({ next: { a: 1 }, result: null }));
    await fileDriver.withLockedDocument("catalog", async () => ({ next: { a: 2 }, result: null }));

    const file = documentFilePath("catalog");
    writeFileSync(file, "мусор", "utf8");
    writeFileSync(`${file}.bak`, "тоже мусор", "utf8");

    expect(await fileDriver.readDocument("catalog")).toEqual({ state: "corrupt" });
    expect(await fileDriver.getDocument("catalog")).toBeNull();
  });

  it("сериализует одновременные мутации одного документа", async () => {
    await fileDriver.withLockedDocument<{ count: number }, null>("bookings", async () => ({
      next: { count: 0 },
      result: null,
    }));

    await Promise.all(
      Array.from({ length: 12 }, () =>
        fileDriver.withLockedDocument<{ count: number }, null>("bookings", async (current) => {
          const count = current?.count ?? 0;
          return { next: { count: count + 1 }, result: null };
        }),
      ),
    );

    expect(await fileDriver.getDocument("bookings")).toEqual({ count: 12 });
  });

  it("не смешивает документы: блокировка одного не держит другой", async () => {
    await fileDriver.withLockedDocument("catalog", async () => ({ next: { v: 1 }, result: null }));
    await fileDriver.withLockedDocument("admins", async () => ({ next: { users: [] }, result: null }));

    expect(await fileDriver.getDocument("catalog")).toEqual({ v: 1 });
    expect(await fileDriver.getDocument("admins")).toEqual({ users: [] });
  });
});
