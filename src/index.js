export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==========================================
    // API - ÚLTIMAS LEITURAS DA ESTAÇÃO
    // ==========================================

    if (
      url.pathname === "/api/leituras" &&
      request.method === "GET"
    ) {
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


    // ==========================================
    // API - PREVISÃO METEOROLÓGICA
    // ==========================================

    if (
      url.pathname === "/api/previsao" &&
      request.method === "GET"
    ) {

      const latitude = -22.84563;
      const longitude = -43.33847;

      const apiUrl =
        "https://api.open-meteo.com/v1/forecast" +
        `?latitude=${latitude}` +
        `&longitude=${longitude}` +
        "&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,pressure_msl,wind_speed_10m,wind_direction_10m" +
        "&forecast_days=2" +
        "&timezone=America%2FSao_Paulo" +
        "&temperature_unit=celsius" +
        "&wind_speed_unit=kmh" +
        "&precipitation_unit=mm";

      const resposta = await fetch(apiUrl);

      if (!resposta.ok) {
        return Response.json(
          {
            sucesso: false,
            erro: "Não foi possível obter a previsão meteorológica"
          },
          { status: 502 }
        );
      }

      const previsao = await resposta.json();

      return Response.json({
        sucesso: true,
        local: {
          latitude: latitude,
          longitude: longitude,
          descricao: "Estrada do Barro Vermelho, Colégio - Rio de Janeiro"
        },
        previsao: previsao
      });
    }


    // ==========================================
    // SITE
    // ==========================================

    if (url.pathname === "/") {
      return env.ASSETS.fetch(request);
    }


    // ==========================================
    // ROTA NÃO ENCONTRADA
    // ==========================================

    return Response.json(
      {
        sucesso: false,
        erro: "Rota não encontrada"
      },
      { status: 404 }
    );
  },


  // ==========================================
  // SIMULADOR METEOROLÓGICO
  // ==========================================

  async scheduled(event, env, ctx) {

    const agora = new Date();

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
      "N",
      "NE",
      "E",
      "SE",
      "S",
      "SO",
      "O",
      "NO"
    ];

    const direcao =
      direcoes[
        Math.floor(Math.random() * direcoes.length)
      ];

    await env.DB.prepare(`
      INSERT INTO leituras
      (
        data_hora,
        temperatura,
        umidade,
        pressao,
        chuva,
        vento,
        direcao_vento
      )
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
