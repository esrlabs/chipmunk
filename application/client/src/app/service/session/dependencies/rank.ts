export class Rank {
    static RANK_WIDTH = 8;
    static PADDING = 12;

    public len: number = 0;

    public set(length: number): boolean {
        if (this.len === length) {
            return false;
        }
        this.len = length;
        return true;
    }

    public width(): number {
        return Rank.RANK_WIDTH * this.len + Rank.PADDING * 2;
    }

    public getFiller(position: number): string {
        return '0'.repeat(this.len - position.toString().length);
    }
}
