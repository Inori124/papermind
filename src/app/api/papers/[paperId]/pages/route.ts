import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    const { paperId } = await params;
    const { searchParams } = new URL(request.url);
    const pageNum = parseInt(searchParams.get('page') || '1');

    const imagePath = path.join(
      process.cwd(), 'uploads', `${paperId}_pages`, `page_${pageNum}.png`
    );

    if (!fs.existsSync(imagePath)) {
      return new Response('Page image not found', { status: 404 });
    }

    const imageBuffer = fs.readFileSync(imagePath);
    return new Response(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    return new Response('Error', { status: 500 });
  }
}
