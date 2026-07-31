/**
 * Unit tests — components/chat/ChatPanel.tsx (Tasks #31 and #32, 2026-07-31).
 *
 * Task #31, owner: "when we uploaded an image inside the chat support area in
 * the frontend i didnt know that it was uploading there is no status ui" and
 * "when we pasted an image from mobile inside chat support on mobile it says
 * chrome doesnt support pasting here".
 *   - a picked file must appear in the composer in the SAME tick, showing the
 *     LOCAL bytes (an object URL) and an explicit uploading state — never a
 *     silent wait on the network and never a frame sourced from a cold remote
 *     URL;
 *   - a pasted image must take the identical path as the attach button.
 *
 * Task #32, owner: "when a cx sends a text in chat, the chat page must be
 * scrolled to bottom automatic", "and when he opens a chat also navigation
 * between chats". The regression these pin is a ONE-SHOT scroll: an effect
 * that lands at the bottom the first time and then never again, so switching
 * to a second conversation opens it at the very top of its history.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ChatPanel, { type ChatDisplayMessage } from '@/components/chat/ChatPanel';

const noop = () => {};

/** jsdom reports 0 for every layout box, so "did it scroll to the bottom"
 *  cannot be observed without giving the scroller a real height. */
const SCROLL_HEIGHT = 1000;
const CLIENT_HEIGHT = 300;

let scrollHeightSpy: PropertyDescriptor | undefined;
let clientHeightSpy: PropertyDescriptor | undefined;

beforeAll(() => {
  scrollHeightSpy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
  clientHeightSpy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => SCROLL_HEIGHT,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => CLIENT_HEIGHT,
  });
});

afterAll(() => {
  if (scrollHeightSpy) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeightSpy);
  if (clientHeightSpy) Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeightSpy);
});

/** The message list is the only scroller in the panel; it opts out of Lenis. */
function scroller(): HTMLElement {
  const el = document.querySelector('[data-lenis-prevent]');
  if (!el) throw new Error('message list not rendered');
  return el as HTMLElement;
}

function msg(id: string, text: string): ChatDisplayMessage {
  return { id, from: 'agent', name: 'MiniRue Support', text, time: '12:00 PM' };
}

describe('ChatPanel — scroll to bottom (Task #32)', () => {
  it('lands at the bottom when a conversation is opened', () => {
    render(
      <ChatPanel
        open
        referenceId="conv-1"
        messages={[msg('a', 'one'), msg('b', 'two')]}
        onClose={noop}
        onSend={noop}
      />,
    );
    expect(scroller().scrollTop).toBe(SCROLL_HEIGHT);
  });

  it('lands at the bottom AGAIN when switching to a different conversation', () => {
    const { rerender } = render(
      <ChatPanel
        open
        referenceId="conv-1"
        messages={[msg('a', 'one')]}
        onClose={noop}
        onSend={noop}
      />,
    );
    expect(scroller().scrollTop).toBe(SCROLL_HEIGHT);

    // Simulate the reader having scrolled up in the FIRST thread, then a
    // switch to a second one. A one-shot "already scrolled once" ref would
    // leave the new thread parked wherever this put it.
    fireEvent.scroll(scroller(), { target: { scrollTop: 0 } });
    scroller().scrollTop = 0;

    rerender(
      <ChatPanel
        open
        referenceId="conv-2"
        messages={[msg('c', 'other thread')]}
        onClose={noop}
        onSend={noop}
      />,
    );
    expect(scroller().scrollTop).toBe(SCROLL_HEIGHT);
  });

  it('lands at the bottom when the customer sends a message', () => {
    const sent: string[] = [];
    const { rerender } = render(
      <ChatPanel
        open
        referenceId="conv-1"
        messages={[msg('a', 'one')]}
        onClose={noop}
        onSend={(t) => sent.push(t)}
      />,
    );
    scroller().scrollTop = 0;

    fireEvent.change(screen.getByLabelText('Type your message'), {
      target: { value: 'hello there' },
    });
    fireEvent.click(screen.getByLabelText('Send message'));
    expect(sent).toEqual(['hello there']);

    // The parent appends the optimistic bubble; the scroll is issued from the
    // layout effect that runs once that new list has committed.
    rerender(
      <ChatPanel
        open
        referenceId="conv-1"
        messages={[msg('a', 'one'), { ...msg('b', 'hello there'), from: 'cx', name: 'You' }]}
        onClose={noop}
        onSend={(t) => sent.push(t)}
      />,
    );
    expect(scroller().scrollTop).toBe(SCROLL_HEIGHT);
  });

  it('does NOT yank a reader who scrolled up when an unrelated message arrives', async () => {
    const { rerender } = render(
      <ChatPanel
        open
        referenceId="conv-1"
        messages={[msg('a', 'one')]}
        onClose={noop}
        onSend={noop}
      />,
    );
    // Let the open-jump's own follow-up frame/timeout (which re-pins to the
    // bottom while layout settles) run to completion first — otherwise this
    // test is racing the open, not exercising the reader's own scroll.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });
    // Reader scrolls up to read history — the scroll listener records it.
    scroller().scrollTop = 0;
    fireEvent.scroll(scroller());

    rerender(
      <ChatPanel
        open
        referenceId="conv-1"
        messages={[msg('a', 'one'), msg('b', 'incoming')]}
        onClose={noop}
        onSend={noop}
      />,
    );
    expect(scroller().scrollTop).toBe(0);
  });
});

