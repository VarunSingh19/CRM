/**
 * Mongoose lean() results carry ObjectId and Date instances, which cannot cross
 * the server/client boundary. One round-trip through JSON gives plain data with
 * ids and dates as strings — the shape the client views already expect.
 */
export function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
