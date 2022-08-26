import { StreamOpener } from '../stream';
import { SourceDefinition } from '@platform/types/transport';
import { getRenderFor } from '@schema/render/tools';
import { Render } from '@schema/render/index';
import { Session } from '../../session/session';
import { IDLTOptions } from '@platform/types/parsers/dlt';

export class Dlt extends StreamOpener<IDLTOptions> {
    public getRender(): Render<unknown> {
        return getRenderFor().dlt();
    }
    public getSettingsComponentName(): string {
        return 'app-tabs-source-dltstream';
    }
    public binding(
        session: Session,
        source: SourceDefinition,
        options: IDLTOptions,
    ): Promise<void> {
        return session.stream.connect(source).dlt(options);
    }
    public after(source: SourceDefinition, options?: IDLTOptions): Promise<void> {
        if (options === undefined) {
            return Promise.reject(new Error(`Options for DLT stream has to be defined`));
        }
        return this.services.system.recent
            .add()
            .stream(source)
            .dlt(options)
            .catch((err: Error) => {
                this.logger.error(`Fail to add recent action; error: ${err.message}`);
            });
    }
    public getStreamTabName(): string {
        return 'Dlt Streaming';
    }
    public getStreamSettingsTabName(): string {
        return 'DLT content streaming';
    }
}
