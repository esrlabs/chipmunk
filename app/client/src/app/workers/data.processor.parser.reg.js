"use strict";
function process1(str, smth, position) {
    var reg = this.regExpCache[smth] !== void 0 ? this.regExpCache[smth] : null;
    if (reg === null && smth !== '' || (reg !== null && reg.stamp !== this.data.rows.length) || (reg !== null && position >= this.data.rows.length)) {
        try {
            var _smth = smth.replace(/\\*$/gi, '')
                .replace(/\\/gi, '\\');
            reg = {
                regExp: reg !== null ? reg.regExp : new RegExp(_smth, 'gi'),
                indexes: reg !== null ? reg.indexes : {},
                stamp: this.data.rows.length > position ? this.data.rows.length : (position + 1),
                lastIndex: reg !== null ? reg.lastIndex : 0
            };
            reg.regExp.lastIndex = reg.lastIndex;
            do {
                var match = reg.regExp.exec(this.data.source);
                var index = null;
                if (match !== null) {
                    index = match.index;
                    index = this.getIndexByPosition(index);
                    if (index.index !== -1 /*&& this.data.rows[index.index] !== void 0*/) {
                        reg.indexes[index.index] = true;
                        reg.lastIndex = reg.regExp.lastIndex;
                        reg.regExp.lastIndex < index.start && (reg.regExp.lastIndex = index.start);
                    }
                }
                else {
                    break;
                }
            } while (true);
            this.regExpCache[smth] = reg;
        }
        catch (error) {
            this.regExpCache[smth] = {
                indexes: null,
            };
        }
    }
    else if (reg === null && smth === '') {
        this.regExpCache[smth] = {
            indexes: null,
        };
    }
    return reg.indexes === null ? true : (reg.indexes[position] !== void 0);
}
exports.process1 = process1;
function process(str, smth, position) {
}
exports.process = process;
;
onmessage = function (event) {
};
//# sourceMappingURL=data.processor.parser.reg.js.map