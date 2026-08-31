export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API: últimas leituras
    if (url.pathname === "/api/leituras" && request.method === "GET") {
      const resultado = await env.DB.prepare(`
        SELECT *
        FROM leituras
        ORDER BY id DESC
        LIMIT 20
      `).all();

      return Response.json({
        sucesso: true,
        quantidade: resultado.results.length,
        leituras: resultado.results
      });
    }

    // Rota principal
    if (url.pathname === "/") {
      return env.ASSETS.fetch(request);
    }

    return Response.json(
      {
        sucesso: false,
        erro: "Rota não encontrada"
      },
      { status: 404 }
    );
  },

  async scheduled(event, env, ctx) {
    const agora = new Date();

    // Pequenas variações para deixar a simulação mais natural
    const temperatura = Number(
      (25 + Math.random() * 5).toFixed(1)
    );

    const umidade = Number(
      (65 + Math.random() * 20).toFixed(1)
    );

    const pressao = Number(
      (1010 + Math.random() * 8).toFixed(1)
    );

    const chuva = Math.random() < 0.15
      ? Number((Math.random() * 3).toFixed(1))
      : 0;

    const vento = Number(
      (5 + Math.random() * 20).toFixed(1)
    );

    const direcoes = [
      "N", "NE", "E", "SE",
      "S", "SO", "O", "NO"
    ];

    const direcao =
      direcoes[Math.floor(Math.random() * direcoes.length)];

    await env.DB.prepare(`
      INSERT INTO leituras
      (data_hora, temperatura, umidade, pressao, chuva, vento, direcao_vento)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        agora.toISOString(),
        temperatura,
        umidade,
        pressao,
        chuva,
        vento,
        direcao
      )
      .run();
  }
};
