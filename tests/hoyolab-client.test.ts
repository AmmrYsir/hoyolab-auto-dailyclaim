import { describe, expect, it, afterEach } from 'bun:test';
import { HoYoLabClient } from '../src/services/hoyolab-client.ts';

describe('HoYoLabClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should handle successful claim response (retcode 0)', async () => {
    (globalThis as unknown as Record<string, unknown>).fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/sign')) {
        return new Response(
          JSON.stringify({
            retcode: 0,
            message: 'OK',
            data: { code: 'ok', risk_code: 0 },
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('/info')) {
        return new Response(
          JSON.stringify({
            retcode: 0,
            message: 'OK',
            data: { total_sign_day: 15, is_sign: true, is_sub: false, today: '2026-08-16', region: 'os_asia' },
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('/home')) {
        return new Response(
          JSON.stringify({
            retcode: 0,
            message: 'OK',
            data: {
              month: 8,
              awards: Array.from({ length: 30 }, (_, i) => ({
                name: i === 14 ? 'Primogems' : 'Mora',
                cnt: i === 14 ? 60 : 5000,
                icon: 'https://example.com/icon.png',
              })),
              resign: false,
            },
          }),
          { status: 200 }
        );
      }
      return new Response('Not Found', { status: 404 });
    };

    const client = new HoYoLabClient('ltoken_v2=v2_abc; ltuid_v2=123;', {
      fetchRewardDetails: true,
    });

    const result = await client.claimGame('genshin');
    expect(result.status).toBe('SUCCESS');
    expect(result.retcode).toBe(0);
    expect(result.reward?.name).toBe('Primogems');
    expect(result.reward?.count).toBe(60);
    expect(result.signDays).toBe(15);
  });

  it('should handle already claimed response (retcode -5003)', async () => {
    (globalThis as unknown as Record<string, unknown>).fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/sign')) {
        return new Response(
          JSON.stringify({
            retcode: -5003,
            message: "Traveler, you've already checked in today",
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('/info')) {
        return new Response(
          JSON.stringify({
            retcode: 0,
            message: 'OK',
            data: { total_sign_day: 10, is_sign: true, is_sub: false, today: '2026-08-16', region: 'os_asia' },
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('/home')) {
        return new Response(
          JSON.stringify({
            retcode: 0,
            message: 'OK',
            data: {
              month: 8,
              awards: Array.from({ length: 30 }, () => ({
                name: 'Stellar Jade',
                cnt: 20,
                icon: 'https://example.com/jade.png',
              })),
              resign: false,
            },
          }),
          { status: 200 }
        );
      }
      return new Response('Not Found', { status: 404 });
    };

    const client = new HoYoLabClient('ltoken_v2=v2_abc; ltuid_v2=123;', {
      fetchRewardDetails: true,
    });

    const result = await client.claimGame('honkai_star_rail');
    expect(result.status).toBe('ALREADY_CLAIMED');
    expect(result.retcode).toBe(-5003);
    expect(result.signDays).toBe(10);
    expect(result.reward?.name).toBe('Stellar Jade');
  });

  it('should detect CAPTCHA risk blocking (gt_result is_risk = true)', async () => {
    (globalThis as unknown as Record<string, unknown>).fetch = async () => {
      return new Response(
        JSON.stringify({
          retcode: 0,
          message: 'OK',
          data: {
            gt_result: {
              is_risk: true,
              gt: 'geetest_id',
              challenge: 'challenge_id',
            },
          },
        }),
        { status: 200 }
      );
    };

    const client = new HoYoLabClient('ltoken_v2=v2_abc; ltuid_v2=123;');
    const result = await client.claimGame('zenless_zone_zero');

    expect(result.status).toBe('CAPTCHA_TRIGGERED');
    expect(result.message).toContain('CAPTCHA');
  });

  it('should detect expired or invalid token (retcode -100)', async () => {
    (globalThis as unknown as Record<string, unknown>).fetch = async () => {
      return new Response(
        JSON.stringify({
          retcode: -100,
          message: 'Please log in',
        }),
        { status: 200 }
      );
    };

    const client = new HoYoLabClient('ltoken_v2=v2_expired; ltuid_v2=123;');
    const result = await client.claimGame('genshin');

    expect(result.status).toBe('INVALID_TOKEN');
    expect(result.message).toContain('expired or is invalid');
  });
});
