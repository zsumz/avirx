import type { AvirxPrimitiveValue } from './primitive.js';

type InvalidParamCharacter =
  | '/' | '\\' | '?' | '#' | '{' | '}' | ' '
  | '\u0000' | '\u0001' | '\u0002' | '\u0003' | '\u0004' | '\u0005' | '\u0006' | '\u0007'
  | '\u0008' | '\u0009' | '\u000a' | '\u000b' | '\u000c' | '\u000d' | '\u000e' | '\u000f'
  | '\u0010' | '\u0011' | '\u0012' | '\u0013' | '\u0014' | '\u0015' | '\u0016' | '\u0017'
  | '\u0018' | '\u0019' | '\u001a' | '\u001b' | '\u001c' | '\u001d' | '\u001e' | '\u001f'
  | '\u00a0' | '\u1680' | '\u2000' | '\u2001' | '\u2002' | '\u2003' | '\u2004' | '\u2005'
  | '\u2006' | '\u2007' | '\u2008' | '\u2009' | '\u200a' | '\u2028' | '\u2029' | '\u202f'
  | '\u205f' | '\u3000' | '\ufeff';

type RouteParamNames<Route extends string> =
    Route extends `${infer Prefix}{${infer Param}}${infer Rest}`
        ? Prefix extends `${string}}${string}`
            ? never
            : Param extends '' | `${string}${InvalidParamCharacter}${string}`
                ? never
                : PrependParam<Param, RouteParamNames<Rest>>
        : Route extends `${string}{${string}` | `${string}}${string}` ? never : readonly [];

type PrependParam<Param extends string, Rest> =
    Rest extends readonly string[] ? readonly [Param, ...Rest] : never;

export type AvirxPathParamNames<Route extends string> = RouteParamNames<Route>[number];

export type AvirxPathParams<Route extends string> =
    [AvirxPathParamNames<Route>] extends [never]
        ? Readonly<Record<string, never>>
        : Readonly<Record<AvirxPathParamNames<Route>, AvirxPrimitiveValue>>;

// TS 5.0 intersects inherited Object members into valid keys when the extra-key record is empty.
export type AvirxExactPathParams<
    Route extends string,
    Params extends Readonly<Record<string, unknown>>,
> = Params & (Exclude<keyof Params, AvirxPathParamNames<Route>> extends never
    ? unknown
    : Readonly<Record<Exclude<keyof Params, AvirxPathParamNames<Route>>, never>>);
