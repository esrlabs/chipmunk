import { DataRow } from '../interface.data.row';

class DATA_IS_UPDATED {
    rows : Array<DataRow> = [];
    bookmarks: Array<number> = [];
    constructor(rows : Array<DataRow>, bookmarks: Array<number> = []){
        this.rows = rows;
        this.bookmarks = bookmarks;
    }
}

export {DATA_IS_UPDATED as EVENT_DATA_IS_UPDATED }

