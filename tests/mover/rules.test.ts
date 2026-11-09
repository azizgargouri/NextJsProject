import './helpers';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  boxScanOpen,
  computeEarning,
  documentBlockers,
  documentState,
  expectedLoad,
  matchesMove,
  nextJobAction,
  slotCovers,
  slotsOverlap,
  sniffFile,
  todayInTunis,
} from '@/server/modules/mover/mover.rules';
import { signFileUrl, verifyFileSignature } from '@/server/modules/mover/mover.storage';
import { boxLabelCode, parseBoxCode } from '@/lib/box-label';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-15T12:00:00.000Z');

describe('slots', () => {
  it('full day covers everything; a half day covers only itself', () => {
    assert.equal(slotCovers('FULL_DAY', 'MORNING'), true);
    assert.equal(slotCovers('FULL_DAY', 'FULL_DAY'), true);
    assert.equal(slotCovers('MORNING', 'MORNING'), true);
    assert.equal(slotCovers('MORNING', 'AFTERNOON'), false);
    assert.equal(slotCovers('MORNING', 'FULL_DAY'), false);
  });

  it('morning and afternoon do not overlap', () => {
    assert.equal(slotsOverlap('MORNING', 'AFTERNOON'), false);
    assert.equal(slotsOverlap('MORNING', 'FULL_DAY'), true);
    assert.equal(slotsOverlap('AFTERNOON', 'AFTERNOON'), true);
  });
});

describe('document expiry', () => {
  it('warns at exactly 30 days, not at 31', () => {
    const at = (days: number) => new Date(NOW.getTime() + days * DAY);
    assert.equal(documentState(at(31), NOW).state, 'VALID');
    assert.deepEqual(documentState(at(30), NOW), { state: 'EXPIRING', daysLeft: 30 });
    assert.equal(documentState(at(1), NOW).state, 'EXPIRING');
    assert.equal(documentState(new Date(NOW.getTime() + 1), NOW).state, 'EXPIRING');
  });

  it('treats the exact deadline as expired, and no date as valid', () => {
    assert.equal(documentState(NOW, NOW).state, 'EXPIRED');
    assert.deepEqual(documentState(null, NOW), { state: 'VALID', daysLeft: null });
  });

  it('blocks on missing or expired insurance and any other expired document', () => {
    assert.equal(documentBlockers([], NOW).length, 1);
    const future = new Date(NOW.getTime() + DAY);
    const past = new Date(NOW.getTime() - DAY);
    assert.deepEqual(documentBlockers([{ type: 'INSURANCE', expiresAt: future }], NOW), []);
    assert.equal(documentBlockers([{ type: 'INSURANCE', expiresAt: past }], NOW).length, 1);
    assert.equal(
      documentBlockers(
        [
          { type: 'INSURANCE', expiresAt: future },
          { type: 'LICENCE', expiresAt: past },
        ],
        NOW,
      ).length,
      1,
    );
  });
});

describe('offer matching', () => {
  const move = { pickup: { zone: 'TUN' }, moveDate: '2026-07-01', timeSlot: 'MORNING' as const };

  it('needs the pickup zone and a covering slot on that day', () => {
    const on = (date: string, slot: 'MORNING' | 'AFTERNOON' | 'FULL_DAY') => [{ date, slot }];
    assert.equal(
      matchesMove({ zones: ['TUN'], availability: on('2026-07-01', 'MORNING') }, move),
      true,
    );
    assert.equal(
      matchesMove({ zones: ['SFA'], availability: on('2026-07-01', 'MORNING') }, move),
      false,
    );
    assert.equal(
      matchesMove({ zones: ['TUN'], availability: on('2026-07-02', 'MORNING') }, move),
      false,
    );
    assert.equal(
      matchesMove({ zones: ['TUN'], availability: on('2026-07-01', 'AFTERNOON') }, move),
      false,
    );
    assert.equal(matchesMove({ zones: ['TUN'], availability: [] }, move), false);
  });
});

describe('job sequence', () => {
  it('walks on the way, loading, in transit, delivered, then stops', () => {
    assert.equal(nextJobAction({ status: 'ASSIGNED', progressStage: null }), 'EN_ROUTE');
    assert.equal(nextJobAction({ status: 'EN_ROUTE', progressStage: null }), 'LOADING');
    assert.equal(nextJobAction({ status: 'IN_PROGRESS', progressStage: 'LOADING' }), 'IN_TRANSIT');
    assert.equal(
      nextJobAction({ status: 'IN_PROGRESS', progressStage: 'IN_TRANSIT' }),
      'DELIVERED',
    );
    for (const status of ['DELIVERED', 'COMPLETED', 'CANCELLED', 'QUOTING', 'DISPUTED'] as const) {
      assert.equal(nextJobAction({ status, progressStage: null }), null);
    }
  });
});

