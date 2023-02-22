import { getNativeModule } from './native';
import { error } from '../util/logging';
import { ShellProfile } from 'platform/types/shells';

export { ShellProfile };

export function getValidProfiles(): Promise<ShellProfile[]> {
    const ShellsRef = getNativeModule().Shells;
    const shells = new ShellsRef();
    return new Promise((resolve, reject) => {
        shells
            .getValidProfiles()
            .then((str: string) => {
                try {
                    const unparsed: unknown[] = JSON.parse(str);
                    const profiles: ShellProfile[] = [];
                    unparsed.forEach((unparsed: unknown) => {
                        const profile = ShellProfile.fromObj(unparsed);
                        if (!(profile instanceof Error)) {
                            profiles.push(profile);
                        }
                    });
                    resolve(profiles);
                } catch (e) {
                    reject(new Error(error(e)));
                }
            })
            .catch((err: unknown) => {
                reject(new Error(error(err)));
            });
    });
}

export function getContextEnvvars(): Promise<Map<string, string>> {
    const ShellsRef = getNativeModule().Shells;
    const shells = new ShellsRef();
    return new Promise((resolve, reject) => {
        shells
            .getContextEnvvars()
            .then((str: string) => {
                try {
                    const unparsed: { [key: string]: string } = JSON.parse(str);
                    const envvars: Map<string, string> = new Map();
                    if (
                        unparsed === undefined ||
                        unparsed === null ||
                        typeof unparsed !== 'object'
                    ) {
                        return reject(new Error(`Fail to parse envvars string: ${unparsed}`));
                    }
                    Object.keys(unparsed).forEach((key) => {
                        envvars.set(key, unparsed[key]);
                    });
                    resolve(envvars);
                } catch (e) {
                    reject(new Error(error(e)));
                }
            })
            .catch((err: unknown) => {
                reject(new Error(error(err)));
            });
    });
}
