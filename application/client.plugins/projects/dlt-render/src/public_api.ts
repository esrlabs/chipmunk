/*
 * Public API Surface of terminal
 */

import { DLTRowComponent } from './lib/views/row/component';
/*
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
*/

export const customTypedRowRender = {
    isTypeMatch: (sourceName: string): boolean => {
        if (typeof sourceName !== 'string') {
            return false;
        }
        if (sourceName.search(/\.dlt$/gi) === -1) {
            return false;
        }
        return true;
    },
    type: 'columns',
    api: {
        getHeaders: () => {
            return [
                'Datetime',
                'ECUID',
                'VERS',
                'SID',
                'MCNT',
                'TMS',
                'EID',
                'APID',
                'CTID',
                'MSTP',
                'PAYLOAD',
            ];
        },
        getColumns: (str: string) => {
            return str.split('\u0004');
        },
        getDefaultWidths: () => {
            return [
                { width: 150, min: 30 },
                { width: 50, min: 30 },
                { width: 20, min: 20 },
                { width: 50, min: 30 },
                { width: 40, min: 30 },
                { width: 70, min: 30 },
                { width: 50, min: 30 },
                { width: 50, min: 30 },
                { width: 50, min: 30 },
                { width: 50, min: 30 },
                { width: 1000, min: 100 },
            ];
        }
    }
};

export * from './lib/module';
