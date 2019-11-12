/**
 * Row information (stream line)
 */
export interface IRowInfo {

    /**
     * @property {number} position - absolute position of line in stream
     */
    position?: number;

    /**
     * @property {string} sourceName - name of source
     */
    sourceName?: string;

    /**
     * @property {boolean} hasOwnStyles - true - row has definition of own styles; false - doesn't have
     */
    hasOwnStyles?: boolean;
}
