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
}

/**
 * Output for @grabSearchChunk method of session
 * (application/apps/rustcore/ts/src/native/native.session.ts)
 */
export interface IGrabbedSearchElement {
	source_id: string,	// Id of source
	position: number, 	// Original position in stream
    content: string, 	// Row value
}

/**
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
