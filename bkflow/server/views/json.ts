import superjson from "superjson";

export const json = (data: unknown) =>
  new Response(superjson.stringify(data), { headers: { "content-type": "application/json" } });
