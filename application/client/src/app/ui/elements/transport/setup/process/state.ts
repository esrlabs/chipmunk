import { ProcessTransportSettings } from '@platform/types/transport/process';
import { Base } from '../common/state';
import { ShellProfile } from '@platform/types/shells';

import * as obj from '@platform/env/obj';

export class State extends Base<ProcessTransportSettings> {
    public cwd: string = '';
    public command: string = '';
    // Previously selected envvars
    public env: { [key: string]: string } = {};
    public profiles: ShellProfile[] = [];
    // No context envvars
    public envvars: Map<string, string> = new Map();
    public current: string | undefined;

    public from(opt: ProcessTransportSettings) {
        this.cwd = opt.cwd;
        this.command = `${opt.command}`;
        const safe = obj.getSafeObj(opt.envs);
        this.env = safe instanceof Error ? {} : safe;
    }

    public asSourceDefinition(): ProcessTransportSettings {
        const safe = obj.getSafeObj(this.env);
        return {
            command: this.command,
            cwd: this.cwd,
            envs: safe instanceof Error ? {} : safe,
        };
    }

    public getValidProfiles(): ShellProfile[] {
        const valid: ShellProfile[] = [];
        this.profiles.forEach((profile) => {
            valid.find((p) => p.name === profile.name) === undefined &&
                profile.envvars !== undefined &&
                valid.push(profile);
        });
        return valid;
    }

    public importEnvvarsFromShell(profile: ShellProfile | undefined) {
        if (profile === undefined) {
            this.current = undefined;
            this.env = obj.mapToObj(this.envvars);
        } else {
            if (profile.envvars === undefined) {
                return;
            }
            this.env = obj.mapToObj(profile.envvars);
            this.current = profile.name;
        }
    }

    public getSelectedEnvs(): Map<string | number | symbol, string> {
        return obj.objToMap<string>(this.env);
    }

    public isShellSelected(profile: ShellProfile): boolean {
        return profile.name === this.current;
    }
}
