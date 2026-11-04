import { NextResponse } from 'next/server';
import { asClient, parseBody } from '../homes/homes.controller';
import { LayoutItemUpdateSchema } from './layout.schema';
import { layoutService } from './layout.service';

/** HTTP adapter for a house's layout plan (generate / read / delete). */
class LayoutController {
  generate(request: Request, homeId: string) {
    return asClient(request, async (client) =>
      NextResponse.json({ plan: await layoutService.generate(client, homeId) }, { status: 201 }),
    );
  }

  findOne(request: Request, homeId: string) {
    return asClient(request, async (client) =>
      NextResponse.json({ plan: await layoutService.get(client, homeId) }),
    );
  }

  updateItem(request: Request, homeId: string) {
    return asClient(request, async (client) => {
      const input = await parseBody(request, LayoutItemUpdateSchema, 'Please check the change');
      return NextResponse.json({ plan: await layoutService.updateItem(client, homeId, input) });
    });
  }

  remove(request: Request, homeId: string) {
    return asClient(request, async (client) =>
      NextResponse.json(await layoutService.remove(client, homeId)),
    );
  }
}

export const layoutController = new LayoutController();
