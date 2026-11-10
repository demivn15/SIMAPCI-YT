import assert from 'node:assert/strict';
import React from 'react';
import { describe, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { authService } from './src/services/authService';
import { productService } from './src/services/productService';
import { DEMO_ACCOUNTS } from './src/constants/demoAccounts';
import { INITIAL_PRODUCTS } from './src/constants/seedData';
import { InstitutionalBanner } from './src/components/dashboard/InstitutionalBanner';

const accountFor = (role: string) => DEMO_ACCOUNTS.find((account) => account.user.role === role)!;

describe('permisos de comité y docentes', () => {
  it('bloquea el registro para comité y conserva el registro docente', () => {
    const committee = accountFor('reviewer_demo');
    const teacher = accountFor('teacher');

    assert.equal(authService.login(committee.user.email, committee.password).success, true);
    const count = productService.getAllProducts().length;
    assert.equal(productService.createProduct(INITIAL_PRODUCTS[0], committee.user.id).success, false);
    assert.equal(productService.getAllProducts().length, count);

    const html = renderToStaticMarkup(<InstitutionalBanner allowRegister={false} onOpenRegister={() => {}} onBrowse={() => {}} />);
    assert.equal(html.includes('Registrar publicación'), false);
    assert.equal(html.includes('Registrar proyecto'), false);
    assert.equal(html.includes('Consultar producción'), true);

    assert.equal(authService.login(teacher.user.email, teacher.password).success, true);
    const result = productService.createProduct({
      ...INITIAL_PRODUCTS[0],
      doi: `10.9999/test-role-${crypto.randomUUID()}`,
      projectCode: undefined,
    }, teacher.user.id);
    assert.equal(result.success, true);
  });
});
