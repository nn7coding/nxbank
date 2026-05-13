export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================
    // REGISTER
    // =========================
    if (url.pathname === "/register" && request.method === "POST") {
      const body = await request.json();

      const { username, password } = body;

      if (!username || !password) {
        return Response.json({ error: "Missing fields" }, { status: 400 });
      }

      try {
        await env.prod_d1_tutorial.prepare(
          `INSERT INTO users (username, password, balance, role)
           VALUES (?, ?, ?, ?)`
        )
          .bind(username, password, 0, "user")
          .run();

        return Response.json({ success: true });
      } catch {
        return Response.json(
          { error: "Username already exists" },
          { status: 400 }
        );
      }
    }

    // =========================
    // LOGIN
    // =========================
    if (url.pathname === "/login" && request.method === "POST") {
      const body = await request.json();

      const { username, password } = body;

      const user = await env.prod_d1_tutorial.prepare(
        `SELECT * FROM users
         WHERE username = ? AND password = ?`
      )
        .bind(username, password)
        .first();

      if (!user) {
        return Response.json(
          { error: "Invalid login" },
          { status: 401 }
        );
      }

      return Response.json({
        username: user.username,
        balance: user.balance,
        role: user.role
      });
    }

    // =========================
    // USER TRANSFER
    // =========================
    if (url.pathname === "/transfer" && request.method === "POST") {
      const body = await request.json();

      const { sender, receiver, amount } = body;

      const senderUser = await env.prod_d1_tutorial.prepare(
        `SELECT * FROM users WHERE username = ?`
      )
        .bind(sender)
        .first();

      const receiverUser = await env.prod_d1_tutorial.prepare(
        `SELECT * FROM users WHERE username = ?`
      )
        .bind(receiver)
        .first();

      if (!senderUser || !receiverUser) {
        return Response.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      if (senderUser.balance < amount) {
        return Response.json(
          { error: "Insufficient funds" },
          { status: 400 }
        );
      }

      await env.prod_d1_tutorial.prepare(
        `UPDATE users
         SET balance = balance - ?
         WHERE username = ?`
      )
        .bind(amount, sender)
        .run();

      await env.prod_d1_tutorial.prepare(
        `UPDATE users
         SET balance = balance + ?
         WHERE username = ?`
      )
        .bind(amount, receiver)
        .run();

      await env.prod_d1_tutorial.prepare(
        `INSERT INTO transactions
         (sender, receiver, amount, type, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
        .bind(
          sender,
          receiver,
          amount,
          "transfer",
          new Date().toISOString()
        )
        .run();

      return Response.json({ success: true });
    }

    // =========================
    // GET USERS (ADMIN)
    // =========================
    if (url.pathname === "/users") {
      const users = await env.prod_d1_tutorial.prepare(
        `SELECT username, balance, role FROM users`
      ).all();

      return Response.json(users.results);
    }

    return new Response("Bank API Running");
  }
};
