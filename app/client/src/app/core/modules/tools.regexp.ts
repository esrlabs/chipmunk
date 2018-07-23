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
    const key = `__${strRegExp}__`;
    if (isValidRegExpCache[key] !== void 0) {
        return isValidRegExpCache[key];
    }
    try {
        let regExp = new RegExp(strRegExp, parameters);
        if (regExp instanceof RegExp) {
            isValidRegExpCache[key] = true;
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
    const key = `__${strRegExp}__`;
    if (safelyCreateRegExpCache[key] !== void 0) {
        return safelyCreateRegExpCache[key];
    }
    if (isValidRegExp(strRegExp, parameters)) {
        strRegExp = strRegExp.replace(/\\/gi, '\\');
        safelyCreateRegExpCache[key] = new RegExp(strRegExp, parameters);
    } else if (isValidRegExp(serializeStringForReg(strRegExp), parameters)) {
        safelyCreateRegExpCache[key] = new RegExp(serializeStringForReg(strRegExp), parameters);
    } else {
        safelyCreateRegExpCache[key] = new RegExp('','');
    }
    return safelyCreateRegExpCache[key];
}

export { serializeStringForReg, isValidRegExp, safelyCreateRegExp };