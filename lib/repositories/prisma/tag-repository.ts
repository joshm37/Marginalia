import { prisma } from "@/lib/db/prisma";

export class PrismaTagRepository {
  list(userId: string) {
    return prisma.tag.findMany({
      where: { userId },
      include: { _count: { select: { sources: true, excerpts: true } } },
      orderBy: { name: "asc" },
    });
  }
}
