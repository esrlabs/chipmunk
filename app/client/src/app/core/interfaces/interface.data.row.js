"use strict";
var DataRow = (function () {
    function DataRow() {
        this.str = '';
        this.render_str = '';
        this.filtered = true;
        this.requests = {};
        this.match = '';
        this.matchReg = true;
        this.filters = {};
        this.parsed = null;
    }
    return DataRow;
}());
exports.DataRow = DataRow;
//# sourceMappingURL=interface.data.row.js.map