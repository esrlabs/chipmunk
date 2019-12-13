/*
 * Public API Surface of terminal
 */

import { DLTRowColumns } from './lib/render/row.columns';
import Service from './lib/service/service';

const customRowRender = new DLTRowColumns();

export { customRowRender, Service };

export * from './lib/module';
