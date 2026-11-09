import {
  approvedMoverRoute,
  editVehicle,
  parseJson,
  removeVehicle,
  VehicleSchema,
} from '@/server/modules/mover';

export const PATCH = approvedMoverRoute<{ id: string }>(async ({ request, actor, params }) => ({
  vehicle: await editVehicle(actor.sub, params.id, await parseJson(request, VehicleSchema)),
}));

export const DELETE = approvedMoverRoute<{ id: string }>(({ actor, params }) =>
  removeVehicle(actor.sub, params.id),
);
