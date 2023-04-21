import { ObserveSource } from '@service/session/dependencies/observing/source';
import { File } from '@platform/types/files';
import { Mutable } from '@platform/types/unity/mutable';
import { Provider } from '@service/session/dependencies/observing/provider';

export class Element {
    public readonly source: ObserveSource;
    public readonly provider: Provider;
    public readonly id: number | undefined;
    public readonly file: File | undefined;
    public selected: boolean = false;

    constructor(source: ObserveSource, provider: Provider) {
        this.source = source;
        this.provider = provider;
        const session = this.provider.session;
        this.id = session.stream.observe().descriptions.id(this.source.source.alias());
        this.selected = session.stream.sde.selecting().is(this.source.source.uuid);
    }

    public select(): void {
        const sde = this.provider.session.stream.sde;
        this.selected = sde.selecting().select(this.source.source.uuid);
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
