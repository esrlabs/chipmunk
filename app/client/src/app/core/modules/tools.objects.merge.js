"use strict";
function merge(dest) {
    if (dest === void 0) { dest = {}; }
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    function interaction(dest, src) {
        Object.keys(src).forEach(function (key) {
            if (src[key] instanceof Array) {
                dest[key] = src[key].filter(function (x) { return true; });
            }
            else if (typeof src[key] === 'object' && src[key] !== null) {
                dest[key] = typeof dest[key] === 'object' ? (dest[key] !== null ? dest[key] : {}) : {};
                interaction(dest[key], src[key]);
            }
            else {
                dest[key] = src[key];
            }
        });
    }
    ;
    dest = typeof dest === 'object' ? (dest !== null ? dest : {}) : {};
    if (args instanceof Array && args.length > 0) {
        args.forEach(function (src) {
            if (typeof src === 'object' && src !== null) {
                interaction(dest, src);
            }
        });
    }
    return dest;
}
exports.merge = merge;
;
//# sourceMappingURL=tools.objects.merge.js.map