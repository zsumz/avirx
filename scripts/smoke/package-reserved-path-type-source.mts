export const reservedPathTypeSmokeSource = `import { avirx, endpoint, type AvirxRequestBuilder } from "avirx";

const client = avirx("https://api.example.test");
client.get("/{constructor}").path({ constructor: "value" });
client.get("/{toString}").path({ toString: "value" });
client.get("/{valueOf}").path({ valueOf: "value" });
client.get("/{hasOwnProperty}").path({ hasOwnProperty: "value" });
client.get("/{isPrototypeOf}").path({ isPrototypeOf: "value" });
client.get("/{propertyIsEnumerable}").path({ propertyIsEnumerable: "value" });
client.get("/{toLocaleString}").path({ toLocaleString: "value" });
client.get("/{__defineGetter__}").path({ __defineGetter__: "value" });
client.get("/{__defineSetter__}").path({ __defineSetter__: "value" });
client.get("/{__lookupGetter__}").path({ __lookupGetter__: "value" });
client.get("/{__lookupSetter__}").path({ __lookupSetter__: "value" });
client.get("/{__proto__}").path({ ["__proto__"]: "value" });
client.get("/{constructor}/{id}").path({ constructor: "value", id: 1 });

const reserved = { constructor: "value", toString: "text", ["__proto__"]: "own" };
client.get("/{constructor}/{toString}/{__proto__}").path(reserved);
client.post("/{constructor}").path({ constructor: "value" }).body({ title: "book" });
const contract = client.contract({ read: endpoint.get("/{constructor}") });
contract.read({ path: { constructor: "value" } });

const extra = { constructor: "value", accidental: "extra" };
// @ts-expect-error Reserved names do not weaken exact-key checks for variables.
client.get("/{constructor}").path(extra);
// @ts-expect-error Reserved names do not weaken exact-key checks for literals.
client.get("/{constructor}").path({ constructor: "value", accidental: "extra" });
// @ts-expect-error Inherited object method names are still extra keys when absent from the route.
client.get("/{id}").path({ id: "value", constructor: "extra" });
// @ts-expect-error An inherited object key does not satisfy another required route key.
client.get("/{constructor}/{id}").path({ constructor: "value" });
const symbol = Symbol("extra path key");
// @ts-expect-error Symbol properties are extra keys too.
client.get("/{constructor}").path({ constructor: "value", [symbol]: "extra" });

function identity<Route extends string>(builder: AvirxRequestBuilder<Route>): AvirxRequestBuilder<Route> {
  return builder.header("x-consumer", "value");
}
identity(client.get("/{constructor}")).path({ constructor: "value" });
const common: AvirxRequestBuilder = client.get("/{constructor}");
void common;
`;
