function serializeStringForReg(str: string){
    let chars = '\\{}[]+$^/!.*|():?,=';
    Array.prototype.forEach.call(chars, (char: string) => {
        str = str.replace(new RegExp('\\' + char, 'gi'), '\\' + char);
    });
    return str;
};

let isValidRegExpCache = {};

function isValidRegExp(strRegExp: string, parameters: string = 'gi'){
    if (typeof strRegExp !== 'string') {
        return false;
    }
    if (isValidRegExpCache[strRegExp] !== void 0) {
        return isValidRegExpCache[strRegExp];
    }
    try {
        let regExp = new RegExp(strRegExp, parameters);
        if (regExp instanceof RegExp) {
            isValidRegExpCache[strRegExp] = true;
            return true;
        }
    } catch (error){
    }
    return false;
}

let safelyCreateRegExpCache = {};

function safelyCreateRegExp(strRegExp: string, parameters: string = 'gi'){
    if (typeof strRegExp !== 'string') {
        return null;
    }
    if (safelyCreateRegExpCache[strRegExp] !== void 0) {
        return safelyCreateRegExpCache[strRegExp];
    }
    if (isValidRegExp(strRegExp, parameters)) {
        strRegExp = strRegExp.replace(/\\/gi, '\\');
        safelyCreateRegExpCache[strRegExp] = new RegExp(strRegExp, parameters);
    } else if (isValidRegExp(serializeStringForReg(strRegExp), parameters)) {
        safelyCreateRegExpCache[strRegExp] = new RegExp(serializeStringForReg(strRegExp), parameters);
    } else {
        safelyCreateRegExpCache[strRegExp] = new RegExp('','');
    }
    return safelyCreateRegExpCache[strRegExp];
}

export { serializeStringForReg, isValidRegExp, safelyCreateRegExp };