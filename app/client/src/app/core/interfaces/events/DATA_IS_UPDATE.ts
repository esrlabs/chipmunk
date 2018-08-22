import { DataRow } from '../interface.data.row';
import {DataFilter} from "../interface.data.filter";

class DATA_IS_UPDATED {
    rows : Array<DataRow> = [];
    bookmarks: Array<number> = [];
    remarks: Array<any> = [];
    filter: DataFilter;
    constructor(rows : Array<DataRow>, bookmarks: Array<number> = [], remarks: Array<any> = [], filter: DataFilter = { value: '', mode: ''}){
        this.rows = rows;
        this.bookmarks = bookmarks;
        this.filter = filter;
        this.remarks = remarks;
    }
}

export {DATA_IS_UPDATED as EVENT_DATA_IS_UPDATED }

