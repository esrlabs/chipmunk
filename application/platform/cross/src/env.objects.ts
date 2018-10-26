/**
 * Finds value in object but path. Returns undefined if nothing was found
 * @param {object} target any object
 * @param {string} path path to property, splited by dots. For example: "propA.propA1.propA2"
 * @returns {any}
 */
export function getValueByPath(target: any, path: string): any {
    const parts: string[] = path.split('.');
    let obj: any = target;
    let result: any;
    let valid: boolean = true;
    if (typeof obj !== 'object' || obj === null) {
        return result;
    }
    parts.forEach((part: string, index: number) => {
        if (!valid) {
            return;
        }
        if (index === parts.length - 1) {
            // Last part
            result = obj[part];
            return;
        }
        if (typeof obj[part] !== 'object' || obj[part] === null) {
            valid = false;
            return;
        }
        obj = obj[part];
    });
    return result;
}
