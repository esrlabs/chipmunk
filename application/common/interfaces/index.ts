import * as DLT from './interface.dlt';
import * as NodeGlobal from './interface.node.global';

export { DLT, NodeGlobal };

// describes a section of a file by indicies
// to identify lines 10-12 (inclusively) => first_line = 10, last_line = 12
// to identify only line 13: first_line = 13, last_line = 13
export interface IIndexSection {
	first_line: number;
	last_line: number;
}
export interface IFileSaveParams {
	sections: Array<IIndexSection>;
}