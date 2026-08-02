/**
 * Server Components can import the service layer directly, which returns
 * Mongoose lean documents holding ObjectId and Date instances. Those cannot
 * cross the server/client boundary, so anything handed to a Client Component
 * gets flattened to plain JSON first.
 *
 * The round trip also *changes* the types — ObjectId becomes string, Date
 * becomes an ISO string — so the caller declares the resulting shape rather
 * than inheriting the Mongoose one:
 *
 *   const data = serialize<{ products: ProductCard[] }>(result)
 */
export function serialize<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
