"use strict";
function serializeStringForReg(str) {
    var chars = '{}[]+$^/!.*|\\():?,=';
    Array.prototype.forEach.call(chars, function (char) {
        str = str.replace(new RegExp('\\' + char, 'gi'), '\\' + char);
    });
    return str;
}
exports.serializeStringForReg = serializeStringForReg;
;
//# sourceMappingURL=tools.regexp.js.map