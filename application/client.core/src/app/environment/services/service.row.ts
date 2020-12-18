import * as Toolkit from 'chipmunk.client.toolkit';

export class RowService {

    public rangesOpened: number = 0;

    private _logger: Toolkit.Logger = new Toolkit.Logger('RowService');

    public getName(): string {
        return 'RowService';
    }

}

export default (new RowService());
