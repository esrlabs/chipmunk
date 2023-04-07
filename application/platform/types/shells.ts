import { utils } from '../log';
import * as obj from '../env/obj';

export class ShellProfile {
    public readonly name: string;
    public readonly path: string;
    public readonly envvars: Map<string, string> | undefined;
    public readonly symlink: boolean;

    public static fromObj(smth: unknown): ShellProfile | Error {
        try {
            const name: string = obj.getAsNotEmptyString(smth, 'name');
            const path: string = obj.getAsNotEmptyString(smth, 'path');
            const symlink: boolean = obj.getAsBool(smth, 'symlink');
            let envvars: Map<string, string> | undefined = undefined;
            if ((smth as any).envvars instanceof Map) {
                envvars = (smth as any).envvars;
            } else if (
                (smth as any).envvars !== null &&
                (smth as any).envvars !== undefined &&
                typeof (smth as any).envvars === 'object'
            ) {
                envvars = new Map();
                Object.keys((smth as any).envvars).forEach((key: string) => {
                    envvars?.set(key, (smth as any).envvars[key]);
                });
            }
            return new ShellProfile(name, path, symlink, envvars);
        } catch (err) {
            return new Error(utils.error(err));
        }
    }

    public static fromStr(str: string): ShellProfile | Error {
        try {
            const profile = JSON.parse(str);
            const name: string = obj.getAsNotEmptyString(profile, 'name');
            const path: string = obj.getAsNotEmptyString(profile, 'path');
            const symlink: boolean = obj.getAsBool(profile, 'symlink');
            let envvars: Map<string, string> | undefined = undefined;
            if (
                profile.envvars !== null &&
                profile.envvars !== undefined &&
                typeof profile.envvars === 'object'
            ) {
                envvars = new Map();
                Object.keys(profile.envvars).forEach((key: string) => {
                    envvars?.set(key, profile.envvars[key]);
                });
            }
            return new ShellProfile(name, path, symlink, envvars);
        } catch (err) {
            return new Error(utils.error(err));
        }
    }

    constructor(
        name: string,
        path: string,
        symlink: boolean,
        envvars: Map<string, string> | undefined,
    ) {
        this.path = path;
        this.name = name;
        this.symlink = symlink;
        this.envvars = envvars;
    }

    public getEnvvarsCount(): number {
        return this.envvars === undefined ? 0 : this.envvars.size;
    }
}
