import { CommonInterfaces } from '../../interfaces/interface.common';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IData {
    rows: CommonInterfaces.API.IGrabbedElement[];
    from: number;
    to: number;
    count: number;
}

export abstract class DataAccessor {

    public abstract get(
        from: number,
        to: number
    ): Promise<IData>;

}