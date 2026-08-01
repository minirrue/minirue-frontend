/**
 * 2026-08-01, reported as: "I created an account and nothing on the frontend
 * said anything when I tapped Create — however I moved to the network tab and
 * it says password is not strong enough."
 *
 * The API's 422 body carries `message` as an ARRAY (class-validator), the
 * `ApiError` type claimed it was a `string`, and the sign-up page's error
 * handler called `.trim()` on it. That threw INSIDE the catch block, so
 * `setApiError` never ran: the button stopped spinning and the shopper was
 * told nothing at all, while a perfectly clear explanation sat in the network
 * tab.
 *
 * A page that shows nothing is worse than one that shows a clumsy message.
 * These pin the contract that makes "nothing" impossible.
 */
import { formatApiError } from '@/lib/api/client';

describe('formatApiError', () => {
  it('reads the array shape a 422 actually arrives in', () => {
    expect(
      formatApiError({ status: 422, message: ['password is not strong enough'] }, 'fallback'),
    ).toBe('password is not strong enough');
  });

  it('joins several validation messages into one sentence', () => {
    expect(
      formatApiError({ status: 422, message: ['too short', 'no digits'] }, 'fallback'),
    ).toBe('too short. no digits');
  });

  it("reads class-validator's {field, issue} objects", () => {
    expect(
      formatApiError(
        { status: 422, message: [{ field: 'phone', issue: 'must be international format' }] },
        'fallback',
      ),
    ).toBe('phone: must be international format');
  });

  it('passes a plain string through', () => {
    expect(formatApiError({ status: 409, message: 'That email is taken' }, 'fallback')).toBe(
      'That email is taken',
    );
  });

  it('drops a bare HTTP reason phrase, which tells a shopper nothing', () => {
    expect(formatApiError({ status: 422, message: 'Unprocessable Entity' }, 'fallback')).toBe(
      'fallback',
    );
  });

  /**
   * The property that actually matters: whatever comes in, something readable
   * comes out and nothing is thrown. Every case below crashed or rendered
   * "[object Object]" at some point in this codebase's history.
   */
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string instead of an error', 'boom'],
    ['no message at all', { status: 500 }],
    ['an empty message', { status: 500, message: '' }],
    ['an empty array', { status: 422, message: [] }],
    ['an array of nulls', { status: 422, message: [null, undefined] }],
    ['a nested object', { status: 422, message: { nested: { deeply: true } } }],
    ['a number', { status: 422, message: 42 }],
    ['a getter that throws', {
      status: 422,
      get message(): string {
        throw new Error('hostile');
      },
    }],
  ])('never throws and never returns blank: %s', (_label, input) => {
    const result = formatApiError(input, 'fallback');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
