import assert from 'node:assert/strict';
import React from 'react';
import { describe, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { roleService } from './src/services/roleService';
import { authService } from './src/services/authService';
import { DEMO_ACCOUNTS } from './src/constants/demoAccounts';
import { RoleManagementView } from './src/components/roles/RoleManagementView';

const accountFor = (role: string) => DEMO_ACCOUNTS.find((account) => account.user.role === role)!;

describe('asignación de roles', () => {
  it('permite al desarrollador promover y restaurar a un docente', () => {
    const teacher = accountFor('teacher');
    const developer = accountFor('developer');
    const committee = accountFor('reviewer_demo');

    assert.equal(authService.login(developer.user.email, developer.password).success, true);
    assert.ok(renderToStaticMarkup(<RoleManagementView currentUser={developer.user} onChanged={() => {}} />).includes(teacher.user.email));
    assert.equal(roleService.assign(teacher.user.id, 'reviewer_demo').success, true);

    assert.equal(authService.login(teacher.user.email, teacher.password).success, true);
    assert.equal(authService.getCurrentUser()?.role, 'reviewer_demo');

    assert.equal(authService.login(developer.user.email, developer.password).success, true);
    assert.equal(roleService.assign(teacher.user.id, 'teacher').success, true);
    assert.equal(authService.login(teacher.user.email, teacher.password).success, true);
    assert.equal(authService.getCurrentUser()?.role, 'teacher');
    assert.equal(authService.login(committee.user.email, committee.password).success, true);
    assert.equal(roleService.assign(committee.user.id, 'teacher').success, false);
  });

  it('reserva los cambios de rol al desarrollador', () => {
    const teacher = accountFor('teacher');
    const developer = accountFor('developer');
    const committee = accountFor('reviewer_demo');

    assert.equal(authService.login(committee.user.email, committee.password).success, true);
    assert.equal(roleService.assign(teacher.user.id, 'reviewer_demo').success, false);
    assert.equal(roleService.assign(teacher.user.id, 'teacher').success, false);

    assert.equal(authService.login(teacher.user.email, teacher.password).success, true);
    assert.equal(roleService.assign(teacher.user.id, 'reviewer_demo').success, false);

    assert.equal(authService.login(developer.user.email, developer.password).success, true);
    assert.equal(roleService.assign(developer.user.id, 'reviewer_demo').success, false);
    assert.equal(roleService.assign(teacher.user.id, 'reviewer_demo').success, true);
    assert.equal(authService.login(teacher.user.email, teacher.password).success, true);
    assert.equal(authService.getCurrentUser()?.role, 'reviewer_demo');
  });
});
