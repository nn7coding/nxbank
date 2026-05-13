export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...cors }
      });

    // TEST ROUTE (IMPORTANT)
    if (url.pathname === "/") {
      return new Response("OK", { headers: cors });
    }

    // LOGIN ROUTE (FIXED)
    if (url.pathname === "/login" && request.method === "POST") {

      const body = await request.json().catch(() => null);

      if (!body) return json({ error: "No JSON" }, 400);

      const { username, password } = body;

      const user = await env.DB.prepare(
        "SELECT username, balance, role FROM users WHERE username=? AND password=?"
      ).bind(username, password).first();

      if (!user) return json({ error: "Invalid login" }, 401);

      return json(user);
    }

    return json({ error: "Not found", path: url.pathname }, 404);
  }
};
