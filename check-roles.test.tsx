import assert from 'node:assert/strict';
import React from 'react';
import { describe, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_ACCOUNTS, canReview, canDevelop } from './src/constants/demoAccounts';
import { authService } from './src/services/authService';
import { Header } from './src/components/layout/Header';

describe('cuentas, menús y permisos', () => {
  it('valida las cuentas de demostración y muestra las opciones según el rol', () => {
    for (const { user, password } of DEMO_ACCOUNTS) {
      authService.logout();
      assert.equal(authService.login(user.email, 'incorrecta').success, false);
      assert.equal(authService.getCurrentUser(), null);
      assert.equal(authService.login(user.email, password).success, true);
      assert.equal(authService.getCurrentUser()?.role, user.role);

      const html = renderToStaticMarkup(
        <Header
          activeTab="dashboard"
          currentUser={user}
          teachers={[]}
          notifications={[]}
          onTabChange={() => {}}
          onLoginClick={() => {}}
          onLogoutClick={() => {}}
          onSwitchUser={() => {}}
          onOpenRegisterModal={() => {}}
          onOpenReviewerConsole={() => {}}
          onMarkNotificationAsRead={() => {}}
          onMarkAllNotificationsAsRead={() => {}}
        />,
      );

      assert.equal(html.includes('aria-label="Navegación principal móvil"'), true);
      assert.equal(html.includes('aria-current="page"'), true);
      assert.equal(html.includes('Publicaciones y proyectos'), true);
      assert.equal(html.includes('Docentes'), true);
      assert.equal(html.includes('Otras herramientas'), user.role === 'developer');
      assert.equal(html.includes('Comité Científico'), user.role === 'developer' || user.role === 'reviewer_demo');
      assert.equal(canReview(user), user.role === 'developer' || user.role === 'reviewer_demo');
      assert.equal(canDevelop(user), user.role === 'developer');
      if (user.role === 'teacher') assert.equal(html.includes('Trazabilidad del proyecto'), false);
    }

    authService.logout();
    assert.equal(canReview(authService.getCurrentUser()), false);
    assert.equal(canDevelop(authService.getCurrentUser()), false);
  });
});
