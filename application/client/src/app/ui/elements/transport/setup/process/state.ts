import { ProcessTransportSettings } from '@platform/types/transport/process';
import { Base } from '../common/state';

import * as obj from '@platform/env/obj';

export class State extends Base<ProcessTransportSettings> {
    public cwd: string = '';
    public command: string = '';
    public env: { [key: string]: string } = {};

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
}
