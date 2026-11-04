import { NextResponse } from 'next/server';
import {
  chatRoute,
  listMessages,
  MessageCreateSchema,
  MessageThreadSchema,
  parse,
  parseJson,
  sendMessage,
} from '@/server/modules/mover';

/** Shared by the mover workspace now, and by the client and admin screens later. */
export const GET = chatRoute<{ id: string }>(async ({ request, actor, params }) => {
  const thread = parse(MessageThreadSchema, new URL(request.url).searchParams.get('thread'));
  return { messages: await listMessages(actor, params.id, thread) };
});

export const POST = chatRoute<{ id: string }>(async ({ request, actor, params }) => {
  const { thread, body } = await parseJson(request, MessageCreateSchema);
  const message = await sendMessage(actor, params.id, thread, body);
  return NextResponse.json({ message }, { status: 201 });
});
