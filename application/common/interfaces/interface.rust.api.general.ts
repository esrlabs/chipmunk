export interface IMatchEntity {
	filter: string;
	match: string;
	row: number;
}

export interface IMapEntity {
    filter: string;
    rows: number[];
}

export interface IFilterFlags {
	reg: boolean,
	word: boolean,
	cases: boolean,
}

export interface IFilter {
	filter: string,
	flags: IFilterFlags,
}

export interface IGrabbedContent {
	grabbed_elements: IGrabbedElement[],
}

/**
 * Output for @grabStreamChunk method of session
 * (application/apps/rustcore/ts/src/native/native.session.ts)
 */
export interface IGrabbedElement {
	source_id: string,
    content: string,
	position?: number,
	row?: number,
}

/**
 * TODO: it should be removed!
 * Output for @search method of session
 * (application/apps/rustcore/ts/src/native/native.session.ts)
 */
export interface IResultSearchElement {
	position: number,	// Original position in stream
	filters: number[],  // Indexes of matched filters, fit to indexes, which was 
						// provided with search(filters: IFilter[]) 
						// (application/apps/rustcore/ts/src/native/native.session.ts)
    content: string,    // Row value
}

/**
 * Output for @search method of session
 * (application/apps/rustcore/ts/src/native/native.session.ts)
 */
 export interface ISearchResults {
	found: number;
	stats: Array<Array<number>>; // This is Array<Array<number>>
					 // Each index in root array - position in search stream
					 // Each sub index - index of filter, which has a match
}

export type ISearchMap = Array<Array<Array<number>>>;

/**
 * Output for @extract method of session
 * (application/apps/rustcore/ts/src/native/native.session.ts)
 */
export interface IExtractDTFormatResult {
    format: string;
    reg: string;
    timestamp: string;
}

/**
 * Input for @extract method of session
 * (application/apps/rustcore/ts/src/native/native.session.ts)
 */
export interface IExtractDTFormatOptions {
	input: string;
	format?: string;
}
