import { StreamOpener } from '../stream';
import { SourceDefinition } from '@platform/types/transport';
import { getRenderFor } from '@schema/render/tools';
import { Render } from '@schema/render/index';
import { Session } from '../../session/session';

export class Text extends StreamOpener<{}> {
    public getRender(): Render<unknown> {
        return getRenderFor().text();
    }
    public getSettingsComponentName(): string {
        return 'app-tabs-source-textstream';
    }
    public binding(session: Session, source: SourceDefinition): Promise<void> {
        return session.stream.connect(source).text();
    }
    public after(source: SourceDefinition): Promise<void> {
        return this.services.system.recent
            .add()
            .stream(source)
            .text()
            .catch((err: Error) => {
                this.logger.error(`Fail to add recent action; error: ${err.message}`);
            });
    }
    public getStreamTabName(): string {
        return 'Text Streaming';
    }
    public getStreamSettingsTabName(): string {
        return 'Text source streaming';
    }
    public getNamedOptions(): undefined {
        return undefined;
    }
}
