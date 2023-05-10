import { StreamOpener } from '../stream';
import { SourceDefinition } from '@platform/types/transport';
import { getRenderFor } from '@schema/render/tools';
import { Render } from '@schema/render/index';
import { Session } from '../../session/session';
import { ISomeIpOptions } from '@platform/types/parsers/someip';

export class SomeIp extends StreamOpener<ISomeIpOptions> {
    public getRender(): Render<unknown> {
        return getRenderFor().someip();
    }
    public getSettingsComponentName(): string {
        return 'app-tabs-source-dltstream';
        // TODO: create component >>>>>>>>>>>>>>>>>>>>>>
    }
    public binding(
        session: Session,
        source: SourceDefinition,
        options: ISomeIpOptions,
    ): Promise<void> {
        return session.stream.connect(source).someip(options);
    }
    public after(source: SourceDefinition, options?: ISomeIpOptions): Promise<void> {
        if (options === undefined) {
            return Promise.reject(new Error(`Options for DLT stream has to be defined`));
        }
        return this.services.system.recent
            .add()
            .stream(source)
            .someip(options)
            .catch((err: Error) => {
                this.logger.error(`Fail to add recent action; error: ${err.message}`);
            });
    }

    public getStreamSettingsTabName(): string {
        return 'SomeIp content streaming';
    }
}
