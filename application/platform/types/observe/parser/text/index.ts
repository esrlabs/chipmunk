import { error } from '../../../../log/utils';
import { Protocol } from '../index';
import { Configuration as Base, ConfigurationStaticDesc } from '../../configuration';
import { Statics } from '../../../../env/decorators';
import { List, IList } from '../../description';

import * as str from '../../../../env/str';
import * as Origin from '../../origin/index';
import * as Stream from '../../origin/stream/index';
import * as Files from '../../types/file';

export type IConfiguration = null;

@Statics<ConfigurationStaticDesc<IConfiguration, Protocol>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Protocol>
    implements List, Stream.Support, Files.Support
{
    static desc(): IList {
        return {
            major: 'Plain Text',
            minor: 'Plain Text Parser ',
            icon: undefined,
        };
    }

    static alias(): Protocol {
        return Protocol.Text;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            if (configuration !== null) {
                throw new Error(`Text parser doesn't have any configuration; it should null`);
            }
            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return null;
    }

    public onOriginChange(_origin: Origin.Configuration): void {
        // Do nothing
    }

    public desc(): IList {
        return Configuration.desc();
    }

    public override hash(): number {
        return str.hash(`text`);
    }
}
