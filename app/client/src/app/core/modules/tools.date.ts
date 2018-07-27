function fill(value: number, count: number = 2) {
    const str = `${value}`;
    const less =  count - str.length;
    return `${'0'.repeat(less >= 0 ? less : 0)}${str}`;
}

export function timestampToDDMMYYYYhhmmSSsss(timestamp: number) {
    const date = new Date(timestamp);
    return `${fill(date.getDate(), 2)}.${fill(date.getMonth(), 2)}.${date.getFullYear()} ${fill(date.getHours(), 2)}:${fill(date.getMinutes(), 2)}:${fill(date.getSeconds(), 2)}.${fill(date.getMilliseconds(), 3)}`;
}
