import {
  approvedMoverRoute,
  AvailabilityRangeSchema,
  AvailabilitySetSchema,
  listAvailability,
  parse,
  parseJson,
  setAvailability,
} from '@/server/modules/mover';

export const GET = approvedMoverRoute(async ({ request, actor }) => {
  const url = new URL(request.url);
  const { from, to } = parse(AvailabilityRangeSchema, {
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
  });
  return { days: await listAvailability(actor.sub, from, to) };
});

export const PUT = approvedMoverRoute(async ({ request, actor }) => ({
  day: await setAvailability(actor.sub, await parseJson(request, AvailabilitySetSchema)),
}));
