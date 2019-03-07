import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
/*
import * as AnsiCommands from '../tools/tools.ansi.commands';
import { ansiToHTML } from '../tools/tools.ansi.colors';
*/

export interface IStreamPacket {
    original: string;
    pluginId: number;
}

export class ControllerSessionStreamOutput extends DataSource<IStreamPacket> {

    private _dataStream: BehaviorSubject<IStreamPacket[]> = new BehaviorSubject<IStreamPacket[]>([]);
    private _rows: IStreamPacket[] = [];
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _cursor: number = 0;

    constructor() {
        super();
    }

    public connect(collectionViewer: CollectionViewer): Observable<IStreamPacket[]> {
        return this._dataStream;
    }

    public disconnect(): void {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public write(input: string, pluginId: number): IStreamPacket {
        if (this._rows.length === 0) {
            this.next();
        }
        const index = this._rows.length - 1;
        this._rows[index].original += input;
        this._rows[index].pluginId = pluginId;
        this._dataStream.next(this._rows);
        return this._rows[index];
    }

    public next() {
        const last: number = this._rows.length - 1;
        if (last >= 0) {
            // Here parsers should be called
            // this._rows[last] = ansiToHTML(this._rows[last]);
        }
        this._rows.push({
            original: '',
            pluginId: -1
        });
        this._cursor = 0;
        this._dataStream.next(this._rows);
    }

    public clearStream() {
        this._rows = [];
        this._dataStream.next(this._rows);
    }

    /*
    private _isInput(input: string) {
        const code: number = input.charCodeAt(0);
        switch (code) {
            case 8: // BACKSPACE
            case 38: // UP ARROW
            case 40: // DOWN ARROW
            case 46: // DELETE (NUM)
            case 37: // LEFT ARROW
            case 39: // RIGHT ARROW
                return true;
            default:
                return false;
        }
    }

    private _applyAsOutput(target: string, input: string) {
        return target + input;
    }

    private _applyAsInput(target: string, input: string) {
        for (let i = 0, length = input.length - 1; i <= length; i += 1) {
            const code: number = input.charCodeAt(i);
            switch (code) {
                case 8: // BACKSPACE
                    target = target.substr(0, target.length - 1);
                    this._cursor -= 1;
                    break;
                case 38: // UP ARROW
                case 40: // DOWN ARROW
                case 46: // DELETE (NUM)
                    // Ignore
                    if (this._cursor !== target.length) {
                        // Add into middle
                        target = target.substr(0, this._cursor) + input[i] + target.substr(this._cursor, target.length);
                    } else {
                        // Add to the end
                        target += input[i];
                    }
                    this._cursor += 1;
                    console.log(`CODE: ${code}`);
                    break;
                case 37: // LEFT ARROW
                    this._cursor -= 1;
                    break;
                case 39: // RIGHT ARROW
                    this._cursor += 1;
                    if (this._cursor > target.length - 1) {
                        this._cursor = target.length;
                    }
                    break;
                case 27:
                    // ESCAPE
                    const cmdInfo: AnsiCommands.IResults = AnsiCommands.next(input.substr(i, input.length));
                    if (cmdInfo.command === undefined) {
                        break;
                    }
                    i += cmdInfo.offset;
                    switch (cmdInfo.command) {
                        case AnsiCommands.EAnsiCommands.clear:
                        case AnsiCommands.EAnsiCommands.color:
                        case AnsiCommands.EAnsiCommands.right:
                        case AnsiCommands.EAnsiCommands.down:
                        case AnsiCommands.EAnsiCommands.report:
                        case AnsiCommands.EAnsiCommands.screen:
                        case AnsiCommands.EAnsiCommands.save:
                            // Ignore commands
                            break;
                        case AnsiCommands.EAnsiCommands.position:
                        case AnsiCommands.EAnsiCommands.pos:
                        case AnsiCommands.EAnsiCommands.up:
                            // TODO: add support
                            break;
                        case AnsiCommands.EAnsiCommands.left:
                            this._cursor -= 1;
                            break;
                        default:
                            console.log(`COMMAND CODE: ${code}`);
                    }
                    break;
                default:
                    if (this._cursor !== target.length) {
                        // Add into middle
                        target = target.substr(0, this._cursor) + input[i] + target.substr(this._cursor, target.length);
                    } else {
                        // Add to the end
                        target += input[i];
                    }
                    this._cursor += 1;
                    break;
            }
        }
        return target;

    }


    private _getEscapeCommand(input: string) {

    }
    */
}
