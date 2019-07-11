/*
 * Public API Surface of terminal
 */
export * from './lib/views/sidebar.vertical/component';
export * from './lib/module';

export const typedRowComponent = {
    isTypeMatch: (sourceName: string): boolean => {
        return sourceName === 'serial';
    },
    component: {
        selector: 'lib-serial-row-component',
        inputs: {
            service: null,
        }
    }
};
