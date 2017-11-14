"use strict";
var getColorsSet = function () {
    var colors = [], step = 40;
    for (var r = 0; r <= 255; r += step) {
        for (var g = 0; g <= 255; g += step) {
            for (var b = 0; b <= 255; b += step) {
                colors.push('rgb(' + r + ',' + g + ',' + b + ')');
            }
        }
    }
    return colors;
};
exports.getColorsSet = getColorsSet;
//# sourceMappingURL=const.colors.set.js.map