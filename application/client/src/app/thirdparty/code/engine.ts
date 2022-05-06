import * as scorer from './scorer';
import { URI } from './uri';
import path from './path';
import { IMatch } from './filters';

class FileResourceAccessorClass implements scorer.IItemAccessor<URI> {
    getItemLabel(resource: URI): string {
        return path.basename(resource.fsPath);
    }

    getItemDescription(resource: URI): string {
        return path.dirname(resource.fsPath);
    }

    getItemPath(resource: URI): string {
        return resource.fsPath;
    }
}

export interface IPair {
    id: string;
    caption: string;
    description: string;
    tcaption?: string;
    tdescription?: string;
    score?: IItemScore;
}

class PairResourceAccessorClass implements scorer.IItemAccessor<IPair> {
    getItemLabel(pair: IPair): string {
        return pair.caption;
    }

    getItemDescription(pair: IPair): string {
        return pair.description;
    }

    getItemPath(pair: IPair): string {
        return pair.description;
    }
}

const FileResourceAccessor = new FileResourceAccessorClass();

const PairResourceAccessor = new PairResourceAccessorClass();

const cache: scorer.ScorerCache = Object.create(null);

type IItemScore = scorer.IItemScore;

export { IItemScore, IMatch };

export interface ISortedFile {
    [key: string]: any;
    file: string;
    basename: string;
    dirname: string;
    tbasename: string;
    tdirname: string;
    score?: IItemScore;
}

export interface IFileInfo {
    [key: string]: any;
    file: string;
}

export function sortFiles(
    files: Array<IFileInfo | ISortedFile>,
    query: string,
    removeZeroScore: boolean,
    matchTag?: string,
): ISortedFile[] {
    let rates: ISortedFile[] = files.map((file: IFileInfo) => {
        const desc = URI.file(file.file);
        const score = scorer.scoreItem(
            desc,
            scorer.prepareQuery(query),
            true,
            FileResourceAccessor,
            cache,
        );
        const basename: string = path.basename(desc.fsPath);
        const dirname: string = path.dirname(desc.fsPath);
        file.basename = basename;
        file.dirname = dirname;
        file.tbasename =
            matchTag !== undefined ? wrapMatch(basename, matchTag, score.labelMatch) : basename;
        file.tdirname =
            matchTag !== undefined ? wrapMatch(dirname, matchTag, score.descriptionMatch) : dirname;
        file.score = score;
        return file as ISortedFile;
    });
    rates.sort((a, b) => {
        return (b.score as any).score - (a.score as any).score;
    });
    if (removeZeroScore) {
        rates = rates.filter((rate: ISortedFile) => {
            return (rate.score as any).score > 0;
        });
    }
    return rates.map((rate: ISortedFile) => {
        rate.score = undefined;
        return rate;
    });
}

export function sortPairs(
    pairs: Array<IPair>,
    query: string,
    removeZeroScore: boolean,
    matchTag?: string,
): IPair[] {
    let rates: IPair[] = pairs.map((pair: IPair) => {
        const score = scorer.scoreItem(
            pair,
            scorer.prepareQuery(query),
            true,
            PairResourceAccessor,
            cache,
        );
        pair.tcaption =
            matchTag !== undefined
                ? wrapMatch(pair.caption, matchTag, score.labelMatch)
                : pair.caption;
        pair.tdescription =
            matchTag !== undefined
                ? wrapMatch(pair.description, matchTag, score.descriptionMatch)
                : pair.description;
        pair.score = score;
        return pair as IPair;
    });
    rates.sort((a, b) => {
        return (b.score as any).score - (a.score as any).score;
    });
    if (removeZeroScore) {
        rates = rates.filter((rate: IPair) => {
            return (rate.score as any).score > 0;
        });
    }
    return rates.map((rate: IPair) => {
        rate.score = undefined;
        return rate;
    });
}

export function wrapMatch(input: string, tag: string, match?: IMatch[]): string {
    if (match === undefined) {
        return input;
    }
    match.sort((a, b) => {
        return b.end - a.end;
    });
    match.forEach((m: IMatch) => {
        input = input.substring(0, m.end) + `</${tag}>` + input.substring(m.end, input.length);
        input = input.substring(0, m.start) + `<${tag}>` + input.substring(m.start, input.length);
    });
    return input;
}
