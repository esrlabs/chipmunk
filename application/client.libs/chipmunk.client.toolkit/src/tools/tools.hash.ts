// tslint:disable:no-bitwise

export function hash(str: string): string {
    let result = 0;
    let chr;
    if (str.length === 0) {
        return result.toString(16);
    }
    for (let i = 0; i < str.length; i++) {
      chr   = str.charCodeAt(i);
      result  = ((result << 5) - result) + chr;
      result |= 0;
    }
    return result.toString(16);
}
