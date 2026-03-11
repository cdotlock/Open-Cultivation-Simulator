import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling } from "@/lib/server-error-handler";

const getStorySegments = withErrorHandling(
  "getStorySegments",
  async (characterId: number, page: number, pageSize: number) => {
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
        include: {
          gamePush: {
            select: {
              info: true,
              choice: true,
            },
          },
        },
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
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get('characterId');
    const page = searchParams.get('page');
    const pageSize = searchParams.get('pageSize');

    if (!characterId || !page || !pageSize) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const result = await getStorySegments(
      parseInt(characterId),
      parseInt(page),
      parseInt(pageSize)
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取历史数据失败:', error);
    return NextResponse.json(
      { error: '获取历史数据失败' },
      { status: 500 }
    );
  }
} 