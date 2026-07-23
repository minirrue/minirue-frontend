import { fetchStorefrontPage } from '@/lib/api/storefront';
import { render, screen } from '@testing-library/react';
import Markdown from '@/components/storefront/Markdown';

describe('fetchStorefrontPage', () => {
  afterEach(() => {
    (global.fetch as unknown as jest.Mock)?.mockReset?.();
  });

  it('returns the parsed body on a 200 response', async () => {
    const body = { slug: 'privacy', title: 'Privacy Policy', body: '# Privacy\n\nWe respect it.' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    }) as unknown as typeof fetch;

    const page = await fetchStorefrontPage('privacy');
    expect(page).toEqual(body);

    const [url] = (global.fetch as unknown as jest.Mock).mock.calls[0];
    expect(String(url)).toContain('/v1/storefront/pages/privacy');
  });

  it('returns null on a 404 response instead of throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch;

    const page = await fetchStorefrontPage('nope');
    expect(page).toBeNull();
  });

  it('throws on a non-404 non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    await expect(fetchStorefrontPage('privacy')).rejects.toThrow();
  });
});

describe('Markdown', () => {
  it('renders **bold** as <strong> and [text](url) as an <a href>', () => {
    render(<Markdown body="This is **bold** and a [link](https://example.com)." />);
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    const link = screen.getByText('link');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('does not render a javascript: link as an href', () => {
    const { container } = render(<Markdown body="[click me](javascript:alert(1))" />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('click me');
  });
});
