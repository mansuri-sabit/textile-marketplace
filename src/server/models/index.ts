/**
 * Importing this barrel registers every schema with Mongoose, which matters for
 * `.populate()` — a route that populates `supplier` will fail if the
 * SupplierProfile model was never loaded in that isolate.
 */
export { User, type UserDoc } from "./User";
export { SupplierProfile, type SupplierProfileDoc } from "./SupplierProfile";
export { Product, type ProductDoc } from "./Product";
export { Cart, type CartDoc } from "./Cart";
export { Order, type OrderDoc } from "./Order";
