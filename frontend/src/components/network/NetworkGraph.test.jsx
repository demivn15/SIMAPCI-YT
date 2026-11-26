/**
 * Grafo de red reutilizable: nodos enfocables con nombre accesible, resaltado de vecinos al
 * enfocar o pasar el cursor, selección fija con clic o teclado, y estado vacío.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import NetworkGraph from './NetworkGraph';

const nodes = [
  { id: 'a', label: 'Ana Morales', size: 2, color: '#82302a', shape: 'circle', href: '/docentes/a' },
  { id: 'l', label: 'Luis Paredes', size: 5, color: '#2f5d7c', shape: 'circle', href: '/docentes/l' },
  { id: 'p', label: 'Pía Torres', size: 1, color: '#2f5d7c', shape: 'circle' },
  { id: 'inst:UPC', label: 'UPC', size: 3, color: '#b07a1c', shape: 'square' },
  { id: 'z', label: 'Zoe Aislada', size: 40, color: '#9b958f', shape: 'circle' },
];
const edges = [
  { source: 'a', target: 'l', weight: 3 },
  { source: 'l', target: 'p', weight: 1 },
  { source: 'l', target: 'inst:UPC', weight: 2 },
];

function renderGraph(props = {}) {
  render(
    <MemoryRouter>
      <NetworkGraph nodes={nodes} edges={edges} title="Red de prueba" legend={[{ label: 'Comunidad 1', color: '#82302a' }]} {...props} />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

const node = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

describe('NetworkGraph', () => {
  it('dibuja cada nodo como elemento enfocable con su número de conexiones', () => {
    renderGraph();
    expect(screen.getByRole('group', { name: 'Red de prueba' })).toBeInTheDocument();
    expect(node('Luis Paredes')).toHaveAccessibleName('Luis Paredes, 3 conexiones');
    expect(node('Zoe Aislada')).toHaveAccessibleName('Zoe Aislada, 0 conexiones');
    expect(node('Ana Morales')).toHaveAttribute('tabindex', '0');
    // Las instituciones se dibujan como cuadrados; los profesores como círculos.
    expect(node('UPC').querySelector('rect')).not.toBeNull();
    expect(node('Ana Morales').querySelector('circle')).not.toBeNull();
    expect(screen.getByText('Comunidad 1')).toBeInTheDocument();
  });

  it('al enfocar un nodo resalta a sus vecinos y atenúa al resto', async () => {
    const user = renderGraph();
    await user.tab();
    const first = document.activeElement;
    expect(first).toHaveClass('is-active');
    // Enfocar con el teclado: el primer nodo en el orden del documento.
    await user.hover(node('Ana Morales'));
    expect(node('Ana Morales')).toHaveClass('is-active');
    expect(node('Luis Paredes')).toHaveClass('is-neighbor');
    expect(node('Pía Torres')).toHaveClass('is-dim');
    expect(node('Zoe Aislada')).toHaveClass('is-dim');
  });

  it('al seleccionar un nodo muestra sus vecinos con el peso de cada conexión', async () => {
    const user = renderGraph({ neighborNoun: 'conexiones en la red' });
    await user.click(node('Luis Paredes'));
    await user.unhover(node('Luis Paredes'));
    expect(node('Luis Paredes')).toHaveAttribute('aria-pressed', 'true');
    const panel = screen.getByRole('heading', { level: 3, name: 'Luis Paredes' }).closest('aside');
    const items = within(panel).getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual(['Ana Morales3', 'UPC2', 'Pía Torres1']);
    expect(within(panel).getByRole('link', { name: 'Ver ficha' })).toHaveAttribute('href', '/docentes/l');

    // Un segundo clic (o Enter) quita la selección.
    node('Luis Paredes').focus();
    await user.keyboard('{Enter}');
    expect(node('Luis Paredes')).toHaveAttribute('aria-pressed', 'false');
  });

  it('un nodo sin conexiones lo dice en el panel', async () => {
    const user = renderGraph();
    await user.click(node('Zoe Aislada'));
    expect(screen.getByText('Sin conexiones en esta red.')).toBeInTheDocument();
  });

  it('muestra un mensaje si no hay nodos', () => {
    renderGraph({ nodes: [], edges: [], emptyMessage: 'Sin datos.' });
    expect(screen.getByText('Sin datos.')).toBeInTheDocument();
  });
});
