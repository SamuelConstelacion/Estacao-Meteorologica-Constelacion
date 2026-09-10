export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // ============================================================
    // CONFIGURAÇÕES
    // ============================================================

    const OPEN_METEO_URL =
      "https://api.open-meteo.com/v1/forecast";

    const ALERTA_RIO_ESTACOES_URL =
      "https://websempre.rio.rj.gov.br/estacoes/";

    const ALERTA_RIO_METEOROLOGICO_SC_URL =
      "https://websempre.rio.rj.gov.br/dados/meteorologicos/32/";

    const LATITUDE = -22.84563;
    const LONGITUDE = -43.33847;


    // ============================================================
    // RESPOSTA JSON PADRONIZADA
    // ============================================================

    function json(data, status = 200) {

      return new Response(
        JSON.stringify(data),
        {
          status,
          headers: {
            "Content-Type":
              "application/json; charset=UTF-8",

            "Access-Control-Allow-Origin":
              "*",

            "Access-Control-Allow-Methods":
              "GET, POST, OPTIONS",

            "Access-Control-Allow-Headers":
              "Content-Type, Authorization",

            "Cache-Control":
              "no-store, no-cache, must-revalidate"
          }
        }
      );

    }


    // ============================================================
    // CORS
    // ============================================================

    if (request.method === "OPTIONS") {

      return new Response(
        null,
        {
          status: 204,

          headers: {
            "Access-Control-Allow-Origin":
              "*",

            "Access-Control-Allow-Methods":
              "GET, POST, OPTIONS",

            "Access-Control-Allow-Headers":
              "Content-Type, Authorization"
          }
        }
      );

    }


    // ============================================================
    // FUNÇÕES AUXILIARES
    // ============================================================

    function numero(valor) {

      if (
        valor === null ||
        valor === undefined ||
        valor === ""
      ) {
        return null;
      }

      let texto =
        String(valor)
          .trim()
          .replace(",", ".");

      if (
        texto === "-" ||
        texto.toUpperCase() === "ND"
      ) {
        return null;
      }

      const valorNumerico =
        Number(texto);

      return Number.isFinite(valorNumerico)
        ? valorNumerico
        : null;

    }


    function limparTexto(valor) {

      if (
        valor === null ||
        valor === undefined
      ) {
        return "";
      }

      return String(valor)
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, " ")
        .trim();

    }


    // ============================================================
    // EXTRAI TODAS AS LINHAS <TR> DE UMA TABELA HTML
    // ============================================================

    function extrairLinhasTabela(html) {

      const linhas = [];

      const regex =
        /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

      let match;

      while (
        (match = regex.exec(html)) !== null
      ) {

        const conteudo =
          match[1];

        const celulas = [];

        const regexCelula =
          /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;

        let celula;

        while (
          (celula =
            regexCelula.exec(conteudo)) !== null
        ) {

          celulas.push(
            limparTexto(celula[1])
          );

        }

        if (celulas.length > 0) {

          linhas.push(celulas);

        }

      }

      return linhas;

    }


    // ============================================================
    // ENCONTRA ESTAÇÃO POR NOME
    // ============================================================

    function encontrarEstacao(
      linhas,
      nome
    ) {

      const alvo =
        nome
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();

      return linhas.find(
        linha => {

          return linha.some(
            celula => {

              const normalizada =
                String(celula)
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .toLowerCase()
                  .trim();

              return normalizada === alvo;

            }
          );

        }
      ) || null;

    }


    // ============================================================
    // DATA/HORA
    // ============================================================

    function extrairDataHoraTexto(valor) {

      if (!valor) {
        return null;
      }

      return String(valor)
        .replace(/\s+/g, " ")
        .trim();

    }


    // ============================================================
    // ============================================================
    // GET /api/leituras
    // ============================================================
    // ============================================================

    if (
      url.pathname === "/api/leituras" &&
      request.method === "GET"
    ) {

      try {

        const resultado =
          await env.DB.prepare(
            `
            SELECT
              id,
              data_hora,
              temperatura,
              umidade,
              pressao,
              chuva,
              vento,
              direcao_vento
            FROM leituras
            ORDER BY id DESC
            LIMIT 20
            `
          )
          .all();


        return json(
          {
            sucesso: true,

            quantidade:
              resultado.results.length,

            leituras:
              resultado.results
          }
        );

      } catch (erro) {

        console.error(
          "GET /api/leituras:",
          erro
        );

        return json(
          {
            sucesso: false,
            erro:
              "Erro ao consultar as leituras da estação."
          },
          500
        );

      }

    }


    // ============================================================
    // ============================================================
    // POST /api/leituras
    // ============================================================
    // ============================================================

    if (
      url.pathname === "/api/leituras" &&
      request.method === "POST"
    ) {

      try {

        // --------------------------------------------------------
        // TOKEN
        // --------------------------------------------------------

        const authorization =
          request.headers.get(
            "Authorization"
          );


        if (
          !authorization ||
          !authorization.startsWith("Bearer ")
        ) {

          return json(
            {
              sucesso: false,
              erro:
                "Não autorizado."
            },
            401
          );

        }


        const token =
          authorization
            .substring(7)
            .trim();


        if (
          !env.STATION_TOKEN ||
          token !== env.STATION_TOKEN
        ) {

          return json(
            {
              sucesso: false,
              erro:
                "STATION_TOKEN inválido."
            },
            401
          );

        }


        // --------------------------------------------------------
        // JSON
        // --------------------------------------------------------

        let body;

        try {

          body =
            await request.json();

        } catch {

          return json(
            {
              sucesso: false,
              erro:
                "O corpo da requisição deve ser JSON válido."
            },
            400
          );

        }


        // --------------------------------------------------------
        // CAMPOS OBRIGATÓRIOS
        // --------------------------------------------------------

        const obrigatorios = [
          "temperatura",
          "umidade",
          "pressao",
          "chuva",
          "vento",
          "direcao_vento"
        ];


        for (
          const campo of obrigatorios
        ) {

          if (
            body[campo] === undefined ||
            body[campo] === null ||
            body[campo] === ""
          ) {

            return json(
              {
                sucesso: false,
                erro:
                  `Parâmetro obrigatório ausente: ${campo}.`
              },
              400
            );

          }

        }


        // --------------------------------------------------------
        // CONVERSÃO
        // --------------------------------------------------------

        const temperatura =
          Number(body.temperatura);

        const umidade =
          Number(body.umidade);

        const pressao =
          Number(body.pressao);

        const chuva =
          Number(body.chuva);

        const vento =
          Number(body.vento);

        const direcaoVento =
          String(body.direcao_vento)
            .trim()
            .toUpperCase();


        // --------------------------------------------------------
        // VALIDAÇÃO TEMPERATURA
        // --------------------------------------------------------

        if (
          !Number.isFinite(temperatura) ||
          temperatura < -20 ||
          temperatura > 60
        ) {

          return json(
            {
              sucesso: false,
              erro:
                "Temperatura inválida."
            },
            400
          );

        }


        // --------------------------------------------------------
        // VALIDAÇÃO UMIDADE
        // --------------------------------------------------------

        if (
          !Number.isFinite(umidade) ||
          umidade < 0 ||
          umidade > 100
        ) {

          return json(
            {
              sucesso: false,
              erro:
                "Umidade inválida."
            },
            400
          );

        }


        // --------------------------------------------------------
        // VALIDAÇÃO PRESSÃO
        // --------------------------------------------------------

        if (
          !Number.isFinite(pressao) ||
          pressao < 800 ||
          pressao > 1100
        ) {

          return json(
            {
              sucesso: false,
              erro:
                "Pressão atmosférica inválida."
            },
            400
          );

        }


        // --------------------------------------------------------
        // VALIDAÇÃO CHUVA
        // --------------------------------------------------------

        if (
          !Number.isFinite(chuva) ||
          chuva < 0 ||
          chuva > 1000
        ) {

          return json(
            {
              sucesso: false,
              erro:
                "Valor de chuva inválido."
            },
            400
          );

        }


        // --------------------------------------------------------
        // VALIDAÇÃO VENTO
        // --------------------------------------------------------

        if (
          !Number.isFinite(vento) ||
          vento < 0 ||
          vento > 300
        ) {

          return json(
            {
              sucesso: false,
              erro:
                "Velocidade do vento inválida."
            },
            400
          );

        }


        // --------------------------------------------------------
        // VALIDAÇÃO DIREÇÃO
        // --------------------------------------------------------

        const direcoesValidas = [
          "N",
          "NE",
          "E",
          "SE",
          "S",
          "SO",
          "O",
          "NO"
        ];


        if (
          !direcoesValidas.includes(
            direcaoVento
          )
        ) {

          return json(
            {
              sucesso: false,
              erro:
                "Direção do vento inválida."
            },
            400
          );

        }


        // --------------------------------------------------------
        // DATA/HORA
        // --------------------------------------------------------

        const dataHora =
          new Date().toISOString();


        // --------------------------------------------------------
        // D1
        // --------------------------------------------------------

        const resultado =
          await env.DB.prepare(
            `
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
            `
          )
          .bind(
            dataHora,
            temperatura,
            umidade,
            pressao,
            chuva,
            vento,
            direcaoVento
          )
          .run();


        return json(
          {
            sucesso: true,

            mensagem:
              "Leitura gravada com sucesso.",

            id:
              resultado.meta.last_row_id,

            leitura: {

              data_hora:
                dataHora,

              temperatura:
                temperatura,

              umidade:
                umidade,

              pressao:
                pressao,

              chuva:
                chuva,

              vento:
                vento,

              direcao_vento:
                direcaoVento

            }
          },
          201
        );


      } catch (erro) {

        console.error(
          "POST /api/leituras:",
          erro
        );

        return json(
          {
            sucesso: false,
            erro:
              "Erro interno ao gravar a leitura."
          },
          500
        );

      }

    }


    // ============================================================
    // ============================================================
    // GET /api/previsao
    // ============================================================
    // ============================================================

    if (
      url.pathname === "/api/previsao" &&
      request.method === "GET"
    ) {

      try {

        const parametros =
          new URLSearchParams({

            latitude:
              String(LATITUDE),

            longitude:
              String(LONGITUDE),

            timezone:
              "America/Sao_Paulo",

            forecast_days:
              "2",

            hourly:
              [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "precipitation_probability",
                "precipitation",
                "rain",
                "weather_code",
                "wind_speed_10m",
                "wind_direction_10m",
                "wind_gusts_10m"
              ].join(",")

          });


        const resposta =
          await fetch(
            `${OPEN_METEO_URL}?${parametros.toString()}`,
            {
              headers: {
                "Accept":
                  "application/json"
              }
            }
          );


        if (!resposta.ok) {

          throw new Error(
            `Open-Meteo HTTP ${resposta.status}`
          );

        }


        const dados =
          await resposta.json();


        if (
          !dados.hourly ||
          !Array.isArray(
            dados.hourly.time
          )
        ) {

          throw new Error(
            "Open-Meteo não retornou dados horários válidos."
          );

        }


        // ========================================================
        // FORMATO EXATO ESPERADO PELO INDEX.HTML
        //
        // dados.previsao.hourly.time
        // dados.previsao.hourly.temperature_2m
        // dados.previsao.hourly.precipitation_probability
        // dados.previsao.hourly.precipitation
        // ========================================================

        return json(
          {
            sucesso: true,

            fonte:
              "Open-Meteo",

            previsao: {

              timezone:
                dados.timezone ||
                "America/Sao_Paulo",

              latitude:
                dados.latitude ??
                LATITUDE,

              longitude:
                dados.longitude ??
                LONGITUDE,

              hourly: {

                time:
                  dados.hourly.time,

                temperature_2m:
                  dados.hourly.temperature_2m ||
                  [],

                relative_humidity_2m:
                  dados.hourly.relative_humidity_2m ||
                  [],

                apparent_temperature:
                  dados.hourly.apparent_temperature ||
                  [],

                precipitation_probability:
                  dados.hourly.precipitation_probability ||
                  [],

                precipitation:
                  dados.hourly.precipitation ||
                  [],

                rain:
                  dados.hourly.rain ||
                  [],

                weather_code:
                  dados.hourly.weather_code ||
                  [],

                wind_speed_10m:
                  dados.hourly.wind_speed_10m ||
                  [],

                wind_direction_10m:
                  dados.hourly.wind_direction_10m ||
                  [],

                wind_gusts_10m:
                  dados.hourly.wind_gusts_10m ||
                  []

              }

            }

          }
        );


      } catch (erro) {

        console.error(
          "GET /api/previsao:",
          erro
        );

        return json(
          {
            sucesso: false,

            erro:
              "Não foi possível obter a previsão meteorológica.",

            detalhe:
              erro instanceof Error
                ? erro.message
                : String(erro)
          },
          502
        );

      }

    }


    // ============================================================
    // ============================================================
    // GET /api/alertario
    // ============================================================
    // ============================================================

    if (
      url.pathname === "/api/alertario" &&
      request.method === "GET"
    ) {

      try {

        // ========================================================
        // 1. BUSCA TABELA OFICIAL DO ALERTA RIO
        // ========================================================

        const respostaEstacoes =
          await fetch(
            ALERTA_RIO_ESTACOES_URL,
            {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 Estacao-Meteorologica-Constelacion",
                "Accept":
                  "text/html,application/xhtml+xml"
              }
            }
          );


        if (
          !respostaEstacoes.ok
        ) {

          throw new Error(
            `Alerta Rio estações HTTP ${respostaEstacoes.status}`
          );

        }


        const htmlEstacoes =
          await respostaEstacoes.text();


        // ========================================================
        // 2. EXTRAI LINHAS DAS TABELAS
        // ========================================================

        const linhasEstacoes =
          extrairLinhasTabela(
            htmlEstacoes
          );


        // ========================================================
        // 3. LOCALIZA IRAJÁ
        // ========================================================

        const linhaIraja =
          encontrarEstacao(
            linhasEstacoes,
            "Irajá"
          );


        if (!linhaIraja) {

          throw new Error(
            "Estação Irajá não encontrada na tabela oficial."
          );

        }


        /*
         * Tabela oficial:
         *
         * 0  Número
         * 1  Estação
         * 2  Localização
         * 3  Hora leitura
         * 4  05 min
         * 5  10 min
         * 6  15 min
         * 7  30 min
         * 8  1 h
         * 9  2 h
         * 10 3 h
         * 11 4 h
         * 12 6 h
         * 13 12 h
         * 14 24 h
         * 15 96 h
         * 16 No mês
         * 17 TX-15
         */


        const chuva = {

          cinco_minutos:
            numero(linhaIraja[4]),

          dez_minutos:
            numero(linhaIraja[5]),

          quinze_minutos:
            numero(linhaIraja[6]),

          trinta_minutos:
            numero(linhaIraja[7]),

          uma_hora:
            numero(linhaIraja[8]),

          duas_horas:
            numero(linhaIraja[9]),

          tres_horas:
            numero(linhaIraja[10]),

          quatro_horas:
            numero(linhaIraja[11]),

          seis_horas:
            numero(linhaIraja[12]),

          doze_horas:
            numero(linhaIraja[13]),

          vinte_quatro_horas:
            numero(linhaIraja[14]),

          noventa_e_seis_horas:
            numero(linhaIraja[15]),

          mes:
            numero(linhaIraja[16]),

          tx_15:
            numero(linhaIraja[17])

        };


        // ========================================================
        // 4. BUSCA DADOS METEOROLÓGICOS DE SÃO CRISTÓVÃO
        // ========================================================

        const respostaMeteorologica =
          await fetch(
            ALERTA_RIO_METEOROLOGICO_SC_URL,
            {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 Estacao-Meteorologica-Constelacion",
                "Accept":
                  "text/html,application/xhtml+xml"
              }
            }
          );


        if (
          !respostaMeteorologica.ok
        ) {

          throw new Error(
            `Alerta Rio meteorológico HTTP ${respostaMeteorologica.status}`
          );

        }


        const htmlMeteorologico =
          await respostaMeteorologica.text();


        const linhasMeteorologicas =
          extrairLinhasTabela(
            htmlMeteorologico
          );


        // ========================================================
        // 5. LOCALIZA A PRIMEIRA LINHA DE DADOS
        // ========================================================

        const linhaMeteorologica =
          linhasMeteorologicas.find(
            linha => {

              return (
                linha.length >= 7 &&
                /^\d{2}\/\d{2}\/\d{4}/
                  .test(
                    linha[0]
                  )
              );

            }
          );


        if (!linhaMeteorologica) {

          throw new Error(
            "Dados meteorológicos de São Cristóvão não encontrados."
          );

        }


        /*
         * Relatório meteorológico oficial:
         *
         * 0 Dia
         * 1 Hora
         * 2 Direção vento
         * 3 Velocidade vento
         * 4 Temperatura
         * 5 Pressão
         * 6 Umidade
         */


        const dados = {

          temperatura:
            numero(
              linhaMeteorologica[4]
            ),

          umidade:
            numero(
              linhaMeteorologica[6]
            ),

          pressao:
            numero(
              linhaMeteorologica[5]
            ),

          vento:
            numero(
              linhaMeteorologica[3]
            ),

          direcao_vento:
            numero(
              linhaMeteorologica[2]
            ),

          data:
            linhaMeteorologica[0] ||
            null,

          hora:
            linhaMeteorologica[1] ||
            null

        };


        // ========================================================
        // 6. RESPOSTA COMPATÍVEL COM O INDEX.HTML
        // ========================================================

        return json(
          {

            sucesso:
              true,

            fonte:
              "Sistema Alerta Rio / Prefeitura do Rio / COR-Rio",

            atualizado_em:
              linhaIraja[3] ||
              null,

            dados:
              dados,

            chuva:
              chuva,

            estacoes: {

              iraja: {

                nome:
                  "Irajá",

                numero:
                  linhaIraja[0] ||
                  null,

                localizacao:
                  linhaIraja[2] ||
                  null,

                hora_leitura:
                  linhaIraja[3] ||
                  null,

                chuva:
                  chuva

              },

              sao_cristovao: {

                nome:
                  "São Cristóvão",

                data:
                  dados.data,

                hora:
                  dados.hora,

                temperatura:
                  dados.temperatura,

                umidade:
                  dados.umidade,

                pressao:
                  dados.pressao,

                vento:
                  dados.vento,

                direcao_vento:
                  dados.direcao_vento

              }

            }

          }
        );


      } catch (erro) {

        console.error(
          "GET /api/alertario:",
          erro
        );

        return json(
          {
            sucesso: false,

            erro:
              "Não foi possível obter os dados do Alerta Rio.",

            detalhe:
              erro instanceof Error
                ? erro.message
                : String(erro)
          },
          502
        );

      }

    }


    // ============================================================
    // ROTA NÃO ENCONTRADA
    // ============================================================

    return json(
      {
        sucesso: false,

        erro:
          "Rota não encontrada.",

        rota:
          url.pathname,

        metodo:
          request.method
      },
      404
    );

  }
};
