import type { A2UIComponent } from '../types.js';

export function a2ui(
  surfaceId: string,
  type: A2UIComponent['root']['type'],
  title: string,
  data: unknown,
): A2UIComponent {
  return {
    version: '0.1',
    surfaceId,
    operation: 'replace',
    root: { type, title, data },
  };
}