describe('ChatPanel — attachment upload feedback (Task #31)', () => {
  const OBJECT_URL = 'blob:mock-local-bytes';
  let createObjectURL: jest.Mock;
  let revokeObjectURL: jest.Mock;

  beforeEach(() => {
    createObjectURL = jest.fn(() => OBJECT_URL);
    revokeObjectURL = jest.fn();
    // jsdom implements neither.
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeObjectURL;
  });

  function pngFile(name = 'photo.png') {
    return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
  }

  function fileInput(): HTMLInputElement {
    const el = document.querySelector('input[type="file"]');
    if (!el) throw new Error('file input not rendered');
    return el as HTMLInputElement;
  }

  it('shows the local bytes and an uploading state the moment a file is picked', async () => {
    let resolveUpload: (v: { url: string }) => void = () => {};
    const onUpload = jest.fn(
      () => new Promise<{ url: string }>((res) => { resolveUpload = res; }),
    );

    render(<ChatPanel open messages={[]} onClose={noop} onSend={noop} onUpload={onUpload} />);

    fireEvent.change(fileInput(), { target: { files: [pngFile()] } });

    // Accepted immediately — before the upload promise settles.
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const thumb = screen.getByAltText('Attachment ready to send') as HTMLImageElement;
    // The LOCAL bytes, never the (not yet known) remote URL.
    expect(thumb.getAttribute('src')).toBe(OBJECT_URL);
    expect(screen.getByLabelText('Uploading')).toBeInTheDocument();
    expect(screen.getByText('Uploading image…')).toBeInTheDocument();

    await act(async () => {
      resolveUpload({ url: 'https://cdn.example.com/photo.png' });
    });

    expect(screen.getByText('Ready to send')).toBeInTheDocument();
    expect(screen.queryByLabelText('Uploading')).not.toBeInTheDocument();
    // Still the local bytes in the composer — the remote URL is cold until
    // the message is actually sent.
    expect(
      (screen.getByAltText('Attachment ready to send') as HTMLImageElement).getAttribute('src'),
    ).toBe(OBJECT_URL);
  });

  it('surfaces a failed upload with a retry rather than failing silently', async () => {
    const onUpload = jest.fn(() => Promise.reject(new Error('network')));

    render(<ChatPanel open messages={[]} onClose={noop} onSend={noop} onUpload={onUpload} />);

    await act(async () => {
      fireEvent.change(fileInput(), { target: { files: [pngFile()] } });
    });

    expect(screen.getByLabelText('Retry upload')).toBeInTheDocument();
    expect(
      screen.getByText('Upload failed — tap an image to retry, or remove it'),
    ).toBeInTheDocument();
  });

  it('blocks send while an attachment is still uploading', () => {
    const onSend = jest.fn();
    const onUpload = jest.fn(() => new Promise<{ url: string }>(() => {}));

    render(<ChatPanel open messages={[]} onClose={noop} onSend={onSend} onUpload={onUpload} />);

    fireEvent.change(fileInput(), { target: { files: [pngFile()] } });
    fireEvent.change(screen.getByLabelText('Type your message'), {
      target: { value: 'here it is' },
    });
    fireEvent.click(screen.getByLabelText('Send message'));

    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('ChatPanel — paste (Task #31)', () => {
  const OBJECT_URL = 'blob:mock-pasted';

  beforeEach(() => {
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = jest.fn(() => OBJECT_URL);
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = jest.fn();
  });

  it('uploads an image pasted via clipboardData.items — the same path as the attach button', () => {
    const file = new File([new Uint8Array([9])], 'pasted.png', { type: 'image/png' });
    const onUpload = jest.fn(() => new Promise<{ url: string }>(() => {}));

    render(<ChatPanel open messages={[]} onClose={noop} onSend={noop} onUpload={onUpload} />);

    fireEvent.paste(screen.getByLabelText('Type your message'), {
      clipboardData: {
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
      },
    });

    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledWith(file);
    expect(screen.getByLabelText('Uploading')).toBeInTheDocument();
  });

  it('leaves an ordinary text paste completely alone', () => {
    const onUpload = jest.fn(() => new Promise<{ url: string }>(() => {}));

    render(<ChatPanel open messages={[]} onClose={noop} onSend={noop} onUpload={onUpload} />);

    fireEvent.paste(screen.getByLabelText('Type your message'), {
      clipboardData: {
        items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }],
      },
    });

    expect(onUpload).not.toHaveBeenCalled();
    // No scary "not supported" notice for a perfectly normal paste.
    expect(
      screen.queryByText("Couldn't read that paste — try the attach button instead."),
    ).not.toBeInTheDocument();
  });

  it('points at the attach button when the browser handed over nothing at all', () => {
    const onUpload = jest.fn(() => new Promise<{ url: string }>(() => {}));

    render(<ChatPanel open messages={[]} onClose={noop} onSend={noop} onUpload={onUpload} />);

    fireEvent.paste(screen.getByLabelText('Type your message'), {
      clipboardData: { items: [] },
    });

    expect(onUpload).not.toHaveBeenCalled();
    expect(
      screen.getByText("Couldn't read that paste — try the attach button instead."),
    ).toBeInTheDocument();
    // The fallback it points at genuinely exists.
    expect(screen.getByLabelText('Attach image')).toBeInTheDocument();
  });
});
