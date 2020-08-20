export const CRowPluginRegExp = /\u0003(.*)\u0003/gi;
export const CRowNumberRegExp = /\u0002(\d*)\u0002/gi;
export const CSourceSignatureRegExp = /\u0011(.*)\u0011/gi;
export const CRowPluginDelimiterRegExp = /\u0003/gi;
export const CRowNumberDelimiterRegExp = /\u0002/gi;
export const CDLTColumnDelimiterRegExp = /\u0004/gi;
export const CDLTArgumentDelimiterRegExp = /\u0005/gi;

/**
 * Extracts from row string data plugin ID (id of data source)
 * @param { string } rowStr - row string data
 * @returns number
 */
export function extractPluginId(rowStr: string): number {
    const value: RegExpMatchArray | null = rowStr.match(CRowPluginRegExp);
    if (value === null || value.length !== 1) {
        return -1;
    }
    value[0] = value[0].replace(CSourceSignatureRegExp, '').replace(CRowPluginDelimiterRegExp, '');
    return parseInt(value[0].trim(), 10);
}

/**
 * Extracts row number in stream
 * @param { string } rowStr - row string data
 * @returns number
 */
export function extractRowPosition(rowStr: string): number {
    const value: RegExpMatchArray | null = rowStr.match(CRowNumberRegExp);
    if (value === null || value.length !== 1) {
        return -1;
    }
    value[0] = value[0].replace(CRowNumberDelimiterRegExp, '');
    return parseInt(value[0].trim(), 10);
}

export function clearRowStr(rowStr: string): string {
    return rowStr
                .replace(CRowNumberRegExp, '')
                .replace(CRowPluginRegExp, '');
}

// TODO: Should be implemented mechanizm to cleanup output (for example during copying to clipboard)
// plugins should register cleanup-callbacks. This solution should temporary
export function fullClearRowStr(rowStr: string): string {
    return rowStr
                .replace(CRowNumberRegExp, '')
                .replace(CRowPluginRegExp, '')
                .replace(CDLTColumnDelimiterRegExp, '\t')
                .replace(CDLTArgumentDelimiterRegExp, ' ');
}
