// tslint:disable:indent
// tslint:disable:no-bitwise
// tslint:disable:no-shadowed-variable
// tslint:disable:prefer-const
// tslint:disable:interface-over-type-literal
// tslint:disable:callable-types
// tslint:disable:member-ordering
// tslint:disable:no-unnecessary-initializer
// tslint:disable:no-non-null-assertion
// tslint:disable:one-line

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function once<T extends Function>(this: any, fn: T): T {
	const _this = this;
	let didCall = false;
	let result: any;

	return function () {
		if (didCall) {
			return result;
		}

		didCall = true;
		result = fn.apply(_this, arguments);

		return result;
	} as any as T;
}
