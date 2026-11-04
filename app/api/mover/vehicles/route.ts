import { NextResponse } from 'next/server';
import { addVehicle, approvedMoverRoute, parseJson, VehicleSchema } from '@/server/modules/mover';

export const POST = approvedMoverRoute(async ({ request, actor }) => {
  const vehicle = await addVehicle(actor.sub, await parseJson(request, VehicleSchema));
  return NextResponse.json({ vehicle }, { status: 201 });
});
