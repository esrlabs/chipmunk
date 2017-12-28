function serializeStringForReg(str: string){
    let chars = '{}[]+$^/!.*|\\():?,=';
    Array.prototype.forEach.call(chars, (char: string) => {
        str = str.replace(new RegExp('\\' + char, 'gi'), '\\' + char);
    });
    return str;
};

export { serializeStringForReg };