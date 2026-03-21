import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

const provider = new GoogleAuthProvider();

export function AdminLoginPage() {
  const { user, loading } = useAuth();
  const navigate          = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy,  setBusy]  = useState(false);

  // 既にログイン済みなら管理者ページへ
  if (!loading && user) {
    return <Navigate to="/admin" replace />;
  }

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, provider);
      navigate('/admin');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '不明なエラー';
      // 管理者権限のないユーザーは API 側で弾かれるが、
      // ここでは単純にポップアップエラーのみ表示
      setError(msg);
      // 念のためサインアウト
      await signOut(auth).catch(() => null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="card max-w-sm w-full space-y-6 text-center">
        <h1 className="text-xl font-bold text-gray-900">管理者ログイン</h1>
        <p className="text-sm text-gray-500">
          管理者アカウントの Google アカウントでログインしてください。
        </p>

        {error && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <button
          type="button"
          disabled={busy || loading}
          onClick={handleLogin}
          className="btn-primary w-full"
        >
          {busy ? 'ログイン中…' : 'Google でログイン'}
        </button>
      </div>
    </div>
  );
}
