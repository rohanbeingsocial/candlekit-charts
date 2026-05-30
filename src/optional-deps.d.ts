/**
 * Fallback ambient declarations for the OPTIONAL runtimes so the library
 * typechecks and builds when they are not installed (e.g. a contributor clone
 * without the git-hosted MPL packages, or CI without GitHub access). When a
 * consumer or contributor installs the real packages, their own type
 * definitions take precedence over these shorthand declarations.
 */

declare module "lightweight-charts-line-tools-core";
declare module "lightweight-charts-line-tools-lines";
declare module "lightweight-charts-line-tools-rectangle";
declare module "lightweight-charts-line-tools-circle";
declare module "lightweight-charts-line-tools-fib-retracement";
declare module "lightweight-charts-indicators";
