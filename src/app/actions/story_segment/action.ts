import { prisma } from '@/lib/prisma';
export const getStorySegments = async (characterId: number, page: number, pageSize: number) => {
  const skip = (page - 1) * pageSize;
  const [segments, totalCount] = await Promise.all([
    prisma.storySegment.findMany({
      where: {
        characterId: characterId,
      },
      orderBy: {
        id: 'asc',
      },
      skip: skip,
      take: pageSize,
    }),
    prisma.storySegment.count({
      where: {
        characterId: characterId,
      },
    }),
  ]);

  return {
    segments,
    totalCount,
    currentPage: page,
    pageSize: pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}
