import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const createPrismaClient = () => new PrismaClient();

const getClient = (): PrismaClient => {
  if (process.env.NODE_ENV === "production") {
    if (!globalThis.prisma) {
      globalThis.prisma = createPrismaClient();
    }
    return globalThis.prisma;
  }

  // Trong môi trường development: nếu instance trong cache bị thiếu các model mới (như course, workspace)
  // do schema được cập nhật sau khi dev server khởi động, tiến hành ngắt kết nối và tạo instance mới
  const cached = globalThis.prisma as (Record<string, unknown> & { $disconnect?: () => Promise<void> }) | undefined;
  if (cached && (!("course" in cached) || !("workspace" in cached) || !("notePage" in cached) || !("aiNoteEdit" in cached))) {
    cached.$disconnect?.().catch(() => {});
    globalThis.prisma = undefined;
  }

  if (!globalThis.prisma) {
    globalThis.prisma = createPrismaClient();
  }

  return globalThis.prisma;
};

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
