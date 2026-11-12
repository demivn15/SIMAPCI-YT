import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { DEMO_ACCOUNTS } from './src/constants/demoAccounts';
import { SCHOOLS } from './src/constants/schools';
import { authService } from './src/services/authService';
import { productService } from './src/services/productService';
import { REGISTRY_MODULES, RegistryInput, getRegistryModule, projectRegistry, publicationRegistry } from './src/services/registry';

const owner = { id: 'doc-test', school: 'ECBI' };

const baseInput = (overrides: Partial<RegistryInput> = {}): RegistryInput => ({
  type: 'publicacion',
  title: '  Un título  ',
  authors: ['Ana Torres', '  '],
  school: '',
  year: 2025,
  researchLine: '',
  abstract: 'Resumen',
  ...overrides,
});

const teacherFor = (schoolCode: string) =>
  DEMO_ACCOUNTS.find(account => account.user.role === 'teacher' && account.user.school === schoolCode)!;

describe('módulos de registro independientes', () => {
  it('registra un módulo por tipo de producto', () => {
    assert.equal(REGISTRY_MODULES.publicacion, publicationRegistry);
    assert.equal(REGISTRY_MODULES.proyecto, projectRegistry);
    assert.equal(getRegistryModule('proyecto'), projectRegistry);
    assert.equal(getRegistryModule('otro'), undefined);
    assert.equal(getRegistryModule('toString'), undefined);
  });

  it('el módulo de publicaciones conserva sus campos y descarta los de proyectos', () => {
    const result = publicationRegistry.prepare(baseInput({
      doi: ' 10.1/abc ', venue: 'Revista', publicationDate: '2025-03-01',
      projectCode: 'ECMC-INV-1', projectStatus: 'activo', projectParticipants: ['X'], expectedProducts: ['Y'],
    }), owner);
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.product.type, 'publicacion');
    assert.equal(result.product.title, 'Un título');
    assert.deepEqual(result.product.authors, ['Ana Torres']);
    assert.equal(result.product.doi, '10.1/abc');
    assert.equal(result.product.publicationDate, '2025-03-01');
    for (const field of ['projectCode', 'projectStatus', 'projectParticipants', 'expectedProducts'] as const) {
      assert.equal(field in result.product, false, field);
    }
  });

  it('el módulo de proyectos conserva sus campos y descarta los de publicaciones', () => {
    const result = projectRegistry.prepare(baseInput({
      type: 'proyecto', projectCode: ' ECMC-INV-1 ', projectStartDate: '2025-01-01',
      doi: '10.1/abc', venue: 'Revista', publicationDate: '2025-03-01',
    }), owner);
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.product.type, 'proyecto');
    assert.equal(result.product.projectCode, 'ECMC-INV-1');
    assert.equal(result.product.projectStatus, 'activo');
    for (const field of ['doi', 'venue', 'publicationDate'] as const) {
      assert.equal(field in result.product, false, field);
    }
  });

  it('cada módulo aplica solo sus propias reglas', () => {
    const badDates = baseInput({ type: 'proyecto', projectStartDate: '2025-06-01', projectEndDate: '2025-01-01' });
    assert.equal(projectRegistry.prepare(badDates, owner).success, false);
    // La misma combinación de fechas no es una regla de publicaciones.
    assert.equal(publicationRegistry.prepare({ ...badDates, type: 'publicacion' }, owner).success, true);

    assert.equal(publicationRegistry.prepare(baseInput({ title: '   ' }), owner).success, false);
    assert.equal(projectRegistry.prepare(baseInput({ type: 'proyecto', authors: [' '] }), owner).success, false);
  });

  it('no asume una escuela: usa la indicada, si no la del responsable, y exige que exista', () => {
    for (const school of SCHOOLS) {
      for (const module of [publicationRegistry, projectRegistry]) {
        const result = module.prepare(baseInput({ type: module.type, school: school.code }), owner);
        assert.equal(result.success && result.product.school, school.code);
      }
    }
    const inherited = publicationRegistry.prepare(baseInput({ school: '' }), owner);
    assert.equal(inherited.success && inherited.product.school, 'ECBI');

    for (const module of [publicationRegistry, projectRegistry]) {
      const input = baseInput({ type: module.type, school: '' });
      assert.equal(module.prepare(input, { id: 'x', school: '' }).success, false, 'sin escuela no se asume ECMC');
      assert.equal(module.prepare({ ...input, school: 'NOPE' }, owner).success, false);
    }
  });
});

describe('registro de productos por escuela mediante productService', () => {
  for (const school of SCHOOLS.filter(school => teacherFor(school.code))) {
    it(`registra publicaciones y proyectos de ${school.code} sin convertirlos a ECMC`, () => {
      const account = teacherFor(school.code);
      const login = authService.login(account.user.email, account.password, school.code);
      assert.equal(login.success, true);

      const publication = productService.createProduct(
        baseInput({ title: `Publicación ${school.code}`, authors: ['Docente'], doi: `10.9999/${school.code}-${crypto.randomUUID()}` }),
        account.user.id,
      );
      assert.equal(publication.success, true, publication.error);
      assert.equal(publication.product?.school, school.code);
      assert.equal(publication.product?.type, 'publicacion');

      const project = productService.createProduct(
        baseInput({ type: 'proyecto', title: `Proyecto ${school.code}`, authors: ['Docente'], projectCode: `${school.code}-INV-${crypto.randomUUID()}` }),
        account.user.id,
      );
      assert.equal(project.success, true, project.error);
      assert.equal(project.product?.school, school.code);
      assert.equal(project.product?.projectStatus, 'activo');
      assert.equal(project.product?.doi, undefined);
    });
  }

  it('rechaza un tipo de producto desconocido sin guardar nada', () => {
    const account = teacherFor('ECMC');
    authService.login(account.user.email, account.password, 'ECMC');
    const before = productService.getAllProducts().length;
    const result = productService.createProduct(baseInput({ type: 'otro' as never }), account.user.id);
    assert.equal(result.success, false);
    assert.equal(productService.getAllProducts().length, before);
  });
});
