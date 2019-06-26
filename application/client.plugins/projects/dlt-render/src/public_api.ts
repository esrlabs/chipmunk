/*
 * Public API Surface of terminal
 */

import { DLTRowComponent } from './lib/views/row/component';

export const typedRowComponent = {
    isTypeMatch: (sourceName: string): boolean => {
        if (typeof sourceName !== 'string') {
            return false;
        }
        if (sourceName.search(/\.dlt$/gi) === -1) {
            return false;
        }
        return true;
    },
    component: {
        selector: 'lib-dlt-row-component',
        inputs: {
            service: null,
        }
    }
};

export * from './lib/module';
