import { ObserveSource } from '@service/session/dependencies/observe/source';
import { File } from '@platform/types/files';
import { Mutable } from '@platform/types/unity/mutable';
import { Provider } from '../providers/provider';
import { Base as BaseState } from '../states/state';

export class Element {
    public readonly source: ObserveSource;
    public readonly provider: Provider<BaseState>;
    public readonly id: number | undefined;
    public readonly file: File | undefined;

    constructor(source: ObserveSource, provider: Provider<BaseState>) {
        this.source = source;
        this.provider = provider;
        const session = this.provider.session;
        this.id = session.stream.observe().descriptions.id(this.source.source.alias());
    }

    public set(): { file(file: File): Element } {
        return {
            file: (file: File): Element => {
                (this as Mutable<Element>).file = file;
                return this;
            },
        };
    }

    public is(): {
        file(): boolean;
        process(): boolean;
        serial(): boolean;
        udp(): boolean;
        tcp(): boolean;
    } {
        return {
            file: (): boolean => {
                return this.file !== undefined;
            },
            process: (): boolean => {
                return this.source.source.is().process;
            },
            serial: (): boolean => {
                return this.source.source.is().serial;
            },
            udp: (): boolean => {
                return this.source.source.is().udp;
            },
            tcp: (): boolean => {
                return this.source.source.is().tcp;
            },
        };
    }
}