import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/auth-page-session';
import { requireAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getSessionFromCookies();
  if (!auth.success || !auth.user) {
    redirect('/auth/login');
  }
  const admin = await requireAdmin(auth.user);
  if (!admin.success) {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
