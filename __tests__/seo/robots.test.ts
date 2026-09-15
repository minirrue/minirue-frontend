import robots from '@/app/robots';

/** #150 — explicit AI-crawler groups, each keeping every disallow. */
describe('robots', () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

  it('names the AI crawlers explicitly', () => {
    const agents = rules.map((r) => r.userAgent);
    for (const bot of ['*', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot']) {
      expect(agents).toContain(bot);
    }
  });

  it('keeps checkout, cart and the auth pages disallowed for every group', () => {
    for (const rule of rules) {
      expect(rule.allow).toBe('/');
      for (const path of ['/checkout', '/cart', '/login', '/signup', '/api/']) {
        expect(rule.disallow).toContain(path);
      }
    }
  });
});
