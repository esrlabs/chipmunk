export function getDateTimeStr(datetime: Date | number): string {
    function fill(num: number): string {
        return num >= 10 ? num.toString() : `0${num}`;
    }
    if (typeof datetime === 'number') {
        datetime = new Date(datetime);
    }
    return `${fill(datetime.getDate())}.${fill(datetime.getMonth() + 1)} ${fill(
        datetime.getHours(),
    )}:${fill(datetime.getMinutes())}`;
}
