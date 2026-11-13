import type { ProductType } from '../../types';
import { projectRegistry } from './projectRegistry';
import { publicationRegistry } from './publicationRegistry';
import type { RegistryModule } from './registryCommon';

export type { RegistryDraft, RegistryInput, RegistryModule, RegistryOwner } from './registryCommon';
export { projectRegistry, publicationRegistry };

/** Un módulo de registro por tipo de producto. Agregar un tipo o una escuela no obliga a modificar los demás módulos. */
export const REGISTRY_MODULES: Record<ProductType, RegistryModule> = {
  publicacion: publicationRegistry,
  proyecto: projectRegistry,
};

export function getRegistryModule(type: string): RegistryModule | undefined {
  return Object.prototype.hasOwnProperty.call(REGISTRY_MODULES, type) ? REGISTRY_MODULES[type as ProductType] : undefined;
}
