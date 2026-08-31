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
// API - ALERTA RIO
// ==========================================

if (
  url.pathname === "/api/alertario" &&
  request.method === "GET"
) {

  try {

    const resposta = await fetch(
      "https://websempre.rio.rj.gov.br/estacoes/"
    );

    if (!resposta.ok) {
      throw new Error(
        "Erro ao acessar o Alerta Rio"
      );
    }

    const html = await resposta.text();

console.log(
  "TAMANHO HTML:",
  html.length
);

console.log(
  "TEM IRAJÁ:",
  html.includes("Irajá")
);

console.log(
  "TEM IRAJA:",
  html.includes("Iraja")
);

console.log(
  "TEM SÃO CRISTÓVÃO:",
  html.includes("São Cristóvão")
);
    
    // ------------------------------------------
    // Localiza a linha meteorológica de
    // São Cristóvão
    // ------------------------------------------

    const linhas =
      html.match(/<tr[\s\S]*?<\/tr>/gi) || [];


    let dadosMeteorologicos = null;


    for (const linha of linhas) {

      if (
        linha.includes("São Cristóvão") ||
        linha.includes("S%C3%A3o")
      ) {

        const celulas =
          linha.match(
            /<td[\s\S]*?<\/td>/gi
          ) || [];

        const valores =
          celulas.map(celula =>
            celula
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
              .trim()
          );


        /*
         * A linha meteorológica possui:
         *
         * Estação
         * Hora
         * Temperatura
         * Umidade
         * Pressão
         * Ponto de orvalho
         * Vento
         * Direção
         *
         * A linha de chuva possui muitas
         * colunas, portanto ignoramos essa.
         */

        if (valores.length >= 8) {

          dadosMeteorologicos = valores;

        }

      }

    }


    if (!dadosMeteorologicos) {

      return Response.json(
        {
// ==========================================
// API - ALERTA RIO
// ==========================================

if (
  url.pathname === "/api/alertario" &&
  request.method === "GET"
) {

  try {

    const resposta = await fetch(
      "https://websempre.rio.rj.gov.br/estacoes/"
    );

    if (!resposta.ok) {
      throw new Error(
        "Erro ao acessar o Alerta Rio"
      );
    }

    const html = await resposta.text();

    const linhas =
      html.match(/<tr[\s\S]*?<\/tr>/gi) || [];


    // ==========================================
    // DADOS METEOROLÓGICOS - SÃO CRISTÓVÃO
    // ==========================================

    let dadosMeteorologicos = null;


    for (const linha of linhas) {

      if (
        linha.includes("São Cristóvão")
      ) {

        const celulas =
          linha.match(
            /<td[\s\S]*?<\/td>/gi
          ) || [];

        const valores =
          celulas.map(celula =>
            celula
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
              .trim()
          );


        if (valores.length >= 8) {

          dadosMeteorologicos = valores;

        }

      }

    }


    // ==========================================
    // DADOS DE CHUVA - IRAJÁ
    // ==========================================

    let dadosChuva = null;


    for (const linha of linhas) {

      if (
        linha.includes("Irajá")
      ) {

        const celulas =
          linha.match(
            /<td[\s\S]*?<\/td>/gi
          ) || [];

        const valores =
          celulas.map(celula =>
            celula
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
              .trim()
          );


        /*
         * Estrutura da tabela:
         *
         * 0 = número
         * 1 = estação
         * 2 = localização
         * 3 = hora
         * 4 = 5 minutos
         * 5 = 10 minutos
         * 6 = 15 minutos
         * 7 = 30 minutos
         * 8 = 1 hora
         * 9 = 2 horas
         * 10 = 3 horas
         * 11 = 4 horas
         * 12 = 6 horas
         * 13 = 12 horas
         * 14 = 24 horas
         * 15 = 96 horas
         */

        if (valores.length >= 16) {

          dadosChuva = valores;

        }

      }

    }


    // ==========================================
    // VERIFICAÇÃO
    // ==========================================

    if (!dadosMeteorologicos) {

      return Response.json(
        {
          sucesso: false,
          erro:
            "Não foi possível localizar São Cristóvão"
        },
        { status: 502 }
      );

    }


    if (!dadosChuva) {

      return Response.json(
        {
          sucesso: false,
          erro:
            "Não foi possível localizar Irajá"
        },
        { status: 502 }
      );

    }


    // ==========================================
    // RETORNO
    // ==========================================

    return Response.json({

      sucesso: true,

      fonte:
        "Sistema Alerta Rio - Prefeitura do Rio de Janeiro",


      // ----------------------------------------
      // ESTAÇÃO METEOROLÓGICA
      // ----------------------------------------

      estacao:
        "São Cristóvão",

      numero_estacao:
        32,

      dados: {

        horario:
          dadosMeteorologicos[1],

        temperatura:
          dadosMeteorologicos[2],

        umidade:
          dadosMeteorologicos[3],

        pressao:
          dadosMeteorologicos[4],

        ponto_orvalho:
          dadosMeteorologicos[5],

        vento:
          dadosMeteorologicos[6],

        direcao_vento:
          dadosMeteorologicos[7]

      },


      // ----------------------------------------
      // ESTAÇÃO PLUVIOMÉTRICA
      // ----------------------------------------

      chuva: {

        estacao:
          "Irajá",

        numero_estacao:
          11,

        horario:
          dadosChuva[3],

        cinco_minutos:
          dadosChuva[4],

        dez_minutos:
          dadosChuva[5],

        quinze_minutos:
          dadosChuva[6],

        trinta_minutos:
          dadosChuva[7],

        uma_hora:
          dadosChuva[8],

        duas_horas:
          dadosChuva[9],

        tres_horas:
          dadosChuva[10],

        quatro_horas:
          dadosChuva[11],

        seis_horas:
          dadosChuva[12],

        doze_horas:
          dadosChuva[13],

        vinte_quatro_horas:
          dadosChuva[14],

        noventa_e_seis_horas:
          dadosChuva[15]

      }

    });


  } catch (erro) {

    console.error(
      "Erro Alerta Rio:",
      erro
    );


    return Response.json(

      {
        sucesso: false,

        erro:
          "Não foi possível consultar o Alerta Rio"

      },

      { status: 502 }

    );

  }

}
    
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
