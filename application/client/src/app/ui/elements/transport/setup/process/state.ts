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

    public getProfileNames(): string[] {
        const names: string[] = [];
        this.profiles.forEach((profile) => {
            !names.includes(profile.name) &&
                profile.envvars !== undefined &&
                names.push(profile.name);
        });
        return names;
    }
}
