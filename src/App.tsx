import { useState, useEffect, useRef, useCallback, ReactNode, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { KillChainProvider } from './contexts/KillChainContext';
import { InitialSetup } from './components/InitialSetup';
import { Login } from './components/Login';
import { AppLayout } from './components/layout/AppLayout';
import { LockScreen } from './components/LockScreen';
import { api } from './lib/api';
import { useTranslation } from "react-i18next";
import { AnimatePresence } from 'framer-motion';
import { AnimatedPage } from './components/common/AnimatedPage';
import { Server, Loader2 } from 'lucide-react'; // Added icons for waiting screen

// Lazy-loaded pages for code-splitting (reduces initial bundle)
const AdminPanel = lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const UserProfile = lazy(() => import('./components/UserProfile').then(m => ({ default: m.UserProfile })));
const MyTasks = lazy(() => import('./components/MyTasks').then(m => ({ default: m.MyTasks })));
const CasesList = lazy(() => import('./components/CasesList').then(m => ({ default: m.CasesList })));
const CaseDetails = lazy(() => import('./components/CaseDetails').then(m => ({ default: m.CaseDetails })));
const CreateCase = lazy(() => import('./components/CreateCase').then(m => ({ default: m.CreateCase })));
const AlertsList = lazy(() => import('./components/AlertsList').then(m => ({ default: m.AlertsList })));
const About = lazy(() => import('./components/About').then(m => ({ default: m.About })));
const ApiDocs = lazy(() => import('./components/ApiDocs').then(m => ({ default: m.ApiDocs })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const PrintView = lazy(() => import('./components/reporting/PrintView').then(m => ({ default: m.PrintView })));

const ROUTE_STORAGE_KEY = 'oris_last_path';

function RouteRestorer({ children }: { children: ReactNode }) {

  const location = useLocation();
  const navigate = useNavigate();
  const hasRestored = useRef(false);

  useEffect(() => {
    if (!hasRestored.current) {
      hasRestored.current = true;
      const saved = sessionStorage.getItem(ROUTE_STORAGE_KEY);
      if (saved && saved !== '/' && location.pathname === '/') {
        navigate(saved, { replace: true });
      }
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(ROUTE_STORAGE_KEY, location.pathname + location.search);
  }, [location.pathname, location.search]);

  return <>{children}</>;
}

function CaseDetailsRoute() {

  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  if (!caseId) return <Navigate to="/" />;

  return <CaseDetails caseId={caseId} onBack={() => navigate('/')} />;
}

function PageWrapper({ children }: { children: React.ReactNode }) {

  return (
    <AnimatedPage className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-4 sm:py-6 lg:py-8">
      {children}
    </AnimatedPage>
  );
}

function AlertsListRoute() {

  const navigate = useNavigate();
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <PageWrapper>
      <AlertsList
        key={refreshKey}
        onSelectAlert={(alertId) => navigate(`/alerts/${alertId}`)}
        onCreateAlert={() => setShowCreateAlert(true)}
      />
      {showCreateAlert && (
        <CreateCase
          type="alert"
          onClose={() => setShowCreateAlert(false)}
          onSuccess={(newId) => {
            setShowCreateAlert(false);
            if (newId) {
              navigate(`/alerts/${newId}`);
            } else {
              setRefreshKey(k => k + 1);
              navigate('/alerts');
            }
          }}
        />
      )}
    </PageWrapper>
  );
}

function AlertDetailsRoute() {

  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  if (!caseId) return <Navigate to="/alerts" />;

  return <CaseDetails caseId={caseId} onBack={() => navigate('/alerts')} />;
}

function CasesListRoute() {

  const navigate = useNavigate();
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <PageWrapper>
      <CasesList
        key={refreshKey}
        onSelectCase={(caseId) => navigate(`/cases/${caseId}`)}
        onCreateCase={() => setShowCreateCase(true)}
      />
      {showCreateCase && (
        <CreateCase
          onClose={() => setShowCreateCase(false)}
          onSuccess={(newId) => {
            setShowCreateCase(false);
            if (newId) {
              navigate(`/cases/${newId}`);
            } else {
              setRefreshKey(k => k + 1);
              navigate('/');
            }
          }}
        />
      )}
    </PageWrapper>
  );
}

function useInactivityLock() {
  const { user, isLocked, setLocked } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lockEnabled, setLockEnabled] = useState(false);
  const timeoutRef = useRef(5);

  // Fetch config on mount and periodically to pick up admin changes
  const fetchLockConfig = useCallback(() => {
    if (!user) return;
    api.get('/config').then((data: Record<string, string>) => {
      const enabled = data?.session_lock_enabled === 'true';
      const timeout = parseInt(data?.session_lock_timeout || '5', 10);
      timeoutRef.current = timeout > 0 ? timeout : 5;
      setLockEnabled(enabled);
      // If admin disabled session lock, unlock immediately
      if (!enabled && isLocked) {
        setLocked(false);
      }
    }).catch(() => {});
  }, [user, isLocked, setLocked]);

  useEffect(() => {
    fetchLockConfig();
    const interval = setInterval(fetchLockConfig, 30000);
    return () => clearInterval(interval);
  }, [fetchLockConfig]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLocked(true);
    }, timeoutRef.current * 60 * 1000);
  }, [setLocked]);

  // Attach/detach activity listeners when lock is enabled
  useEffect(() => {
    if (!user || !lockEnabled || isLocked) return;

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handler = () => resetTimer();

    events.forEach(ev => window.addEventListener(ev, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(ev => window.removeEventListener(ev, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, lockEnabled, isLocked, resetTimer]);
}

function AppContent() {
  const { t } = useTranslation();
  const location = useLocation();

  const { user, profile, loading, isLocked, hasRole } = useAuth();
  const [initComplete, setInitComplete] = useState<boolean | null>(null);
  const [checkingInit, setCheckingInit] = useState(true);
  const [systemError, setSystemError] = useState<{ message: string, detail: string } | null>(null);

  useInactivityLock();

  // Subscribe to push notifications when user is authenticated
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          // Already subscribed, send to server in case it's a new session
          await api.post('/notifications/subscribe', existing.toJSON());
          return;
        }

        const res = await api.get('/notifications/vapid-public-key');
        if (!res?.publicKey) return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: res.publicKey,
        });
        await api.post('/notifications/subscribe', sub.toJSON());
      } catch (e) {
        console.warn('[Push] Subscription unavailable:', e instanceof Error ? e.message : e);
      }
    })();
  }, [user]);

  useEffect(() => {
    checkInitialization();
  }, []);

  const checkInitialization = async () => {
    try {
      const { isInitialized } = await api.get('/admin/setup-status');
      setInitComplete(isInitialized);
      setSystemError(null);
      setCheckingInit(false);
    } catch (err: any) {
      console.error('Erreur:', err);
      const msg = err.message || '';
      if (msg.includes('Failed to fetch')) {
        setSystemError({ message: "Système Injoignable (Docker API)", detail: "Le reverse proxy (Nginx) est injoignable ou l'application front-end a perdu sa connexion." });
        setTimeout(checkInitialization, 5000);
      } else if (msg.includes('Bad Gateway') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
        setSystemError({ message: "Serveur Backend en démarrage", detail: "Le serveur de l'application (oris-backend) est en cours de lancement. Veuillez patienter..." });
        setTimeout(checkInitialization, 5000);
      } else if (msg.includes('Internal Server Error') || msg.includes('500') || msg.toLowerCase().includes('db') || msg.toLowerCase().includes('arangodb') || msg.toLowerCase().includes('connect')) {
        setSystemError({ message: "Base de données non prête", detail: "La base de données (oris-arangodb) est en cours d'initialisation ou refuse la connexion. Veuillez patienter..." });
        setTimeout(checkInitialization, 5000);
      } else {
        // Assume default status if unhandled error
        setInitComplete(false);
        setSystemError(null);
        setCheckingInit(false);
      }
    }
  };

  const handleInitComplete = () => {
    setInitComplete(true);
  };

  if (systemError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Server className="w-16 h-16 text-red-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">{systemError.message}</h2>
        <p className="text-gray-500 dark:text-slate-400 text-center max-w-md">{systemError.detail}</p>
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-400">
           <Loader2 className="w-4 h-4 animate-spin" />
           Tentative de reconnexion statique...
        </div>
      </div>
    );
  }

  if (checkingInit || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-gray-500 dark:text-slate-400">{t('common.loading')}</div>
      </div>
    );
  }

  if (!initComplete) {
    return <InitialSetup onComplete={handleInitComplete} />;
  }

  if (!user || !profile) {
    return <Login />;
  }

  const isAdmin = hasRole('admin');

  return (
    <>
      {isLocked && <LockScreen />}
      <KillChainProvider>
        <AppLayout>
            <RouteRestorer>
              <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                  <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
                  <Route path="/cases" element={<CasesListRoute />} />
                  <Route path="/cases/:caseId" element={<AnimatedPage><CaseDetailsRoute /></AnimatedPage>} />
                  <Route path="/alerts" element={<AlertsListRoute />} />
                  <Route path="/alerts/:caseId" element={<AnimatedPage><AlertDetailsRoute /></AnimatedPage>} />
                  <Route path="/tasks" element={<PageWrapper><MyTasks /></PageWrapper>} />
                  <Route path="/profile" element={<PageWrapper><UserProfile /></PageWrapper>} />
                  {isAdmin && (
                    <Route path="/admin" element={<PageWrapper><AdminPanel /></PageWrapper>} />
                  )}
                  <Route path="/about" element={<PageWrapper><About /></PageWrapper>} />
                  <Route path="/api-docs" element={<PageWrapper><ApiDocs /></PageWrapper>} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </AnimatePresence>
            </RouteRestorer>
        </AppLayout>
      </KillChainProvider>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            {/* The Print Layout shouldn't have headers, sidebar menus or global AppLayout */}
            <Route path="/print/case/:caseId" element={
              <Suspense fallback={<div>Loading PDF view...</div>}>
                <PrintView />
              </Suspense>
            } />
            <Route path="/*" element={<AppContent />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