describe('expected load', () => {
  const item = (name: string, quantity: number, category = '') => ({ name, quantity, category });

  it('splits the client list into boxes and furniture', () => {
    assert.deepEqual(
      expectedLoad([
        item('Sofa', 1, 'Furniture'),
        item('Table', 2, 'Furniture'),
        item('Kitchen stuff', 20, 'Boxes'),
        item('Moving carton', 3),
      ]),
      { boxes: 23, furniture: 3 },
    );
  });

  it('has nothing to compare when the client listed no items', () => {
    assert.equal(expectedLoad([]), null);
  });
});

describe('money', () => {
  it('splits gross into commission and net at millime precision', () => {
    assert.deepEqual(computeEarning(400, 0.15), {
      gross: 400,
      commissionRate: 0.15,
      commission: 60,
      net: 340,
    });
    const tricky = computeEarning(333.333, 0.15);
    assert.equal(tricky.commission, 50);
    assert.equal(tricky.net, 283.333);
    assert.equal(computeEarning(0.1 + 0.2, 0.1).gross, 0.3);
  });
});

describe('file checks', () => {
  it('identifies files by bytes, not name', () => {
    assert.equal(sniffFile(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.contentType, 'image/jpeg');
    assert.equal(
      sniffFile(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.extension,
      'png',
    );
    assert.equal(
      sniffFile(new TextEncoder().encode('RIFF1234WEBPVP8 '))?.contentType,
      'image/webp',
    );
    assert.equal(sniffFile(new TextEncoder().encode('%PDF-1.7'))?.contentType, 'application/pdf');
    assert.equal(sniffFile(new TextEncoder().encode('<script>alert(1)</script>')), null);
    assert.equal(sniffFile(new Uint8Array()), null);
  });

  it('accepts a fresh signature and rejects tampering, expiry and traversal', () => {
    const key = `mover/${'a'.repeat(24)}/photos/${'b'.repeat(8)}-${'c'.repeat(4)}-${'d'.repeat(4)}-${'e'.repeat(4)}-${'f'.repeat(12)}.jpg`;
    const signed = new URL(signFileUrl(key), 'http://x').searchParams;
    const exp = signed.get('exp');
    const sig = signed.get('sig');
    assert.equal(verifyFileSignature(key, exp, sig), true);
    assert.equal(verifyFileSignature(key, exp, `${sig}0`), false);
    assert.equal(verifyFileSignature(key, String(Number(exp) + 60), sig), false);
    assert.equal(verifyFileSignature(key.replace('aaaa', 'bbbb'), exp, sig), false);
    assert.equal(verifyFileSignature(key, exp, sig, Number(exp) * 1000 + 1), false);
    assert.equal(verifyFileSignature('../../.env', exp, sig), false);
    assert.equal(verifyFileSignature(null, exp, sig), false);
  });
});

describe('calendar day', () => {
  it('uses Tunisian time rather than UTC', () => {
    assert.equal(todayInTunis(new Date('2026-06-15T23:30:00.000Z')), '2026-06-16');
    assert.equal(todayInTunis(new Date('2026-06-15T22:30:00.000Z')), '2026-06-15');
  });
});

describe('box labels', () => {
  const REF = 'MV-2026-12345';

  it('prints a code that reads back as the same move and box', () => {
    const code = boxLabelCode(REF, 7);
    assert.equal(code, 'MOVEUP:MV-2026-12345:007');
    assert.deepEqual(parseBoxCode(code, REF), { ok: true, code, label: 'Box 7' });
  });

  it('refuses a printed label from another move', () => {
    const result = parseBoxCode(boxLabelCode('MV-2026-99999', 1), REF);
    assert.deepEqual(result, { ok: false, message: 'This label belongs to move MV-2026-99999' });
  });

  it('accepts any other QR code as it is, with a short name', () => {
    assert.deepEqual(parseBoxCode(' ROLL-42 ', REF), {
      ok: true,
      code: 'ROLL-42',
      label: 'ROLL-42',
    });
    const long = `https://example.com/${'a'.repeat(40)}`;
    const parsed = parseBoxCode(long, REF);
    assert.equal(parsed.ok && parsed.code, long);
    assert.equal(parsed.ok && parsed.label.length, 24);
  });

  it('refuses empty, oversized or control-character codes', () => {
    for (const raw of ['', '   ', 'x'.repeat(201), 'BOX\n1', 'BOX\u0000']) {
      assert.equal(parseBoxCode(raw, REF).ok, false, JSON.stringify(raw));
    }
  });

  it('opens scanning only while loading at pickup', () => {
    assert.equal(boxScanOpen({ status: 'IN_PROGRESS', progressStage: 'LOADING' }), true);
    assert.equal(boxScanOpen({ status: 'IN_PROGRESS', progressStage: 'IN_TRANSIT' }), false);
    assert.equal(boxScanOpen({ status: 'EN_ROUTE', progressStage: null }), false);
    assert.equal(boxScanOpen({ status: 'DELIVERED', progressStage: null }), false);
  });
});
