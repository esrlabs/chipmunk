function isObject(smth: any): boolean {
    if (typeof smth !== 'object' || smth === null) {
        return false;
    } else if (smth instanceof Array) {
        return false;
    } else if (
        typeof smth.constructor === 'function' &&
        typeof smth.constructor.name === 'string' &&
        smth.constructor.name.toLowerCase() !== 'object'
    ) {
        return false;
    }
    return true;
}

export function copy(obj: any): any {
    if (obj instanceof Array) {
        return obj.map((item: any) => copy(item));
    } else if (!isObject(obj)) {
        return obj;
    }
    const _obj = Object.assign({}, obj);
    Object.keys(_obj).forEach((prop: string) => {
        if (_obj[prop] instanceof Array) {
            _obj[prop] = _obj[prop].map((item: any) => copy(item));
        } else if (isObject(obj)) {
            _obj[prop] = copy(_obj[prop]);
        }
    });
    return _obj;
}
