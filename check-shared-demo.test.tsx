import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_ACCOUNTS, canReview } from './src/constants/demoAccounts';
import { SCHOOLS } from './src/constants/schools';
import { INITIAL_PRODUCTS, INITIAL_TEACHERS } from './src/constants/seedData';
import { STUDENT_COLLABORATIONS } from './src/constants/studentCollaborations';
import { authService } from './src/services/authService';
import { productService } from './src/services/productService';
import { storageService, STORAGE_KEYS } from './src/services/storage';
import { RoleManagementView } from './src/components/roles/RoleManagementView';

const sharedAccounts = DEMO_ACCOUNTS.filter(account => account.user.role !== 'developer');
const teacherAccount = DEMO_ACCOUNTS.find(account => account.user.role === 'teacher')!;

afterEach(() => vi.restoreAllMocks());

describe('credenciales compartidas entre escuelas', () => {
  it('identifica la escuela en la administración de las cuentas compartidas', () => {
    const developer = DEMO_ACCOUNTS.find(account => account.user.role === 'developer')!;
    authService.login(developer.user.email, developer.password);
    const html = renderToStaticMarkup(<RoleManagementView currentUser={developer.user} onChanged={() => {}} />);
    for (const school of SCHOOLS) {
      expect(html).toContain(`Escuela: ${school.code}`);
      expect(html).toContain(`Rol de Comité Científico (${school.code})`);
    }
  });

  it.each(sharedAccounts)('$user.role entra y conserva escuela y permisos en $user.school', account => {
    const school = SCHOOLS.find(school => school.code === account.user.school)!;
    expect(authService.login(account.user.email, 'incorrecta', school.code).success).toBe(false);
    expect(authService.getCurrentUser()).toBeNull();

    const result = authService.login(account.user.email, account.password, school.code);
    expect(result.success).toBe(true);
    expect(result.user?.id).toBe(account.user.id);
    expect(authService.getCurrentUser()).toMatchObject({id:account.user.id, role:account.user.role, school:school.code});
    expect(canReview(authService.getCurrentUser())).toBe(account.user.role === 'reviewer_demo');

    const created = productService.createProduct({
      ...INITIAL_PRODUCTS[0],
      title:'Producto de prueba de acceso compartido',
      authors:[result.user!.name],
      school:school.code,
      researchLine:school.researchLines[0],
      doi:undefined,
    }, result.user!.id);
    expect(created.success).toBe(account.user.role === 'teacher');
    if (created.success) {
      expect(created.product).toMatchObject({ownerId:account.user.id, school:school.code});
      expect(storageService.getTeachers().find(teacher => teacher.id === account.user.id)?.school).toBe(school.code);
    }
    if (account.user.role === 'reviewer_demo') {
      const product = {...INITIAL_PRODUCTS[0], id:'test-review', school:school.code, status:'cargado' as const};
      storageService.saveProducts([product]);
      expect(productService.updateProductStatus(product.id, 'verificado').success).toBe(true);
      storageService.saveProducts([{...product, ownerId:account.user.id}]);
      expect(productService.updateProductStatus(product.id, 'verificado').success).toBe(false);
    }
    authService.logout();
    expect(authService.login(account.user.email, account.password, school.code).user?.id).toBe(account.user.id);
  });

  it('mantiene los perfiles separados y no mueve al docente semilla ECMC', () => {
    const original = storageService.getTeachers().find(teacher => teacher.id === INITIAL_TEACHERS[0].id)!;
    const loggedIn = authService.login(teacherAccount.user.email, teacherAccount.password, 'ECBI');
    const update = authService.updateProfile({name:'Profesor Prueba ECBI', rank:'Profesor', academicDegree:'MSc', researchLines:[SCHOOLS.find(school => school.code === 'ECBI')!.researchLines[0]]});
    expect(update.success).toBe(true);
    expect(update.user?.id).toBe(loggedIn.user?.id);
    expect(storageService.getTeachers().find(teacher => teacher.id === original.id)).toEqual(original);
    authService.logout();
    expect(authService.login(teacherAccount.user.email, teacherAccount.password, 'ECTEA').user?.name).toBe('Profesor de prueba');
    authService.logout();
    expect(authService.login(teacherAccount.user.email, teacherAccount.password, 'ECBI').user?.name).toBe('Profesor Prueba ECBI');
  });

  it('usa una misma contraseña docente en las siete escuelas al actualizarla', () => {
    authService.login(teacherAccount.user.email, teacherAccount.password, 'ECBI');
    expect(authService.changePassword(teacherAccount.password, 'NuevaPrueba2026!').success).toBe(true);
    authService.logout();
    for (const school of SCHOOLS) {
      expect(authService.login(teacherAccount.user.email, teacherAccount.password, school.code).success).toBe(false);
      expect(authService.login(teacherAccount.user.email, 'NuevaPrueba2026!', school.code).success).toBe(true);
      authService.logout();
    }
  });

  it('conserva el correo estudiantil anterior sin atribuir colaboraciones ficticias', () => {
    const account = sharedAccounts.find(account => account.user.role === 'student')!;
    for (const school of SCHOOLS) {
      const result = authService.login('estudiante.ecmc@yachaytech.edu.ec', account.password, school.code);
      expect(result.success).toBe(true);
      expect(result.user?.email).toBe('estudiante@yachaytech.edu.ec');
      expect((STUDENT_COLLABORATIONS[result.user!.id] || []).length).toBe(0);
      authService.logout();
    }
  });

  it('mantiene las cuentas registradas y la de desarrollador en su escuela', () => {
    const email = 'prueba.registro@yachaytech.edu.ec';
    const password = 'Registro2026!';
    expect(authService.register({name:'Profesor registrado', email, password, school:'ECMC'}).success).toBe(true);
    authService.logout();
    expect(authService.login(email, password, 'ECBI').success).toBe(false);
    expect(authService.getCurrentUser()).toBeNull();
    expect(authService.login(email, password, 'ECMC').success).toBe(true);
    authService.logout();
    const developer = DEMO_ACCOUNTS.find(account => account.user.role === 'developer')!;
    expect(authService.login(developer.user.email, developer.password, 'ECBI').success).toBe(false);
    expect(authService.getCurrentUser()).toBeNull();
  });

  it('revierte la creación del perfil demo si falla el guardado de sesión', () => {
    const teachers = storageService.getTeachers();
    const originalSet = localStorage.setItem.bind(localStorage);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === STORAGE_KEYS.CURRENT_USER) throw new Error('QuotaExceededError');
      originalSet(key, value);
    });
    const result = authService.login(teacherAccount.user.email, teacherAccount.password, 'ECBI');
    expect(result.success).toBe(false);
    expect(result.error).toContain('guardar');
    expect(authService.getCurrentUser()).toBeNull();
    expect(storageService.getTeachers()).toEqual(teachers);
  });

  it('bloquea todas las cuentas y sus sesiones cuando se desactiva la demo', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ENABLE_DEMO', 'false');
    vi.resetModules();
    try {
      const {authService:disabledAuth} = await import('./src/services/authService');
      for (const account of DEMO_ACCOUNTS) {
        const school = SCHOOLS.find(school => school.code === account.user.school)!;
        expect(disabledAuth.login(account.user.email, account.password, school.code).success).toBe(false);
        storageService.setCurrentUser(account.user);
        expect(disabledAuth.getCurrentUser()).toBeNull();
      }
      expect(disabledAuth.login('estudiante.ecmc@yachaytech.edu.ec', 'Estudiante2026!', 'ECMC').success).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
