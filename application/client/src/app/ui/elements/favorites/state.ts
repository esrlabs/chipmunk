import { Item } from './item';
import { Filter } from '@elements/filter/filter';
import { Subject } from '@platform/env/subscription';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Holder } from '@module/matcher/holder';
import { favorites } from '@service/favorites';
import { bridge } from '@service/bridge';
import { EntityType, getFileName } from '@platform/types/files';
import { notifications, Notification } from '@ui/service/notifications';
import { createPassiveMatcheeList } from '@module/matcher';

export type CloseHandler = () => void;

const MAX_VISIBLE_ITEMS = 50;
const DEFAULT_DEEP = 5;
const DEFAULT_LEN = 20000;

export class State extends Holder {
    public filter: Filter;
    public items: Item[] = [];
    public update: Subject<void> = new Subject<void>();
    public selected: string = '';
    public roots: string[];

    protected scanning: string | undefined;
    protected folders: string[] = [];
    protected readonly abort: AbortController = new AbortController();
    protected close: CloseHandler | undefined;
    protected ilc: IlcInterface;

    constructor(ilc: IlcInterface & ChangesDetector) {
        super();
        this.roots = [];
        this.ilc = ilc;
        this.filter = new Filter(ilc, { placeholder: 'Files form favorites' });
        this.filter.subjects.get().change.subscribe((value: string) => {
            this.filtering(value);
            ilc.detectChanges();
        });
        ilc.env().subscriber.register(
            ilc
                .ilc()
                .services.ui.listener.listen<KeyboardEvent>(
                    'keyup',
                    window,
                    (event: KeyboardEvent) => {
                        if (event.key === 'ArrowDown') {
                            this.move().down();
                        } else if (event.key === 'ArrowUp') {
                            this.move().up();
                        } else if (event.key === 'Enter') {
                            const target = this.items.find((a) => a.hash() === this.selected);
                            if (target === undefined) {
                                return true;
                            }
                            this.open(target).auto();
                            return true;
                        }
                        ilc.detectChanges();
                        return true;
                    },
                ),
        );
        this.load().then(() => {
            this.items.length > 0 && (this.selected = this.items[0].hash());
        });
    }

    public destroy() {
        this.abort.abort();
    }

    public bind(close: CloseHandler) {
        this.close = close;
    }

    public loading(): string | undefined {
        return this.scanning;
    }

    public selectAndAdd(): Promise<void> {
        return favorites.places().selectAndAdd();
    }

    public isEmpty(): boolean {
        return this.roots.length === 0;
    }

    public filtering(value: string) {
        this.matcher.search(value, 'span');
        this.items.sort((a: Item, b: Item) => b.getScore() - a.getScore());
        this.move().update();
        this.update.emit();
    }

    public filtered(): Item[] {
        return this.items.filter((a: Item) => a.getScore() > 0).slice(0, MAX_VISIBLE_ITEMS);
    }

    public count(): number {
        return this.items.length;
    }

    public open(item: Item): {
        dlt(): void;
        pcap(): void;
        text(): void;
        auto(): void;
    } {
        this.close !== undefined && this.close();
        return {
            dlt: (): void => {
                this.ilc
                    .ilc()
                    .services.system.opener.file(item.filename)
                    .dlt()
                    .catch((err: Error) => {
                        this.ilc.log().error(`Fail to open text file; error: ${err.message}`);
                    });
            },
            pcap: (): void => {
                this.ilc
                    .ilc()
                    .services.system.opener.file(item.filename)
                    .pcap()
                    .catch((err: Error) => {
                        this.ilc.log().error(`Fail to open text file; error: ${err.message}`);
                    });
            },
            text: (): void => {
                this.ilc
                    .ilc()
                    .services.system.opener.file(item.filename)
                    .text()
                    .catch((err: Error) => {
                        this.ilc.log().error(`Fail to open text file; error: ${err.message}`);
                    });
            },
            auto: (): void => {
                this.ilc
                    .ilc()
                    .services.system.opener.file(item.filename)
                    .auto()
                    .catch((err: Error) => {
                        this.ilc.log().error(`Fail to open text file; error: ${err.message}`);
                    });
            },
        };
    }

    protected move(): {
        up(): void;
        down(): void;
        update(): void;
    } {
        const items = this.filtered();
        return {
            up: (): void => {
                if (items.length === 0) {
                    return;
                }
                if (this.selected === '') {
                    this.selected = items[items.length - 1].hash();
                    return;
                }
                const index = items.findIndex((a) => a.hash() === this.selected);
                if (index === -1 || index === 0) {
                    this.selected = items[items.length - 1].hash();
                    return;
                }
                this.selected = items[index - 1].hash();
            },
            down: (): void => {
                if (items.length === 0) {
                    return;
                }
                if (this.selected === '') {
                    this.selected = items[0].hash();
                    return;
                }
                const index = items.findIndex((a) => a.hash() === this.selected);
                if (index === -1 || index === items.length - 1) {
                    this.selected = items[0].hash();
                    return;
                }
                this.selected = items[index + 1].hash();
            },
            update: (): void => {
                if (items.length === 0) {
                    return;
                }
                if (this.selected === '') {
                    this.selected = items[0].hash();
                    return;
                }
                const index = items.findIndex((a) => a.hash() === this.selected);
                if (index === -1) {
                    this.selected = items[0].hash();
                }
            },
        };
    }

    public async load(): Promise<void> {
        this.items = [];
        const data = await favorites.places().get();
        this.roots = data.filter((f) => f.exists).map((f) => f.path);
        await this.includeFromFolder(this.roots).catch((err: Error) => {
            console.log(`Fail to get items from folder: ${err.message}`);
        });
        this.scanning = undefined;
        this.update.emit();
    }

    protected async includeFromFolder(paths: string[]): Promise<void> {
        if (this.abort.signal.aborted) {
            return Promise.resolve();
        }
        // User can add into favorites nested folder - we should preven duplicates in such cases
        for (const path of paths) {
            if (this.folders.indexOf(path) !== -1) {
                return Promise.resolve();
            } else {
                this.folders.push(path);
            }
        }
        let allScanning = '';
        for (const path of paths) {
            if (allScanning.length > 0) {
                allScanning = `${allScanning} - ${getFileName(path)}`;
            } else {
                allScanning = `${getFileName(path)}`;
            }
        }
        this.scanning = allScanning;
        this.update.emit();
        const data = await bridge
            .files()
            .ls({
                paths,
                depth: DEFAULT_DEEP,
                max: DEFAULT_LEN,
                include: { files: true, folders: false },
            });
        let items: Item[] = [];
        data.entities.forEach((entity) => {
            if (this.abort.signal.aborted) {
                return;
            }
            if (entity.type === EntityType.File && entity.details !== undefined) {
                items.push(
                    new Item(entity.fullname, entity.name, entity.details.path, this.matcher),
                );
            }
        });
        items = createPassiveMatcheeList<Item>(items, this.matcher);
        this.items = this.items.concat(items);
        if (this.items.length !== this.matcher.len()) {
            this.ilc.log().error(`Matcher indexes are dismatch`);
        }
        if (data.max) {
            notifications.notify(
                new Notification({
                    message: `Too many files in: ${allScanning}`,
                    actions: [],
                }),
            );
        }
        this.update.emit();
        return Promise.resolve();
    }
}
