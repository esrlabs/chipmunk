import { ProcessTransportSettings } from '@platform/types/transport/process';
import { Base } from '../common/state';

export class State extends Base<ProcessTransportSettings> {
    public cmd: string = '';
    public command: string = '';

    public from(opt: ProcessTransportSettings) {
        this.cmd = opt.cmd;
        this.command = opt.command;
    }

    public asSourceDefinition(): ProcessTransportSettings {
        const parts = this.command.split(' ');
        return {
            command: parts[0],
            cmd: this.cmd,
            args: parts.slice(1),
            envs: {},
        };
    }
}
