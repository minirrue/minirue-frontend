import GuestOnly from '../GuestOnly';

/** Creating an account makes no sense while signed in — see GuestOnly. */
export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <GuestOnly>{children}</GuestOnly>;
}
