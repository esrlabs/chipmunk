export interface IMatchEntity {
	filter: string;
	match: string;
	row: number;
}

export interface IMapEntity {
    filter: string;
    rows: number[];
}

export interface ISearchFilter {
	value: string,
	is_regex: boolean,
	case_sensitive: boolean,
	is_word: boolean,
}

export interface IGrabbedContent {
	grabbed_elements: IGrabbedElement[],
}

export interface IGrabbedElement {
    source_id: string,
    content: string,
}
