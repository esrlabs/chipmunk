import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'JumpToDialogRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'JumpToDialogResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
