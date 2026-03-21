import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/auth-page-session';

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const auth = await getSessionFromCookies();
  if (!auth.success || !auth.user) {
    redirect('/auth/login');
  }
  return <>{children}</>;
}
