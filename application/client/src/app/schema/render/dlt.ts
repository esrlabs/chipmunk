import { Render } from './index';
import { Columns } from './columns';
import { Protocol } from '@platform/types/observe/parser/index';

const MIN_COLUMN_WIDTH = 30;
const MAX_COLUMN_WIDTH = 600;
// public readonly widths: number[] = [150, 80, 80, 80, 80, 80, 80, 80, 80, 80, -1];

export class Implementation extends Render<Columns> {
    public static HEADERS = [
        {
            caption: 'Datetime',
            desc: 'Datetime',
        },
        {
            caption: 'ECUID',
            desc: 'ECU',
        },
        {
            caption: 'VERS',
            desc: 'Dlt Protocol Version (VERS)',
        },
        {
            caption: 'SID',
            desc: 'Session ID (SEID)',
        },
        {
            caption: 'MCNT',
            desc: 'Message counter (MCNT)',
        },
        {
            caption: 'TMS',
            desc: 'Timestamp (TMSP)',
        },
        {
            caption: 'EID',
            desc: 'ECU',
        },
        {
            caption: 'APID',
            desc: 'Application ID (APID)',
        },
        {
            caption: 'CTID',
            desc: 'Context ID (CTID)',
        },
        {
            caption: 'MSTP',
            desc: 'Message Type (MSTP)',
        },
        {
            caption: 'PAYLOAD',
            desc: 'Payload',
        },
    ];

    constructor() {
        super();
        this.setBoundEntity(
            new Columns(
                Implementation.HEADERS,
                true,
                [150, 20, 20, 20, 20, 20, 20, 20, 20, 20, -1],
                MIN_COLUMN_WIDTH,
                MAX_COLUMN_WIDTH,
            ),
        );
    }

    public override protocol(): Protocol {
        return Protocol.Dlt;
    }

    public override columns(): number {
        return Implementation.HEADERS.length;
    }
    public override delimiter(): string | undefined {
        return `\u0004`;
    }
}
