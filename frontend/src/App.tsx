import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { ReservationPage }       from '@/pages/ReservationPage';
import { CompletePage }          from '@/pages/CompletePage';
import { AdminLoginPage }        from '@/pages/admin/AdminLoginPage';
import { AdminReservationList }  from '@/pages/admin/AdminReservationList';
import { AdminReservationDetail } from '@/pages/admin/AdminReservationDetail';
import { RequireAdmin }          from '@/components/RequireAdmin';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* 一般ユーザー向け */}
          <Route path="/"          element={<ReservationPage />} />
          <Route path="/complete"  element={<CompletePage />} />

          {/* 管理者向け */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminReservationList />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/reservations/:id"
            element={
              <RequireAdmin>
                <AdminReservationDetail />
              </RequireAdmin>
            }
          />

          {/* catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
