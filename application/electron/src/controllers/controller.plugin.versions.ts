
/**
 * @class ControllerPluginVersions
 * @description Provide parser for version checks
 */

export default class ControllerPluginVersions {

    public static getVersionError(version: string): Error | undefined {
        const parts: string[] = version.split('.');
        if (parts.length !== 3) {
            return new Error(`Version "${version}" isn't valid. Correct version defintion "xx.xx.xx", for example: 01.12.03.`);
        }
        for (let i = parts.length - 1; i >= 0; i -= 1) {
            if (parts[i].length === 0) {
                return new Error(`Version "${version}" isn't valid. Each version path should have always 2 digits: "xx.xx.xx", for example: 01.12.03`);
            }
        }
        const rate: number = ControllerPluginVersions.getVersionRate(version);
        if (isNaN(rate) || !isFinite(rate)) {
            return new Error(`Version "${version}" isn't valid. Rate of version is invalid: "${rate}". Correct version defintion "xx.xx.xx", for example: 01.12.03.`);
        }
        return undefined;
    }

    public static getVersionRate(version: string): number {
        return parseInt(ControllerPluginVersions.getVersionToRate(version).replace(/\./gi, ''), 10);
    }

    public static getVersionToRate(version: string): string {
        const parts: string[] = version.split('.').map((part: string) => {
            return part.length === 1 ? `${part}0` : part;
        });
        return parts.join('');
    }

}
