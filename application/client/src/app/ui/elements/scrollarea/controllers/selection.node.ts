export class SelectionNode {
	public static select(parent: HTMLElement, path: string): Node | null {
		let selector: string = path;
		let textNodeIndex: number = -1;
		if (selector.indexOf('#text') !== -1) {
			const parts: string[] = selector.split(`#text:`);
			if (parts.length !== 2) {
				return null;
			}
			textNodeIndex = parseInt(parts[1], 10);
			if (isNaN(textNodeIndex) || !isFinite(textNodeIndex)) {
				return null;
			}
			selector = selector.replace(/#text:\d*/gi, '').trim();
		}
		let node: ChildNode | null = parent.querySelector(selector);
		if (node === null) {
			return null;
		}
		if (textNodeIndex !== -1 && node.childNodes.length === 0) {
			return null;
		}
		if (textNodeIndex !== -1 && node.childNodes.length !== 0) {
			node =
				node.childNodes[textNodeIndex] === undefined
					? null
					: node.childNodes[textNodeIndex];
			node = node === null ? null : node.nodeType !== Node.TEXT_NODE ? null : node;
		}
		return node;
	}

	private _node: Node | null = null;
	public set(node: Node | null) {
		this._node = node;
	}
	public get(): Node | null {
		return this._node;
	}
}
