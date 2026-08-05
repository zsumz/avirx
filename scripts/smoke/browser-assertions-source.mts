export const browserAssertionsSource = `function assert(condition, message = "Assertion failed") {
  if (!condition) {
    throw new Error(message);
  }
}

function equal(actual, expected, message) {
  assert(Object.is(actual, expected), message ?? "Expected " + String(actual) + " to equal " + String(expected));
}

function deepEqual(actual, expected, message) {
  equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

function match(actual, expected, message) {
  assert(expected.test(actual), message ?? "Expected " + String(actual) + " to match " + String(expected));
}

function errorMessage(error) {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}
`;
