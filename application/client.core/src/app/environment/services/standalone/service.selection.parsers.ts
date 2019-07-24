import * as Toolkit from 'logviewer.client.toolkit';
import { Observable, Subject } from 'rxjs';

export interface ISelectionParser {
    guid: string;
    name: string;
}

export interface IStoredSelectionParser {
    parser: Toolkit.ASelectionParser;
    pluginId: number;
}

export interface IUpdateEvent {
    caption: string;
    selection: string;
    parsed: string;
}

type TGuid = string;

export class SelectionParsersService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('SelectionParsersService');
    private _parsers: Map<TGuid, IStoredSelectionParser> = new Map();
    private _subjects: {
        onUpdate: Subject<IUpdateEvent>,
    } = {
        onUpdate: new Subject<IUpdateEvent>(),
    };

    public getObservable(): {
        onUpdate: Observable<IUpdateEvent>,
    } {
        return {
            onUpdate: this._subjects.onUpdate.asObservable(),
        };
    }

    public setParsers(exports: Toolkit.IPluginExports, pluginId: number) {
        if (typeof exports !== 'object' || exports === null) {
            return new Error(this._logger.warn(`Fail to setup parser because exports isn't an object.`));
        }
        Object.keys(exports).forEach((key: string) => {
            const entity: Toolkit.TPluginExportEntity = exports[key];
            if (Toolkit.ASelectionParser.isInstance(entity)) {
                this._parsers.set(Toolkit.guid(), {
                    parser: entity as Toolkit.ASelectionParser,
                    pluginId: pluginId,
                });
            }
        });
    }

    public getParsers(selection: string): ISelectionParser[] {
        const parsers: ISelectionParser[] = [];
        this._parsers.forEach((stored: IStoredSelectionParser, guid: TGuid) => {
            const name: string | undefined = stored.parser.getParserName(selection);
            if (name === undefined) {
                return;
            }
            parsers.push({ guid: guid, name: name });
        });
        return parsers;
    }

    public parse(selection: string, guid: TGuid, caption: string) {
        const parser: IStoredSelectionParser | undefined = this._parsers.get(guid);
        if (parser === undefined) {
            return;
        }
        this._subjects.onUpdate.next({
            caption: caption,
            selection: selection,
            parsed: parser.parser.parse(selection, Toolkit.EThemeType.dark),
        });
    }

    public memo(content: string, caption: string) {
        this._subjects.onUpdate.next({
            caption: caption,
            selection: content,
            parsed: undefined
        });
    }

    private _show() {
        // fd
    }
}

export default (new SelectionParsersService());
