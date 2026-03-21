import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  children: React.ReactNode;
}

/**
 * 未認証ユーザーを /admin/login にリダイレクトするガード。
 * ローディング中はスピナーを表示する。
 */
export function RequireAdmin({ children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-gray-500">読み込み中...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
