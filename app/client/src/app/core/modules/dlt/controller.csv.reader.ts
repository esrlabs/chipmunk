import DLTService from './service.dlt';
import * as IDlt from './dlt.interface';
import { IReader } from './reader.interface';

const CEntriesFormat = [
    { entry: IDlt.CExpectedEntries.time, length: 30 },
    { entry: IDlt.CExpectedEntries.ecuid, length: 6 },
    { entry: IDlt.CExpectedEntries.ctid, length: 6 },
    { entry: IDlt.CExpectedEntries.sessionid, length: 10 },
    { entry: IDlt.CExpectedEntries.type, length: 10 },
    { entry: IDlt.CExpectedEntries.subtype, length: 10 },
    { entry: IDlt.CExpectedEntries.mode, length: -1 },
    { entry: IDlt.CExpectedEntries.payload, length: -1 },
];

export class CSVDecoder implements IReader {

    constructor() {

    }
    
    public read(description: string, str: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.decode(str).then((res: IDlt.TDecodeResult) => {
                DLTService.create(description, res);
                resolve();
            }).catch(reject);
        });
    }

    public decode(str: string): Promise<IDlt.TDecodeResult> {
        return new Promise((resolve, reject) => {
            this._extractEntriesNames(str).then((description: { rows: string[], entryNames: string[] }) => {
                const rows: string[] = [];
                const entries: IDlt.IEntry[] = description.rows.filter((row: string) => {
                    return row.trim() !== '';
                }).map((row: string, rowIndex: number) => {
                    const parts: string[] = row.split('","');
                    parts[0] = parts[0].replace(/^"/gi, '');
                    parts[parts.length - 1] = parts[parts.length - 1].replace(/"$/gi, '');
                    const entry: IDlt.IEntry = {};
                    description.entryNames.forEach((entryName: string, index: number) => {
                        if (entryName === '') {
                            return;
                        }
                        if (parts[index] === void 0) {
                            throw new Error(`Row #${rowIndex} has worng length of entries. Row = "${row}"`);
                        }
                        entry[entryName] = parts[index];
                    });
                    rows.push(this._getRowFromEntry(entry));
                    return entry;
                });
                resolve({
                    entries: entries,
                    entryNames: description.entryNames,
                    rows: rows
                });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _getRowFromEntry(entry: IDlt.IEntry): string {
        let row = '';
        CEntriesFormat.forEach((description) => {
            if (entry[description.entry] === void 0) {
                return;
            }
            if (description.length < 0) {
                row += ` ${entry[description.entry]}`;
                return;
            }
            const length = entry[description.entry].length;
            row += entry[description.entry] + ' '.repeat(description.length - length);
        });
        return row;
    }

    private _extractEntriesNames(str: string): Promise<{ rows: string[], entryNames: string[] }> {
        return new Promise((resolve, reject) => {
            let rows: string[] = str.split(/[\n\r]/gi);
            if (rows.length === 0) {
                return reject(new Error(`No content found, where entries data can be extracted.`));
            }
            let entryNames: string[] = rows[0].split(',');
            if (entryNames.length <= 1) {
                return reject(new Error(`No entries found in first row of string`));
            }
            const notValidEntries: string[] = [];
            entryNames = entryNames.map((entryName: string) => {
                const entry = entryName.replace(/[^\w]/gi, '').toLowerCase();
                if (IDlt.CExpectedEntries[entry] === void 0) {
                    console.warn(`Unexpected DLT entry name: ${entry}. Available: ${Object.keys(IDlt.CExpectedEntries).join(', ')}`);
                    notValidEntries.push(entry);
                    return '';
                }
                return entry;
            });
            if (notValidEntries.length !== 0) {
                console.warn(`DLT CSV has not valid entries: ${notValidEntries.join(', ')}`);
            }
            const missedEntries: string[] = [];
            Object.keys(IDlt.CObligatoryEntries).forEach((obligatoryEntry: string) => {
                if (entryNames.indexOf(obligatoryEntry) === -1) {
                    missedEntries.push(obligatoryEntry);
                }
            });
            if (missedEntries.length > 0) {
                return reject(new Error(`Missed entries: ${missedEntries.join(', ')}.`));
            }
            rows.splice(0, 1);
            resolve({
                rows: rows,
                entryNames: entryNames
            });
        });
    }

}