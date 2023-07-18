import { error } from '../../../../../log/utils';
import { Source } from '../index';
import { Configuration as Base, ConfigurationStaticDesc } from '../../../configuration';
import { OriginDetails, IOriginDetails, IList, Job, IJob, OriginType } from '../../../description';
import { Statics } from '../../../../../env/decorators';

import * as obj from '../../../../../env/obj';
import * as Parser from '../../../parser';
import * as Sde from '../../../sde';
import * as str from '../../../../../env/str';

export interface IConfiguration {
    path: string;
    baud_rate: number;
    data_bits: number;
    flow_control: number;
    parity: number;
    stop_bits: number;
}

@Statics<ConfigurationStaticDesc<IConfiguration, Source>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Source>
    implements OriginDetails, Sde.Support, Job
{
    public MARKER = 'application/platform/types/observe/origin/stream/serial/index.ts';

    static desc(): IList {
        return {
            major: `Serial Port`,
            minor: 'Connection to Serial Port',
            icon: 'import_export',
        };
    }

    static alias(): Source {
        return Source.Serial;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            obj.getAsNotEmptyString(configuration, 'path');
            obj.getAsValidNumber(configuration, 'baud_rate');
            obj.getAsValidNumber(configuration, 'data_bits');
            obj.getAsValidNumber(configuration, 'flow_control');
            obj.getAsValidNumber(configuration, 'parity');
            obj.getAsValidNumber(configuration, 'stop_bits');
            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return {
            baud_rate: 9600,
            data_bits: 8,
            flow_control: 0,
            parity: 0,
            path: '',
            stop_bits: 1,
        };
    }

    public desc(): IOriginDetails {
        return {
            major: this.configuration.path,
            minor: `Baud Rate: ${this.configuration.baud_rate}`,
            icon: 'import_export',
            action: 'Connect',
            type: OriginType.serial,
            state: {
                running: 'listening',
                stopped: '',
            },
        };
    }

    public asJob(): IJob {
        return {
            name: `Serial: ${this.configuration.path}`,
            desc: `Baud Rate: ${this.configuration.baud_rate}`,
            icon: 'import_export',
        };
    }

    public getSupportedParsers(): Parser.Reference[] {
        return [Parser.Text.Configuration];
    }

    public override hash(): number {
        return str.hash(
            `${this.configuration.path};${this.configuration.baud_rate};${this.configuration.data_bits};${this.configuration.flow_control};${this.configuration.parity};${this.configuration.stop_bits}`,
        );
    }
}
