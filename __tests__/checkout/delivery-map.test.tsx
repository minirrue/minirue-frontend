import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeliveryMap from '@/components/checkout/DeliveryMap';

let center = { lat: 30.0444, lng: 31.2357 };
const jumpTo = jest.fn(({ center: next }: { center: [number, number] }) => { center = { lng: next[0], lat: next[1] }; });

jest.mock('maplibre-gl', () => ({
  setWorkerUrl: jest.fn(),
  Map: class {
      constructor(options: { center: [number, number] }) { center = { lng: options.center[0], lat: options.center[1] }; }
      addControl() {}
      on(event: string, callback: () => void) { if (event === 'load') Promise.resolve().then(callback); }
      getCenter() { return center; }
      setCenter(next: [number, number]) { center = { lng: next[0], lat: next[1] }; }
      jumpTo = jumpTo;
      remove() {}
  },
  NavigationControl: class {},
  AttributionControl: class {},
}), { virtual: true });

describe('DeliveryMap', () => {
  beforeEach(() => { center = { lat: 30.0444, lng: 31.2357 }; jest.clearAllMocks(); });

  it('recenters from high-accuracy geolocation but waits for explicit confirmation', async () => {
    const onChange = jest.fn();
    const onUrl = jest.fn();
    const getCurrentPosition = jest.fn((success: PositionCallback) => success({ coords: { latitude: 30.0131, longitude: 31.2089 } } as GeolocationPosition));
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
    const user = userEvent.setup();
    render(<DeliveryMap pin={null} onChange={onChange} onConfirmedMapsUrlChange={onUrl} />);
    await user.click(await screen.findByRole('button', { name: /use my location/i }));
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 });
    expect(jumpTo).toHaveBeenCalledWith({ center: [31.2089, 30.0131], zoom: 18 });
    expect(onChange).toHaveBeenCalledWith(null);
    await user.click(screen.getByRole('button', { name: /confirm drop-off location/i }));
    expect(onChange).toHaveBeenLastCalledWith({ lat: 30.0131, lng: 31.2089 });
    expect(onUrl).toHaveBeenCalledWith('https://www.google.com/maps?q=30.013100,31.208900');
    expect(screen.getByText(/location confirmed/i)).toBeInTheDocument();
    expect(screen.getByTestId('delivery-map-lock')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /adjust location/i }));
    expect(screen.queryByTestId('delivery-map-lock')).not.toBeInTheDocument();
  });

  it.each([[1, /permission was denied/i], [2, /location is unavailable/i], [3, /timed out/i]])('shows a recoverable geolocation error for code %s', async (code, expected) => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_success: PositionCallback, failure: PositionErrorCallback) => failure({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError) } });
    render(<DeliveryMap pin={null} onChange={jest.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: /use my location/i }));
    await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
  });
});
