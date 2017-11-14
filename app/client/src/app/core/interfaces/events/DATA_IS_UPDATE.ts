import { DataRow } from '../interface.data.row';

class DATA_IS_UPDATED {
    rows : Array<DataRow> = [];
    constructor(rows : Array<DataRow>){
        this.rows = rows;
    }
}

export {DATA_IS_UPDATED as EVENT_DATA_IS_UPDATED }

