import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { adminListFacilities } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

function isAuthLikeError(error: unknown): error is Error & { code?: string; status?: number } {
  return error instanceof Error;
}

function mapLoginError(error: unknown): string {
  if (!isAuthLikeError(error)) {
    return 'ログインに失敗しました。しばらくしてから再度お試しください。';
  }

  switch (error.code) {
    case 'auth/configuration-not-found':
      return 'Firebase Authentication の Google ログイン設定が未構成です。Authentication > Sign-in method で Google を有効化してください。';
    case 'auth/popup-closed-by-user':
      return 'ログイン用ポップアップが閉じられました。';
    case 'auth/popup-blocked':
    case 'auth/cancelled-popup-request':
      return 'ポップアップでログインできなかったため、画面遷移ログインへ切り替えます。';
    case 'auth/unauthorized-domain':
      return 'このドメインは Firebase Authentication の許可ドメインに登録されていません。';
    case 'auth/operation-not-supported-in-this-environment':
      return 'このブラウザ環境ではポップアップログインを利用できません。';
    default:
      if (error.status === 403) return 'この Google アカウントには管理者権限がありません。';
      return error.message || 'ログインに失敗しました。';
  }
}

export function AdminLoginPage() {
  const { user, loading } = useAuth();
  const navigate          = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy,  setBusy]  = useState(false);

  const verifyAdminAndNavigate = useCallback(async () => {
    await adminListFacilities();
    navigate('/admin');
  }, [navigate]);

  useEffect(() => {
    let active = true;

    async function restoreRedirectLogin() {
      try {
        const result = await getRedirectResult(auth);
        if (!active || !result) return;

        setBusy(true);
        setError(null);
        await verifyAdminAndNavigate();
      } catch (e) {
        if (!active) return;
        setError(mapLoginError(e));
        await signOut(auth).catch(() => null);
      } finally {
        if (active) setBusy(false);
      }
    }

    void restoreRedirectLogin();

    return () => {
      active = false;
    };
  }, [verifyAdminAndNavigate]);

  // 既にログイン済みなら管理者ページへ
  if (!loading && user) {
    return <Navigate to="/admin" replace />;
  }

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, provider);
      await verifyAdminAndNavigate();
    } catch (e) {
      if (isAuthLikeError(e) && (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request')) {
        setError(mapLoginError(e));
        await signInWithRedirect(auth, provider);
        return;
      }

      setError(mapLoginError(e));
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
