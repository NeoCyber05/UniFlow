import { createRouteHandler } from "uploadthing/server";

import { ourFileRouter } from "./core";

const handler = createRouteHandler({ router: ourFileRouter });

export const GET = handler;
export const POST = handler;
