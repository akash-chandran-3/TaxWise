import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import TaxPage from './pages/TaxPage.jsx';
import ExpensesPage from './pages/ExpensesPage.jsx';

// Sends logged-out visitors to the login page.
function RequireAuth({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function NavBar() {
  const { token, user, logout } = useAuth();
  return (
    <header className="navbar">
      <Link to="/" className="brand">TaxWise</Link>
      {token && (
        <nav>
          <NavLink to="/tax">Tax</NavLink>
          <NavLink to="/expenses">Expenses</NavLink>
          <span className="muted">{user?.name}</span>
          <button className="link-button" onClick={logout}>Log out</button>
        </nav>
      )}
    </header>
  );
}

export default function App() {
  return (
    <>
      <NavBar />
      <main className="container">
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/tax" element={<RequireAuth><TaxPage /></RequireAuth>} />
          <Route path="/expenses" element={<RequireAuth><ExpensesPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/tax" replace />} />
        </Routes>
      </main>
    </>
  );
}
