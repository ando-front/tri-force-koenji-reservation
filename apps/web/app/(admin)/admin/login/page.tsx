'use client';

import { createBrowserClient } from '@supabase/ssr';

export default function AdminLoginPage() {
  async function signIn() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin` },
    });
  }

  return (
    <main>
      <h1>管理者ログイン</h1>
      <div className="card">
        <p>
          Google アカウントでログインしてください。トークンはブラウザの JS から触れない HttpOnly
          Cookie に保存されます（設計書 7 章）。
        </p>
        <button className="btn" type="button" onClick={signIn}>
          Google でログイン
        </button>
      </div>
    </main>
  );
}
