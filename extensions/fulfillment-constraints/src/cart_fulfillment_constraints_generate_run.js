// @ts-check

/**
 * @typedef {import("../generated/api").CartFulfillmentConstraintsGenerateRunInput} CartFulfillmentConstraintsGenerateRunInput
 * @typedef {import("../generated/api").CartFulfillmentConstraintsGenerateRunResult} CartFulfillmentConstraintsGenerateRunResult
 */

/**
 * @type {CartFulfillmentConstraintsGenerateRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {CartFulfillmentConstraintsGenerateRunInput} input
 * @returns {CartFulfillmentConstraintsGenerateRunResult}
 */
export function cartFulfillmentConstraintsGenerateRun(input) {
  const configuration = input?.fulfillmentConstraintRule?.metafield?.jsonValue ?? {};

  return NO_CHANGES;
};