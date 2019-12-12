export function copy(obj: any): any {
    if (obj instanceof Array) {
        return obj.map(item => copy(item));
    } else if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    const _obj = Object.assign({}, obj);
    Object.keys(_obj).forEach((prop: string) => {
        if (_obj[prop] instanceof Array) {
            _obj[prop] = _obj[prop].map(item => copy(item));
        } else if (typeof _obj[prop] === 'object' && _obj[prop] !== null) {
            _obj[prop] = copy(_obj[prop]);
        }
    });
    return _obj;
}