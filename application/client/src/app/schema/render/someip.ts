import { Render } from './index';
import { Columns } from './columns';

const MIN_COLUMN_WIDTH = 30;
const MAX_COLUMN_WIDTH = 600;

export class Implementation extends Render<Columns> {
    public static HEADERS = [
        {
            caption: 'Caption Column 1',
            desc: 'Description Column 1',
        },
        {
            caption: 'Caption Column 2',
            desc: 'Description Column 2',
        },
        
    ];

    constructor() {
        super();
        this.setBoundEntity(
            new Columns(
                Implementation.HEADERS,
                true,
                // Length -1 means - do not setup width of column. It should be used for last column, which better
                // to be Payload column
                [150, -1],
                MIN_COLUMN_WIDTH,
                MAX_COLUMN_WIDTH,
            ),
        );
    }

    public override columns(): number {
        return Implementation.HEADERS.length;
    }
    public override delimiter(): string | undefined {
        return `\u0004`;
    }
}
