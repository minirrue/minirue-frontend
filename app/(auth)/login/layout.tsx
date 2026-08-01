import GuestOnly from '../GuestOnly';

/** Signing in again over a live session mints a second one — see GuestOnly. */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <GuestOnly>{children}</GuestOnly>;
}
