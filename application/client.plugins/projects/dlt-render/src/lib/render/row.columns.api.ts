import * as Toolkit from 'logviewer.client.toolkit';

export class DLTRowColumnsAPI extends Toolkit.ATypedRowRenderAPIColumns {

    constructor() {
        super();
    }

    public getHeaders(): string[] {
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
    }

    public getColumns(str: string): string[] {
        return str.split('\u0004');
    }

    public getDefaultWidths(): Array<{ width: number, min: number }> {
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
