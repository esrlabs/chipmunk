"use strict";
function serializeStringForReg(str) {
    var chars = '\\{}[]+$^/!.*|():?,=';
    Array.prototype.forEach.call(chars, function (char) {
        str = str.replace(new RegExp('\\' + char, 'gi'), '\\' + char);
    });
    return str;
}
exports.serializeStringForReg = serializeStringForReg;
;
var isValidRegExpCache = {};
function isValidRegExp(strRegExp, parameters) {
    if (parameters === void 0) { parameters = 'gi'; }
    if (typeof strRegExp !== 'string') {
        return false;
    }
    if (isValidRegExpCache[strRegExp] !== void 0) {
        return isValidRegExpCache[strRegExp];
    }
    try {
        var regExp = new RegExp(strRegExp, parameters);
        if (regExp instanceof RegExp) {
            isValidRegExpCache[strRegExp] = true;
            return true;
        }
    }
    catch (error) {
    }
    return false;
}
exports.isValidRegExp = isValidRegExp;
var safelyCreateRegExpCache = {};
function safelyCreateRegExp(strRegExp, parameters) {
    if (parameters === void 0) { parameters = 'gi'; }
    if (typeof strRegExp !== 'string') {
        return null;
    }
    if (safelyCreateRegExpCache[strRegExp] !== void 0) {
        return safelyCreateRegExpCache[strRegExp];
    }
    if (isValidRegExp(strRegExp, parameters)) {
        safelyCreateRegExpCache[strRegExp] = new RegExp(strRegExp, parameters);
    }
    else if (isValidRegExp(serializeStringForReg(strRegExp), parameters)) {
        safelyCreateRegExpCache[strRegExp] = new RegExp(serializeStringForReg(strRegExp), parameters);
    }
    else {
        safelyCreateRegExpCache[strRegExp] = new RegExp('', '');
    }
    return safelyCreateRegExpCache[strRegExp];
}
exports.safelyCreateRegExp = safelyCreateRegExp;
//# sourceMappingURL=tools.regexp.js.map