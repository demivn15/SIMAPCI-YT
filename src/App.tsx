import React, { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SCHOOLS, type SchoolConfig } from './constants/schools';
import { InstitutionalLanding } from './components/institutional/InstitutionalLanding';
import { PortalEntryLoading } from './components/institutional/PortalEntryLoading';
import { YachayLogo } from './components/institutional/SchoolLogo';
import { ensureFloatingSchoolLogosDecoded } from './assets/schoolLogos';
import { useScreenScrollStart } from './components/layout/ScreenScrollStart';

let portalAppModule: Promise<typeof import('./PortalApp')> | undefined;
const loadPortalApp = () => portalAppModule ??= import('./PortalApp');
const PortalApp = lazy(loadPortalApp);
const SESSION_USER_KEY = 'red_papers_current_user_v1';
const APP_HISTORY_KEY = 'redPapersShell';

type AppHistoryEntry = { screen: 'schools' } | { screen: 'school'; schoolCode: string };

function currentSchoolFromSavedSession(): SchoolConfig | null {
  try {
    const user = JSON.parse(window.localStorage.getItem(SESSION_USER_KEY) || 'null') as { school?: string } | null;
    return SCHOOLS.find((school) => school.code === user?.school) ?? null;
  } catch {
    return null;
  }
}

export default function App() {
  const [selectedSchool, setSelectedSchool] = useState<SchoolConfig | null>(currentSchoolFromSavedSession);
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);
  useScreenScrollStart(selectedSchool ? `school:${selectedSchool.code}` : 'welcome');
  const mobileSchoolSelectionPending = useRef(false);
  const returningToSchools = useRef(false);
  const selectSchool = useCallback((school: SchoolConfig) => {
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    if (mobile && mobileSchoolSelectionPending.current) return;
    const state = (window.history.state && typeof window.history.state === 'object' ? window.history.state : {}) as Record<string, unknown>;
    const currentEntry = state[APP_HISTORY_KEY] as AppHistoryEntry | undefined;
    if (currentEntry?.screen !== 'schools') {
      window.history.replaceState({ ...state, [APP_HISTORY_KEY]: { screen: 'schools' } satisfies AppHistoryEntry }, '');
    }

    const nextState = (window.history.state && typeof window.history.state === 'object' ? window.history.state : {}) as Record<string, unknown>;
    window.history.pushState({ ...nextState, [APP_HISTORY_KEY]: { screen: 'school', schoolCode: school.code } satisfies AppHistoryEntry }, '');
    if (mobile) {
      mobileSchoolSelectionPending.current = true;
      void loadPortalApp().then(() => setSelectedSchool(school), () => setSelectedSchool(school)).finally(() => {
        mobileSchoolSelectionPending.current = false;
      });
    } else {
      setSelectedSchool(school);
    }
  }, []);

  const returnToSchools = useCallback(() => {
    const state = (window.history.state && typeof window.history.state === 'object' ? window.history.state : {}) as Record<string, unknown>;
    window.history.pushState({ ...state, [APP_HISTORY_KEY]: { screen: 'schools' } satisfies AppHistoryEntry }, '');
    returningToSchools.current = true;
    setSelectedSchool(null);
  }, []);

  useEffect(() => {
    const state = (window.history.state && typeof window.history.state === 'object' ? window.history.state : {}) as Record<string, unknown>;
    if (state[APP_HISTORY_KEY]) return;

    const entry: AppHistoryEntry = selectedSchool
      ? { screen: 'school', schoolCode: selectedSchool.code }
      : { screen: 'schools' };
    window.history.replaceState({ ...state, [APP_HISTORY_KEY]: entry }, '');
  }, []);

  useEffect(() => {
    const onShellPopState = (event: PopStateEvent) => {
      const entry = event.state?.[APP_HISTORY_KEY] as AppHistoryEntry | undefined;
      if (!entry) return;
      if (entry.screen === 'schools') {
        returningToSchools.current = true;
        setSelectedSchool(null);
        return;
      }

      const school = SCHOOLS.find((candidate) => candidate.code === entry.schoolCode);
      if (school) setSelectedSchool(school);
    };

    window.addEventListener('popstate', onShellPopState);
    return () => window.removeEventListener('popstate', onShellPopState);
  }, []);

  useEffect(() => {
    const shell = document.getElementById('simapc-startup');
    if (!shell) return;
    let hideTimer = 0;
    let removeTimer = 0;
    let cancelled = false;
    const hide = () => {
      if (cancelled) return;
      shell.setAttribute('aria-hidden', 'true');
      shell.classList.add('is-leaving');
      removeTimer = window.setTimeout(() => shell.remove(), 280);
    };

    if (selectedSchool) {
      hide();
    } else {
      const startup = window as Window & { __SIMAPC_STARTUP_END_AT?: number; __SIMAPC_STARTUP_PAINTED?: Promise<void> };
      void Promise.all([ensureFloatingSchoolLogosDecoded(), startup.__SIMAPC_STARTUP_PAINTED]).then(([ready]) => {
        if (!ready || cancelled) return;
        const delay = Math.max(0, (startup.__SIMAPC_STARTUP_END_AT ?? performance.now()) - performance.now());
        hideTimer = window.setTimeout(hide, delay);
      });
    }

    return () => {
      cancelled = true;
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, [selectedSchool]);

  if (!selectedSchool) {
    return <InstitutionalLanding onSelect={selectSchool} replayIntroOnEntry={returningToSchools.current} />;
  }

  return (
    <Suspense fallback={window.matchMedia('(max-width: 760px)').matches
      ? <PortalEntryLoading />
      : <main className="portal-loading" role="status" aria-live="polite"><YachayLogo width={112} /><span>Abriendo el espacio de {selectedSchool.shortName}…</span></main>}>
      <PortalApp initialSchool={selectedSchool} onChangeSchool={returnToSchools} />
    </Suspense>
  );
}
