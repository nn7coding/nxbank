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

    let body = {};
    try {
      body = await request.json();
    } catch {}

    // =========================
    // HEALTH
    // =========================
    if (url.pathname === "/") {
      return new Response("NX Bank API Online", { headers: cors });
    }

    // =========================
    // REGISTER
    // =========================
    if (url.pathname === "/register" && request.method === "POST") {

      const { username, password } = body;

      if (!username || !password) {
        return json({ error: "Missing fields" }, 400);
      }

      try {
        await env.DB.prepare(
          "INSERT INTO users (username, password, balance, role) VALUES (?, ?, 0, 'user')"
        ).bind(username, password).run();

        return json({ success: true });

      } catch {
        return json({ error: "User exists" }, 400);
      }
    }

    // =========================
    // LOGIN
    // =========================
    if (url.pathname === "/login" && request.method === "POST") {

      const { username, password } = body;

      const user = await env.DB.prepare(
        "SELECT username, balance, role FROM users WHERE username=? AND password=?"
      ).bind(username, password).first();

      if (!user) {
        return json({ error: "Invalid login" }, 401);
      }

      return json(user);
    }

    // =========================
    // TRANSFER
    // =========================
    if (url.pathname === "/transfer" && request.method === "POST") {

      const { sender, receiver, amount } = body;

      const value = Number(amount);

      if (!sender || !receiver || value <= 0) {
        return json({ error: "Invalid transfer" }, 400);
      }

      const s = await env.DB.prepare(
        "SELECT balance FROM users WHERE username=?"
      ).bind(sender).first();

      const r = await env.DB.prepare(
        "SELECT balance FROM users WHERE username=?"
      ).bind(receiver).first();

      if (!s || !r) return json({ error: "User missing" }, 404);
      if (s.balance < value) return json({ error: "Insufficient funds" }, 400);

      await env.DB.prepare(
        "UPDATE users SET balance = balance - ? WHERE username=?"
      ).bind(value, sender).run();

      await env.DB.prepare(
        "UPDATE users SET balance = balance + ? WHERE username=?"
      ).bind(value, receiver).run();

      await env.DB.prepare(
        "INSERT INTO transactions (sender, receiver, amount, type, created_at) VALUES (?, ?, ?, 'transfer', ?)"
      ).bind(sender, receiver, value, new Date().toISOString()).run();

      return json({ success: true });
    }

    // =========================
    // USERS (ADMIN)
    // =========================
    if (url.pathname === "/users") {

      const res = await env.DB.prepare(
        "SELECT username, balance, role FROM users"
      ).all();

      return json(res.results);
    }

    // =========================
    // BANK CONTROL
    // =========================
    if (url.pathname === "/admin/balance" && request.method === "POST") {

      const { username, amount, action } = body;

      const value = Number(amount);

      const u = await env.DB.prepare(
        "SELECT balance FROM users WHERE username=?"
      ).bind(username).first();

      if (!u) return json({ error: "User missing" }, 404);

      if (action === "add") {
        await env.DB.prepare(
          "UPDATE users SET balance = balance + ? WHERE username=?"
        ).bind(value, username).run();
      }

      if (action === "subtract") {

        if (u.balance < value) {
          return json({ error: "Not enough balance" }, 400);
        }

        await env.DB.prepare(
          "UPDATE users SET balance = balance - ? WHERE username=?"
        ).bind(value, username).run();
      }

      return json({ success: true });
    }

    return json({ error: "Not found" }, 404);
  }
};
