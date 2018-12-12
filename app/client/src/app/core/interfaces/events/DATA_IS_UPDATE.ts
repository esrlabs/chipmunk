import { DataRow } from '../interface.data.row';
import {DataFilter} from "../interface.data.filter";

class DATA_IS_UPDATED {
    rows : Array<DataRow> = [];
    bookmarks: Array<number> = [];
    remarks: Array<any> = [];
    filter: DataFilter;
    fragment: string;
    constructor(rows : Array<DataRow>, bookmarks: Array<number> = [], remarks: Array<any> = [], filter: DataFilter = { value: '', mode: ''}, fragment: string = ''){
        this.rows = rows;
        this.bookmarks = bookmarks;
        this.filter = filter;
        this.remarks = remarks;
        this.fragment = fragment;
    }
}

export {DATA_IS_UPDATED as EVENT_DATA_IS_UPDATED }

