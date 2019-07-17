/*
 * Public API Surface of terminal
 */

import { DLTRowColumns } from './lib/render/row.columns';

const customRowRender = new DLTRowColumns();

export { customRowRender };

export * from './lib/module';
