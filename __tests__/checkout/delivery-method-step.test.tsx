import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeliveryMethodStep from '@/components/checkout/DeliveryMethodStep';
import { DEFAULT_DELIVERY_SETTINGS, type DeliverySettings } from '@/lib/checkout/delivery';

/**
 * The delivery-method radiogroup (frontend#163) — Standard / Same-day.
 *
 * `DeliveryMap` is mocked out: it is a Leaflet integration with no logic of
 * its own to unit test, and importing real Leaflet into jsdom here would
 * test the library, not this component. `next/dynamic` resolves the mock
 * synchronously in this environment.
 */
jest.mock('@/components/checkout/DeliveryMap', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (pin: { lat: number; lng: number }) => void }) => (
    <button type="button" onClick={() => onChange({ lat: 30.05, lng: 31.24 })}>
      mock-map-drop-pin
    </button>
  ),
}));

const SETTINGS: DeliverySettings = {
  ...DEFAULT_DELIVERY_SETTINGS,
  sameDay: {
    ...DEFAULT_DELIVERY_SETTINGS.sameDay,
    enabled: true,
    governorates: ['CAIRO'],
  },
};

describe('DeliveryMethodStep', () => {
  it('hides the Same-day card for an ineligible governorate and notes Standard-only', () => {
    render(
      <DeliveryMethodStep
        settings={SETTINGS}
        available={{ standard: true, sameDay: false, standardOnly: true }}
        method="STANDARD"
        onMethodChange={jest.fn()}
        standardFeeLabel="100.00 EGP"
        pin={null}
        onPinChange={jest.fn()}
        pastedMapsUrl=""
        onPastedMapsUrlChange={jest.fn()}
      />,
    );

    expect(screen.getByText('Standard delivery')).toBeInTheDocument();
    expect(screen.queryByText('Same-day delivery')).not.toBeInTheDocument();
    expect(
      screen.getByText(/only standard delivery is available for this governorate/i),
    ).toBeInTheDocument();
  });

  it('offers both cards, with the window label and fee copy, when Same-day is eligible', () => {
    render(
      <DeliveryMethodStep
        settings={SETTINGS}
        available={{ standard: true, sameDay: true, standardOnly: false }}
        method={null}
        onMethodChange={jest.fn()}
        standardFeeLabel="100.00 EGP"
        pin={null}
        onPinChange={jest.fn()}
        pastedMapsUrl=""
        onPastedMapsUrlChange={jest.fn()}
        now={new Date('2026-09-15T10:00:00Z')}
      />,
    );

    expect(screen.getByText('Standard delivery')).toBeInTheDocument();
    expect(screen.getByText('Same-day delivery')).toBeInTheDocument();
    // The disclaimer and fee copy share one <span> with the window label,
    // separated by <br/> — text nodes, not their own elements — so this
    // checks the rendered text directly rather than via getByText.
    expect(document.body.textContent).toContain(SETTINGS.sameDay.disclaimer);
    expect(document.body.textContent).toMatch(
      /fee confirmed after your order, usually egp 90–160, paid in cash on delivery/i,
    );
    // Neither radio is pre-checked: the owner's rule is no default that skips
    // the choice when more than one method is offered.
    expect(screen.queryByText(/only standard delivery is available/i)).not.toBeInTheDocument();
  });

  it('calls onMethodChange for each radio and shows the map + link input only once Same-day is picked', async () => {
    const user = userEvent.setup();
    const onMethodChange = jest.fn();
    const { rerender } = render(
      <DeliveryMethodStep
        settings={SETTINGS}
        available={{ standard: true, sameDay: true, standardOnly: false }}
        method={null}
        onMethodChange={onMethodChange}
        standardFeeLabel="100.00 EGP"
        pin={null}
        onPinChange={jest.fn()}
        pastedMapsUrl=""
        onPastedMapsUrlChange={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText(/paste a google maps link/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /same-day delivery/i }));
    expect(onMethodChange).toHaveBeenCalledWith('SAME_DAY');

    rerender(
      <DeliveryMethodStep
        settings={SETTINGS}
        available={{ standard: true, sameDay: true, standardOnly: false }}
        method="SAME_DAY"
        onMethodChange={onMethodChange}
        standardFeeLabel="100.00 EGP"
        pin={null}
        onPinChange={jest.fn()}
        pastedMapsUrl=""
        onPastedMapsUrlChange={jest.fn()}
      />,
    );

    expect(screen.getByLabelText(/paste a google maps link/i)).toBeInTheDocument();
  });

  it('shows the location validation message on the Same-day card when the caller passes one', () => {
    render(
      <DeliveryMethodStep
        settings={SETTINGS}
        available={{ standard: true, sameDay: true, standardOnly: false }}
        method="SAME_DAY"
        onMethodChange={jest.fn()}
        standardFeeLabel="100.00 EGP"
        pin={null}
        onPinChange={jest.fn()}
        pastedMapsUrl=""
        onPastedMapsUrlChange={jest.fn()}
        locationError="Add your delivery location."
      />,
    );

    expect(screen.getByText('Add your delivery location.')).toBeInTheDocument();
  });
});
