import './portal.css';
import './mobile-portal.css';
import { canReview, canDevelop, isDemoAccount } from './constants/demoAccounts';
import React, { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { storageService } from './services/storage';
import { authService } from './services/authService';
import { productService } from './services/productService';
import { metricsService } from './services/metricsService';
import { TeacherUser, ScientificProduct, UserNotification, ProductStatus } from './types';

// Componentes de Layout
import { Header, type ActiveTab } from './components/layout/Header';
import { ScreenScrollStart, useScreenScrollStart } from './components/layout/ScreenScrollStart';

// Componentes de Vistas
import { AccessScreen } from './components/auth/AccessScreen';
import { LoginDialog } from './components/auth/LoginDialog';
import { InstitutionalLanding } from './components/institutional/InstitutionalLanding';
import { PortalEntryLoading } from './components/institutional/PortalEntryLoading';
import { getSchoolByCode, getSchoolDisplayCode, type SchoolConfig } from './constants/schools';

const RoleManagementView = lazy(() => import('./components/roles/RoleManagementView').then((module) => ({ default: module.RoleManagementView })));
const ProfileSettingsView = lazy(() => import('./components/profile/ProfileSettingsView').then((module) => ({ default: module.ProfileSettingsView })));
const StudentProfileSettingsView = lazy(() => import('./components/profile/StudentProfileSettingsView').then((module) => ({ default: module.StudentProfileSettingsView })));
const StudentCollaborationsView = lazy(() => import('./components/profile/StudentCollaborationsView').then((module) => ({ default: module.StudentCollaborationsView })));
const loadInstitutionalBanner = () => import('./components/dashboard/InstitutionalBanner').then((module) => ({ default: module.InstitutionalBanner }));
const loadFeaturedPublicationCarousel = () => import('./components/dashboard/FeaturedPublicationCarousel').then((module) => ({ default: module.FeaturedPublicationCarousel }));
const loadMetricCards = () => import('./components/dashboard/MetricCards').then((module) => ({ default: module.MetricCards }));
const loadResearchDashboard = () => import('./components/dashboard/ResearchDashboard').then((module) => ({ default: module.ResearchDashboard }));
const loadTeacherMetricsTable = () => import('./components/dashboard/TeacherMetricsTable').then((module) => ({ default: module.TeacherMetricsTable }));
const InstitutionalBanner = lazy(loadInstitutionalBanner);
const FeaturedPublicationCarousel = lazy(loadFeaturedPublicationCarousel);
const MetricCards = lazy(loadMetricCards);
const ResearchDashboard = lazy(loadResearchDashboard);
const TeacherMetricsTable = lazy(loadTeacherMetricsTable);
const CatalogView = lazy(() => import('./components/catalog/CatalogView').then((module) => ({ default: module.CatalogView })));
const DirectoryView = lazy(() => import('./components/directory/DirectoryView').then((module) => ({ default: module.DirectoryView })));
const TraceabilityView = lazy(() => import('./components/traceability/TraceabilityView').then((module) => ({ default: module.TraceabilityView })));
const RegisterProductModal = lazy(() => import('./components/register/RegisterProductModal').then((module) => ({ default: module.RegisterProductModal })));
const ReviewerConsoleModal = lazy(() => import('./components/reviewer/ReviewerConsoleModal').then((module) => ({ default: module.ReviewerConsoleModal })));

function PortalViewLoading() {
  return <div className="portal-view-loading" role="status" aria-live="polite"><span aria-hidden="true" />Cargando el contenido de la escuela…</div>;
}

function PortalEntryFallback() {
  return window.matchMedia('(max-width: 760px)').matches ? <PortalEntryLoading /> : <PortalViewLoading />;
}

export function preloadSchoolEntry() {
  return Promise.all([
    loadInstitutionalBanner(),
    loadFeaturedPublicationCarousel(),
    loadMetricCards(),
    loadResearchDashboard(),
    loadTeacherMetricsTable(),
  ]).then(() => undefined);
}

export default function App({ initialSchool, onChangeSchool }: { initialSchool: SchoolConfig; onChangeSchool: () => void }) {
  // Estado de autenticación y sesión
  const [currentUser, setCurrentUser] = useState<TeacherUser | null>(() => authService.getCurrentUser());
  const [teachers, setTeachers] = useState<TeacherUser[]>(() => storageService.getTeachers());
  const [products, setProducts] = useState<ScientificProduct[]>(() => storageService.getProducts());
  const [selectedSchool, setSelectedSchool] = useState<SchoolConfig | null>(() => getSchoolByCode(authService.getCurrentUser()?.school) || initialSchool);

  // Navegación
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Control de portada de acceso inicial (Boceto 03)
  // Se presenta como entrada visual solicitada; al presionar "Explorar como visitante" o "Iniciar sesión" se pasa al portal
  const [showAccessScreen, setShowAccessScreen] = useState<boolean>(() => {
    // Si ya existe sesión previa o el usuario ya interactuó, puede iniciar en dashboard
    return !authService.getCurrentUser();
  });
  const screenKey = `${selectedSchool?.code || 'welcome'}:${currentUser?.id || 'guest'}:${showAccessScreen ? 'access' : activeTab}`;
  useScreenScrollStart(screenKey);

  // Modales
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterProductOpen, setIsRegisterProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ScientificProduct | null>(null);
  const [registerType, setRegisterType] = useState<'publicacion'|'proyecto'>('publicacion');
  const [registerTypeLocked, setRegisterTypeLocked] = useState(false);
  const [notice, setNotice] = useState('');
  const [isReviewerConsoleOpen, setIsReviewerConsoleOpen] = useState(false);

  // Filtro inicial para navegar desde el directorio al catálogo
  const [catalogTeacherFilter, setCatalogTeacherFilter] = useState<string>('todos');
  const [directorySelectedTeacherId, setDirectorySelectedTeacherId] = useState<string>('doc-001');

  const schoolTeachers = useMemo(() => selectedSchool ? teachers.filter(teacher => teacher.school === selectedSchool.code
    && (selectedSchool.code !== 'ECMC' || !isDemoAccount(teacher))) : [], [teachers, selectedSchool]);
  const schoolProducts = useMemo(() => selectedSchool ? products.filter(product => product.school === selectedSchool.code) : [], [products, selectedSchool]);

  // Each portal screen is an ordinary browser history entry.
  const navigation = {activeTab, showAccessScreen, selectedSchoolCode: selectedSchool?.code || null, isRegisterProductOpen,
    editingProductId: editingProduct?.id ?? null, isReviewerConsoleOpen, registerType, registerTypeLocked, catalogTeacherFilter, directorySelectedTeacherId};
  const navigationKey = JSON.stringify(navigation);
  const lastNavigation = useRef<string | null>(null);
  useEffect(() => {
    if (lastNavigation.current === navigationKey) return;
    const state = {...window.history.state, redPapers: navigation};
    if (lastNavigation.current === null) window.history.replaceState(state, '');
    else window.history.pushState(state, '');
    lastNavigation.current = navigationKey;
  }, [navigationKey]);
  useEffect(() => {
    const onBack = (event: PopStateEvent) => {
      setIsLoginOpen(false);
      const next = event.state?.redPapers;
      if (!next) return;
      const historyUser = authService.getCurrentUser();
      if ((next.activeTab==='reviewer'&&!canReview(historyUser)) || (next.activeTab==='traceability'&&!canDevelop(historyUser)) || (next.activeTab==='roles'&&!canDevelop(historyUser)) || (next.activeTab==='settings'&&historyUser?.role!=='teacher'&&historyUser?.role!=='student')) next.activeTab='dashboard';
      if(historyUser?.role==='reviewer_demo'){next.isRegisterProductOpen=false;if(next.activeTab==='mine')next.activeTab='dashboard';}
      const signedIn = !!historyUser;
      if (!signedIn) {
        next.isRegisterProductOpen = false;
        if (next.activeTab === 'mine') next.showAccessScreen = true;
      }
      lastNavigation.current = JSON.stringify(next);
      setActiveTab(next.activeTab);
      setShowAccessScreen(next.showAccessScreen);
      setSelectedSchool(getSchoolByCode(next.selectedSchoolCode) || null);
      setIsRegisterProductOpen(next.isRegisterProductOpen);
      setEditingProduct(next.editingProductId ? storageService.getProducts().find(product => product.id === next.editingProductId) || null : null);
      setIsReviewerConsoleOpen(next.isReviewerConsoleOpen);
      setRegisterType(next.registerType);
      setRegisterTypeLocked(next.registerTypeLocked);
      setCatalogTeacherFilter(next.catalogTeacherFilter);
      setDirectorySelectedTeacherId(next.directorySelectedTeacherId);
      setNotice('');
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  useEffect(()=>{if((activeTab==='mine'&&currentUser?.role==='reviewer_demo')||(activeTab==='reviewer'&&!canReview(currentUser))||(activeTab==='traceability'&&!canDevelop(currentUser))||(activeTab==='roles'&&!canDevelop(currentUser))||(activeTab==='settings'&&currentUser?.role!=='teacher'&&currentUser?.role!=='student')) setActiveTab('dashboard');},[activeTab,currentUser]);

  // Notificaciones del usuario actual
  const userNotifications = useMemo(() => {
    if (!currentUser) return [];
    return productService.getUserNotifications(currentUser.id);
  }, [currentUser, products]);

  // Métricas agregadas de la escuela
  const schoolMetrics = useMemo(() => {
    return metricsService.calculateSchoolMetrics(schoolProducts);
  }, [schoolProducts]);

  // Métricas por docente para la tabla del dashboard
  const teacherMetricsList = useMemo(() => {
    return schoolTeachers.map((t) => metricsService.calculateTeacherMetrics(t, schoolProducts));
  }, [schoolTeachers, schoolProducts]);

  // Datos para el gráfico temporal de evolución
  const temporalData = useMemo(() => {
    return metricsService.getTemporalEvolutionData(schoolProducts);
  }, [schoolProducts]);

  // Manejo de inicio de sesión
  const handleLogin = (email: string, pass: string) => {
    const res = authService.login(email, pass, selectedSchool?.code);
    if (res.success && res.user) {
      if (res.user.school !== selectedSchool?.code) {
        authService.logout();
        return { success: false, error: 'Esta cuenta pertenece a otra escuela. Seleccione la escuela asociada a su cuenta.' };
      }
      setCurrentUser(res.user);
      setTeachers(storageService.getTeachers());
      setIsLoginOpen(false);
      setShowAccessScreen(false);
      setActiveTab('dashboard');
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // Acceso directo como visitante (Sección 3 de requerimientos)
  const handleExploreAsGuest = () => {
    setShowAccessScreen(false);
    setActiveTab('dashboard');
  };

  const handleSchoolSelect = (school: NonNullable<typeof selectedSchool>) => {
    setIsLoginOpen(false);
    setSelectedSchool(school);
    setShowAccessScreen(true);
    setActiveTab('dashboard');
  };

  // Cierre de sesión (HU02)
  const handleLogout = () => {
    authService.logout();
    setIsLoginOpen(false);
    setCurrentUser(null);
    setSelectedSchool(null);
    setNotice('');
    // Volver al acceso y cerrar cualquier vista privada de la sesión anterior.
    setIsRegisterProductOpen(false);
    setEditingProduct(null);
    setIsReviewerConsoleOpen(false);
    setCatalogTeacherFilter('todos');
    setActiveTab('dashboard');
    setShowAccessScreen(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Cambio rápido del usuario activo
  const handleSwitchUser = (teacherId: string) => {
    const updated = authService.switchDemoUser(teacherId);
    if (updated) {
      setCurrentUser(updated);
    }
  };

  // Creación de producto (HU03)
  const handleProductSaved = (_savedProduct: ScientificProduct) => {
    setProducts(storageService.getProducts());
    setNotice(editingProduct
      ? 'Las correcciones se enviaron al Comité Científico. El producto quedó pendiente de verificación.'
      : 'Su registro se guardó correctamente. Puede consultarlo en Mis registros.');
  };

  // Actualización de estado desde el comité revisor (Sección 11)
  const handleUpdateProductStatus = (
    productId: string,
    newStatus: ProductStatus,
    reason?: string
  ) => {
    if (!canReview(authService.getCurrentUser())) return {success:false,error:'Su perfil no tiene acceso al Comité Científico.'};
    const result = productService.updateProductStatus(productId, newStatus, reason);
    if (result.success && result.product) {
      setProducts(storageService.getProducts());
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  // Marcar notificaciones como leídas (HU08)
  const handleMarkNotifRead = (id: string) => {
    productService.markNotificationAsRead(id);
    setProducts([...storageService.getProducts()]); // forzar refresco
  };

  const handleMarkAllNotifsRead = () => {
    if (currentUser) {
      productService.markAllNotificationsAsRead(currentUser.id);
      setProducts([...storageService.getProducts()]);
    }
  };

  // Restaurar datos semilla
  const handleResetData = () => {
    storageService.resetToSeed();
    setProducts(storageService.getProducts());
    setTeachers(storageService.getTeachers());
    alert('Se restauraron los datos iniciales de la ECMC.');
  };

  // Navegar al catálogo filtrado por un docente
  const handleViewTeacherProducts = (teacherId: string) => {
    setCatalogTeacherFilter(teacherId);
    setActiveTab('catalog');
  };

  // Navegar al perfil de un docente en el directorio
  const handleSelectTeacherInDirectory = (teacherId: string) => {
    setDirectorySelectedTeacherId(teacherId);
    setActiveTab('directory');
  };

  if (!selectedSchool) {
    return <InstitutionalLanding onSelect={handleSchoolSelect} replayIntroOnEntry />;
  }

  // Si se encuentra en la pantalla de acceso del boceto 03
  if (showAccessScreen) {
    return (
      <>
        <AccessScreen
          school={selectedSchool}
          schoolMetrics={schoolMetrics}
          teacherCount={schoolTeachers.length}
          onLogin={handleLogin}
          onExploreAsGuest={handleExploreAsGuest}
          onChangeSchool={onChangeSchool}
        />
      </>
    );
  }

  const teacherDashboard = currentUser?.role === 'teacher';
  const dashboardActions = <InstitutionalBanner
    showActions={!!currentUser}
    primary={teacherDashboard}
    onViewRecords={teacherDashboard ? () => {setCatalogTeacherFilter('todos'); setActiveTab('mine');} : undefined}
    onReview={currentUser?.role === 'reviewer_demo' ? () => setActiveTab('reviewer') : undefined}
    allowRegister={!!currentUser && (currentUser.role === 'teacher' || currentUser.role === 'developer')}
    onOpenRegister={(type) => {
      if (currentUser?.role === 'reviewer_demo' || currentUser?.role === 'student') return;
      setEditingProduct(null);
      setRegisterType(type);
      setRegisterTypeLocked(true);
      if (!currentUser) setIsLoginOpen(true);
      else setIsRegisterProductOpen(true);
    }}
    onBrowse={() => setActiveTab('catalog')}
  />;

  // Vista principal de SIMAPC
  return (
    <div className="portal-app min-h-screen font-sans" style={{ '--accent': `color-mix(in srgb, ${selectedSchool.accent} 46%, #252321)`, '--school-accent': selectedSchool.accent, '--school-ink': `color-mix(in srgb, ${selectedSchool.accent} 46%, #252321)` } as React.CSSProperties}>
      {/* 1. Encabezado Horizontal */}
      <Header
        school={selectedSchool}
        onChangeSchool={onChangeSchool}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'catalog') {
            setCatalogTeacherFilter('todos');
          }
        }}
        currentUser={currentUser}
        teachers={schoolTeachers}
        notifications={userNotifications}
        onLoginClick={() => setIsLoginOpen(true)}
        onLogoutClick={handleLogout}
        onSwitchUser={handleSwitchUser}
        onOpenRegisterModal={() => {
          if(currentUser?.role==='reviewer_demo'||currentUser?.role==='student') return;
          if (!currentUser) {
            // Si el visitante intenta registrar, le informamos que requiere inicio de sesión docente
            const proceed = confirm(
              `El registro de producción científica requiere iniciar sesión como docente de ${selectedSchool.shortName}. ¿Deseas ingresar a tu cuenta institucional?`
            );
            if (proceed) setIsLoginOpen(true);
          } else {
            setEditingProduct(null);
            setRegisterTypeLocked(false);
            setIsRegisterProductOpen(true);
          }
        }}
        onOpenReviewerConsole={() => {setActiveTab('reviewer'); window.scrollTo(0,0);}}
        onMarkNotificationAsRead={handleMarkNotifRead}
        onMarkAllNotificationsAsRead={handleMarkAllNotifsRead}
      />

      {/* 2. Contenedor de Contenido Principal */}
      <main id="main-content" tabIndex={-1} className={`portal-main ${activeTab === 'dashboard' && !currentUser ? 'portal-main-public-dashboard' : ''} ${activeTab === 'dashboard' && teacherDashboard ? 'portal-main-teacher-dashboard' : ''}`}>
        {notice && <div role="status" className="save-notice"><span>{notice}</span><button onClick={()=>{setNotice('');setActiveTab('mine');}}>{currentUser?.role==='student'?'Ver mis colaboraciones':'Ver mis registros'}</button><button onClick={()=>setNotice('')} aria-label="Cerrar confirmación">×</button></div>}
        <Suspense fallback={<PortalEntryFallback />}>
        <ScreenScrollStart screenKey={screenKey} />
        {/* Pestaña: Dashboard ECMC (HU09 y HU10) */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-home">
            {teacherDashboard && dashboardActions}
            {!currentUser && <FeaturedPublicationCarousel products={schoolProducts} researchLines={selectedSchool.researchLines}/>}
            <MetricCards metrics={schoolMetrics} school={selectedSchool} secondary={teacherDashboard}
              researchLinesAvailable={!schoolProducts.some(product => product.bibliographicSource)
                || schoolProducts.some(product => product.status === 'verificado' && !!product.researchLine)}/>
            {!teacherDashboard && dashboardActions}
            {currentUser && <FeaturedPublicationCarousel products={schoolProducts} researchLines={selectedSchool.researchLines}/>}

            {/* Tablero: evolución semestral, ranking y líneas de investigación */}
            <ResearchDashboard teachers={schoolTeachers} products={schoolProducts} temporalData={temporalData} school={selectedSchool} />

            {/* Directorio e Indicadores por Docente */}
            <TeacherMetricsTable
              teacherMetrics={teacherMetricsList}
              schoolCode={selectedSchool.code}
              onSelectTeacher={handleSelectTeacherInDirectory}
              onViewTeacherProducts={handleViewTeacherProducts}
            />
          </div>
        )}

        {/* Pestaña: Catálogo de Producción Científica (HU05, HU06, HU11) */}
        {activeTab==='mine'&&currentUser?.role==='student'&&<StudentCollaborationsView currentUser={currentUser} products={schoolProducts}/>}

        {(activeTab === 'catalog' || (activeTab === 'mine'&&currentUser?.role!=='student')) && (
          <CatalogView
            key={activeTab + catalogTeacherFilter}
            onlyMine={activeTab === 'mine'}
            allowRegister={!!currentUser && (currentUser.role==='teacher'||currentUser.role==='developer')}
            allProducts={schoolProducts}
            teachers={schoolTeachers}
            currentUserId={currentUser ? currentUser.id : null}
            initialTeacherFilter={catalogTeacherFilter}
            researchLines={selectedSchool.researchLines}
            schoolName={`${selectedSchool.name} (${getSchoolDisplayCode(selectedSchool.code)})`}
            onEditProduct={product => {
              setEditingProduct(product);
              setRegisterType(product.type);
              setRegisterTypeLocked(true);
              setIsRegisterProductOpen(true);
            }}
            onProjectUpdated={() => setProducts(storageService.getProducts())}
            onOpenRegister={() => {
              if(currentUser?.role==='reviewer_demo'||currentUser?.role==='student') return;
              if (!currentUser) setIsLoginOpen(true);
              else { setEditingProduct(null); setRegisterTypeLocked(false); setIsRegisterProductOpen(true); }
            }}
          />
        )}

        {/* Pestaña: Docentes Investigadores (Directorio y Perfil) */}
        {activeTab === 'directory' && (
          <DirectoryView
            teachers={schoolTeachers}
            allProducts={schoolProducts}
            selectedTeacherId={directorySelectedTeacherId}
            schoolCode={selectedSchool.code}
            onFilterInCatalog={handleViewTeacherProducts}
          />
        )}

        {/* Pestaña: Trazabilidad Ágil (RF01 - RF09, HU01 - HU11) */}
        {activeTab === 'traceability' && canDevelop(currentUser) && <TraceabilityView />}
        {activeTab === 'reviewer' && canReview(currentUser) && <ReviewerConsoleModal
          products={schoolProducts}
          schoolCode={selectedSchool.code}
          onUpdateStatus={handleUpdateProductStatus}
        />}
        {activeTab==='roles' && canDevelop(currentUser) && <RoleManagementView currentUser={currentUser!} onChanged={()=>setCurrentUser(authService.getCurrentUser())}/> }
        {activeTab==='settings' && currentUser?.role==='teacher' && <ProfileSettingsView currentUser={currentUser} onUpdated={user=>{setCurrentUser(user);setTeachers(storageService.getTeachers());}}/>}
        {activeTab==='settings' && currentUser?.role==='student' && <StudentProfileSettingsView currentUser={currentUser} onUpdated={setCurrentUser}/>}
        </Suspense>
      </main>

      {/* 3. Pie de Página Institucional */}
      <footer className="portal-footer"><span>SIMAPC · {getSchoolDisplayCode(selectedSchool.code)}</span><span>Universidad Yachay Tech</span></footer>

      {/* 4. Modales Globales */}
      <LoginDialog isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onLogin={handleLogin} />
      {/* Modal de Registro Asistido de Producción (HU03 y HU04) */}
      {isRegisterProductOpen && !!currentUser && (currentUser.role==='teacher'||currentUser.role==='developer') && <Suspense fallback={<PortalViewLoading />}>
        <RegisterProductModal
          key={`${currentUser?.id}-${registerType}-${editingProduct?.id || 'new'}-${isRegisterProductOpen}`}
          initialType={registerType}
          lockType={registerTypeLocked}
          isOpen
          currentUser={currentUser}
          initialProduct={editingProduct}
          onClose={() => {setIsRegisterProductOpen(false);setEditingProduct(null);setRegisterTypeLocked(false);}}
          onProductSaved={handleProductSaved}
        />
      </Suspense>}


    </div>
  );
}
