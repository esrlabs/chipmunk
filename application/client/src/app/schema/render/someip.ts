import { Render } from './index';
import { Columns } from './columns';
import { Protocol } from '@platform/types/observe/parser/index';

const MIN_COLUMN_WIDTH = 30;
const MAX_COLUMN_WIDTH = 600;

export class Implementation extends Render<Columns> {
    public static HEADERS = [
        {
            caption: 'SOME/IP',
            desc: 'The Message-Kind.',
        },
        {
            caption: 'SERV',
            desc: 'The Service-ID',
        },
        {
            caption: 'METH',
            desc: 'The Method-ID',
        },
        {
            caption: 'LENG',
            desc: 'The Length-Field',
        },
        {
            caption: 'CLID',
            desc: 'The Client-ID',
        },
        {
            caption: 'SEID',
            desc: 'The Session-ID',
        },
        {
            caption: 'IVER',
            desc: 'The Interface-Version',
        },
        {
            caption: 'MSTP',
            desc: 'The Message-Type',
        },
        {
            caption: 'RETC',
            desc: 'The Return-Code',
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
                // Implementation.HEADERS,
                [],
                true,
                [50, 50, 50, 30, 30, 30, 30, 30, 30, -1],
                MIN_COLUMN_WIDTH,
                MAX_COLUMN_WIDTH,
            ),
        );
    }

    public override protocol(): Protocol {
        return Protocol.SomeIp;
    }

    public override columns(): number {
        return Implementation.HEADERS.length;
    }
    public override delimiter(): string | undefined {
        return `\u0004`;
    }
}
