/**
 * Liveness check for load balancers and local smoke tests.
 * It does not touch the database, so CI can build without secrets.
 */
export function GET() {
  return Response.json({
    status: "ok",
    service: "shipshape",
  });
}
