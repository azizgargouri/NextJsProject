export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAiEnabled, aiModel } from '@/server/modules/ai/ai.provider';
import { generateObject } from 'ai';
import { z } from 'zod';

const VisionResponseSchema = z.object({
  detectedItems: z.array(
    z.object({
      name: z.string(),
      category: z.enum(['furniture', 'box', 'appliance', 'electronics', 'other']),
      confidence: z.number().min(0).max(1),
      widthCm: z.number().positive(),
      heightCm: z.number().positive(),
      depthCm: z.number().positive(),
      volumeM3: z.number().positive(),
      weightKg: z.number().positive(),
      quantity: z.number().int().positive().default(1),
      box2d: z.object({
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
      }),
      description: z.string(),
    }),
  ),
});

export async function POST(request: NextRequest) {
  try {
    const { image, depthMeters = 2.2 } = await request.json();

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Missing image data URL' }, { status: 400 });
    }

    if (isAiEnabled()) {
      try {
        const { object } = await generateObject({
          model: aiModel(),
          schema: VisionResponseSchema,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this room/moving photo. Detect visible furniture, cardboard boxes, appliances, and items.
For each item:
1. Identify if it is a sofa, cardboard box, dining table, refrigerator, washing machine, bed, wardrobe, etc.
2. Estimate real-world physical dimensions (width, height, depth in centimeters) using the LiDAR depth estimate of ${depthMeters} meters.
3. Compute volume in m³ and realistic payload weight in kg.
4. Provide normalized bounding box coordinates (0-100%).`,
                },
                {
                  type: 'image',
                  image: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`,
                },
              ],
            },
          ],
        });

        const items = object.detectedItems.map((item, idx) => ({
          id: `ai-item-${Date.now()}-${idx}`,
          name: item.name,
          category: item.category,
          confidence: item.confidence,
          widthCm: Math.round(item.widthCm),
          heightCm: Math.round(item.heightCm),
          depthCm: Math.round(item.depthCm),
          volume: Number(item.volumeM3.toFixed(2)),
          weight: Math.round(item.weightKg),
          quantity: item.quantity,
          box2d: item.box2d,
          description: item.description,
        }));

        return NextResponse.json({ items, source: 'ai' });
      } catch (aiErr) {
        console.warn('AI vision model request failed, falling back to local vision engine:', aiErr);
      }
    }

    return NextResponse.json({ items: [], source: 'fallback' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Vision detection failed' },
      { status: 500 },
    );
  }
}
