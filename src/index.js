export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // ============================================================
    // CONFIGURAÇÕES
    // ============================================================

    const ALERTA_RIO_URL =
      "https://websempre.rio.rj.gov.br/estacoes/";

    const OPEN_METEO_URL =
      "https://api.open-meteo.com/v1/forecast";

    // Coordenadas da Estação Meteorológica Constelación
    const LATITUDE = -22.84563;
    const LONGITUDE = -43.33847;


    // ============================================================
    // FUNÇÕES AUXILIARES
    // ============================================================

    function json(data, status = 200) {

      return new Response(
        JSON.stringify(data),
        {
          status,
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
          }
        }
      );

    }


    function corsResponse(response) {

      const headers = new Headers(response.headers);

      headers.set(
        "Access-Control-Allow-Origin",
        "*"
      );

      headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
      );

      headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );

      return new Response(
        response.body,
        {
          status: response.status,
          headers
        }
      );

    }


    function numero(valor) {

      if (
        valor === null ||
        valor === undefined ||
        valor === ""
      ) {

        return null;

      }

      const texto = String(valor)
        .trim()
        .replace(",", ".");

      if (
        texto === "-" ||
        texto === "ND" ||
        texto === "null" ||
        texto === "undefined"
      ) {

        return null;

      }

      const n = Number(texto);

      return Number.isFinite(n)
        ? n
        : null;

    }


    function texto(valor) {

      if (
        valor === null ||
        valor === undefined
      ) {

        return null;

      }

      const t = String(valor).trim();

      if (
        t === "" ||
        t === "-" ||
        t === "ND"
      ) {

        return null;

      }

      return t;

    }


    // Extrai uma linha da tabela do Alerta Rio.
    function extrairLinhaTabela(html, nomeEstacao) {

      const escaped =
        nomeEstacao.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const regex = new RegExp(
        `<tr[^>]*>[\\s\\S]*?<td[^>]*>[^<]*<\\/td>[\\s\\S]*?${escaped}[\\s\\S]*?<\\/tr>`,
        "i"
      );

      const encontrado = html.match(regex);

      if (!encontrado) {

        return null;

      }

      const linha = encontrado[0];

      const celulas = [
        ...linha.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)
      ].map(match =>
        match[1]
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/\s+/g, " ")
          .trim()
      );

      return celulas;

    }


    // Procura uma estação pelo nome no texto convertido da página.
    function encontrarLinhaTexto(textoPagina, nomeEstacao) {

      const linhas = textoPagina
        .split(/\r?\n/)
        .map(linha => linha.trim())
        .filter(Boolean);

      return linhas.find(
        linha =>
          linha.includes(`| ${nomeEstacao} |`)
      ) || null;

    }


    function separarLinha(linha) {

      if (!linha) {

        return [];

      }

      return linha
        .split("|")
        .map(item => item.trim())
        .filter(Boolean);

    }


    // ============================================================
    // CORS / PREFLIGHT
    // ============================================================

    if (request.method === "OPTIONS") {

      return corsResponse(
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization"
          }
        })
      );

    }


    // ============================================================
    // ROTA POST /api/leituras
    // RECEBE DADOS DA ESTAÇÃO FÍSICA
    // ============================================================

    if (
      url.pathname === "/api/leituras" &&
      request.method === "POST"
    ) {

      try {

        // --------------------------------------------------------
        // AUTENTICAÇÃO
        // --------------------------------------------------------

        const authorization =
          request.headers.get("Authorization");

        if (
          !authorization ||
          !authorization.startsWith("Bearer ")
        ) {

          return json(
            {
              sucesso: false,
              erro: "Não autorizado."
            },
            401
          );

        }


        const token =
          authorization.substring(7).trim();


        if (
          !env.STATION_TOKEN ||
          token !== env.STATION_TOKEN
        ) {

          return json(
            {
              sucesso: false,
              erro: "STATION_TOKEN inválido."
            },
            401
          );

        }


        // --------------------------------------------------------
        // JSON
        // --------------------------------------------------------

        let body;

        try {

          body = await request.json();

        } catch {

          return json(
            {
              sucesso: false,
              erro: "Corpo da requisição deve ser JSON válido."
            },
            400
          );

        }


        // --------------------------------------------------------
        // PARÂMETROS OBRIGATÓRIOS
        // --------------------------------------------------------

        const camposObrigatorios = [
          "temperatura",
          "umidade",
          "pressao",
          "chuva",
          "vento",
          "direcao_vento"
        ];


        for (const campo of camposObrigatorios) {

          if (
            body[campo] === undefined ||
            body[campo] === null ||
            body[campo] === ""
          ) {

            return json(
              {
                sucesso: false,
                erro: `Parâmetro obrigatório ausente: ${campo}.`
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
        // VALIDAÇÃO NUMÉRICA RÍGIDA
        // --------------------------------------------------------

        if (
          !Number.isFinite(temperatura) ||
          temperatura < -20 ||
          temperatura > 60
        ) {

          return json(
            {
              sucesso: false,
              erro: "Temperatura inválida. Deve estar entre -20 e 60 °C."
            },
            400
          );

        }


        if (
          !Number.isFinite(umidade) ||
          umidade < 0 ||
          umidade > 100
        ) {

          return json(
            {
              sucesso: false,
              erro: "Umidade inválida. Deve estar entre 0 e 100%."
            },
            400
          );

        }


        if (
          !Number.isFinite(pressao) ||
          pressao < 800 ||
          pressao > 1100
        ) {

          return json(
            {
              sucesso: false,
              erro: "Pressão inválida. Deve estar entre 800 e 1100 hPa."
            },
            400
          );

        }


        if (
          !Number.isFinite(chuva) ||
          chuva < 0 ||
          chuva > 1000
        ) {

          return json(
            {
              sucesso: false,
              erro: "Chuva inválida. Deve estar entre 0 e 1000 mm."
            },
            400
          );

        }


        if (
          !Number.isFinite(vento) ||
          vento < 0 ||
          vento > 300
        ) {

          return json(
            {
              sucesso: false,
              erro: "Velocidade do vento inválida. Deve estar entre 0 e 300 km/h."
            },
            400
          );

        }


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
          !direcoesValidas.includes(direcaoVento)
        ) {

          return json(
            {
              sucesso: false,
              erro:
                "Direção do vento inválida. Use N, NE, E, SE, S, SO, O ou NO."
            },
            400
          );

        }


        // --------------------------------------------------------
        // CAMPOS OPCIONAIS
        // --------------------------------------------------------

        const origem =
          body.origem !== undefined
            ? String(body.origem).trim()
            : "Estação Meteorológica Constelación";


        const dispositivo =
          body.dispositivo !== undefined
            ? String(body.dispositivo).trim()
            : "DHT11 + Chuva";


        // --------------------------------------------------------
        // DATA/HORA
        // --------------------------------------------------------

        const dataHora =
          new Date().toISOString();


        // --------------------------------------------------------
        // GRAVAÇÃO D1
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
              direcao_vento,
              origem,
              dispositivo
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
          )
          .bind(
            dataHora,
            temperatura,
            umidade,
            pressao,
            chuva,
            vento,
            direcaoVento,
            origem,
            dispositivo
          )
          .run();


        return json(
          {
            sucesso: true,
            mensagem: "Leitura gravada com sucesso.",
            id: resultado.meta.last_row_id,
            leitura: {
              data_hora: dataHora,
              temperatura,
              umidade,
              pressao,
              chuva,
              vento,
              direcao_vento: direcaoVento,
              origem,
              dispositivo
            }
          },
          201
        );

      } catch (erro) {

        console.error(
          "Erro POST /api/leituras:",
          erro
        );

        return json(
          {
            sucesso: false,
            erro: "Erro interno ao gravar leitura."
          },
          500
        );

      }

    }


    // ============================================================
    // ROTA GET /api/leituras
    // ÚLTIMAS LEITURAS DA ESTAÇÃO FÍSICA
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
              direcao_vento,
              origem,
              dispositivo
            FROM leituras
            ORDER BY id DESC
            LIMIT 20
            `
          )
          .all();


        return json(
          {
            sucesso: true,
            quantidade: resultado.results.length,
            leituras: resultado.results
          }
        );

      } catch (erro) {

        console.error(
          "Erro GET /api/leituras:",
          erro
        );

        return json(
          {
            sucesso: false,
            erro: "Erro ao consultar o banco de dados."
          },
          500
        );

      }

    }


    // ============================================================
    // NOVA ROTA GET /api/alertario
    //
    // DADOS OFICIAIS DO SISTEMA ALERTA RIO
    //
    // IRAJÁ:
    //   - chuva
    //
    // SÃO CRISTÓVÃO:
    //   - temperatura
    //   - umidade
    //   - vento
    //   - direção do vento
    //   - chuva
    // ============================================================

    if (
      url.pathname === "/api/alertario" &&
      request.method === "GET"
    ) {

      try {

        const resposta =
          await fetch(
            ALERTA_RIO_URL,
            {
              method: "GET",
              headers: {
                "User-Agent":
                  "Estacao-Meteorologica-Constelacion/3.0",
                "Accept":
                  "text/html,application/xhtml+xml"
              }
            }
          );


        if (!resposta.ok) {

          throw new Error(
            `Alerta Rio HTTP ${resposta.status}`
          );

        }


        const html =
          await resposta.text();


        // --------------------------------------------------------
        // CONVERSÃO PARA TEXTO
        // --------------------------------------------------------

        const textoPagina =
          html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/\s+/g, " ");


        // --------------------------------------------------------
        // LOCALIZAÇÃO DAS ESTAÇÕES
        // --------------------------------------------------------

        const linhaIraja =
          encontrarLinhaTexto(
            textoPagina,
            "Irajá"
          );


        const linhaSaoCristovao =
          encontrarLinhaTexto(
            textoPagina,
            "São Cristóvão"
          );


        if (!linhaIraja) {

          throw new Error(
            "Estação Irajá não encontrada no Alerta Rio."
          );

        }


        if (!linhaSaoCristovao) {

          throw new Error(
            "Estação São Cristóvão não encontrada no Alerta Rio."
          );

        }


        const ira =
          separarLinha(linhaIraja);


        const sc =
          separarLinha(linhaSaoCristovao);


        /*
         * TABELA PLUVIOMÉTRICA:
         *
         * [0] número
         * [1] estação
         * [2] localização
         * [3] hora
         * [4] 05 min
         * [5] 10 min
         * [6] 15 min
         * [7] 30 min
         * [8] 1h
         * [9] 2h
         * [10] 3h
         * [11] 4h
         * [12] 6h
         * [13] 12h
         * [14] 24h
         * [15] 96h
         * [16] mês
         * [17] TX-15
         */


        const chuvaIraja = {
          cinco_minutos: numero(ira[4]),
          dez_minutos: numero(ira[5]),
          quinze_minutos: numero(ira[6]),
          trinta_minutos: numero(ira[7]),
          uma_hora: numero(ira[8]),
          duas_horas: numero(ira[9]),
          tres_horas: numero(ira[10]),
          quatro_horas: numero(ira[11]),
          seis_horas: numero(ira[12]),
          doze_horas: numero(ira[13]),
          vinte_quatro_horas: numero(ira[14]),
          noventa_seis_horas: numero(ira[15]),
          mes: numero(ira[16])
        };


        const chuvaSaoCristovao = {
          cinco_minutos: numero(sc[4]),
          dez_minutos: numero(sc[5]),
          quinze_minutos: numero(sc[6]),
          trinta_minutos: numero(sc[7]),
          uma_hora: numero(sc[8]),
          duas_horas: numero(sc[9]),
          tres_horas: numero(sc[10]),
          quatro_horas: numero(sc[11]),
          seis_horas: numero(sc[12]),
          doze_horas: numero(sc[13]),
          vinte_quatro_horas: numero(sc[14]),
          noventa_seis_horas: numero(sc[15]),
          mes: numero(sc[16])
        };


        // --------------------------------------------------------
        // DADOS METEOROLÓGICOS
        // --------------------------------------------------------

        const blocoMeteorologico =
          html.match(
            /Dados Meteorológicos[\s\S]*?Situação Atual/i
          );


        let temperaturaSaoCristovao = null;
        let umidadeSaoCristovao = null;
        let ventoSaoCristovao = null;
        let direcaoVentoSaoCristovao = null;
        let horaMeteorologica = null;


        if (blocoMeteorologico) {

          const textoMeteorologico =
            blocoMeteorologico[0]
              .replace(/<script[\s\S]*?<\/script>/gi, "")
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/&nbsp;/gi, " ")
              .replace(/&amp;/gi, "&")
              .replace(/\s+/g, " ");


          const linhaSC =
            encontrarLinhaTexto(
              textoMeteorologico,
              "São Cristóvão"
            );


          if (linhaSC) {

            const dadosSC =
              separarLinha(linhaSC);


            /*
             * Dados meteorológicos:
             *
             * [0] número
             * [1] estação
             * [2] hora
             * [3] temperatura
             * [4] umidade
             * [5] pressão
             * [6] ponto de orvalho
             * [7] velocidade do vento
             * [8] direção do vento
             */

            horaMeteorologica =
              texto(dadosSC[2]);

            temperaturaSaoCristovao =
              numero(dadosSC[3]);

            umidadeSaoCristovao =
              numero(dadosSC[4]);

            ventoSaoCristovao =
              numero(dadosSC[7]);

            direcaoVentoSaoCristovao =
              numero(dadosSC[8]);

          }

        }


        // --------------------------------------------------------
        // RESPOSTA
        // --------------------------------------------------------

        return json(
          {
            sucesso: true,

            fonte: {
              nome: "Sistema Alerta Rio",
              orgao: "Centro de Operações Rio",
              url: ALERTA_RIO_URL
            },

            atualizado_em:
              texto(ira[3]),

            estacoes: {

              iraja: {

                nome: "Irajá",

                temperatura: null,

                umidade: null,

                chuva: chuvaIraja,

                vento: {
                  velocidade_kmh: null,
                  direcao_graus: null
                },

                hora_leitura:
                  texto(ira[3])

              },


              sao_cristovao: {

                nome: "São Cristóvão",

                temperatura_c:
                  temperaturaSaoCristovao,

                umidade_percentual:
                  umidadeSaoCristovao,

                chuva:
                  chuvaSaoCristovao,

                vento: {

                  velocidade_kmh:
                    ventoSaoCristovao,

                  direcao_graus:
                    direcaoVentoSaoCristovao

                },

                hora_leitura:
                  horaMeteorologica

              }

            }

          }
        );

      } catch (erro) {

        console.error(
          "Erro GET /api/alertario:",
          erro
        );

        return json(
          {
            sucesso: false,
            erro:
              "Não foi possível obter os dados oficiais do Alerta Rio.",
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
    // ROTA GET /api/previsao
    // PREVISÃO HORÁRIA - OPEN-METEO
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
                "precipitation",
                "rain",
                "precipitation_probability",
                "weather_code",
                "wind_speed_10m",
                "wind_direction_10m",
                "wind_gusts_10m"
              ].join(","),

            current:
              [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
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
                "Accept": "application/json"
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
          !dados.hourly.time
        ) {

          throw new Error(
            "Resposta horária inválida do Open-Meteo."
          );

        }


        // --------------------------------------------------------
        // TRANSFORMA OS VETORES HORÁRIOS EM OBJETOS
        // --------------------------------------------------------

        const horas =
          dados.hourly.time.map(
            (hora, index) => ({

              horario:
                hora,

              temperatura_c:
                dados.hourly.temperature_2m?.[index] ?? null,

              umidade_percentual:
                dados.hourly.relative_humidity_2m?.[index] ?? null,

              sensacao_c:
                dados.hourly.apparent_temperature?.[index] ?? null,

              precipitacao_mm:
                dados.hourly.precipitation?.[index] ?? null,

              chuva_mm:
                dados.hourly.rain?.[index] ?? null,

              probabilidade_chuva_percentual:
                dados.hourly.precipitation_probability?.[index] ?? null,

              codigo_tempo:
                dados.hourly.weather_code?.[index] ?? null,

              vento_kmh:
                dados.hourly.wind_speed_10m?.[index] ?? null,

              direcao_vento_graus:
                dados.hourly.wind_direction_10m?.[index] ?? null,

              rajada_kmh:
                dados.hourly.wind_gusts_10m?.[index] ?? null

            })
          );


        // --------------------------------------------------------
        // RESPOSTA
        // --------------------------------------------------------

        return json(
          {
            sucesso: true,

            fonte: {
              nome: "Open-Meteo",
              url:
                "https://open-meteo.com/"
            },

            localizacao: {

              latitude:
                LATITUDE,

              longitude:
                LONGITUDE,

              timezone:
                dados.timezone ||
                "America/Sao_Paulo"

            },

            atual:

              dados.current
                ? {

                    horario:
                      dados.current.time,

                    temperatura_c:
                      dados.current.temperature_2m ?? null,

                    umidade_percentual:
                      dados.current.relative_humidity_2m ?? null,

                    sensacao_c:
                      dados.current.apparent_temperature ?? null,

                    precipitacao_mm:
                      dados.current.precipitation ?? null,

                    chuva_mm:
                      dados.current.rain ?? null,

                    codigo_tempo:
                      dados.current.weather_code ?? null,

                    vento_kmh:
                      dados.current.wind_speed_10m ?? null,

                    direcao_vento_graus:
                      dados.current.wind_direction_10m ?? null,

                    rajada_kmh:
                      dados.current.wind_gusts_10m ?? null

                  }

                : null,

            previsao_horaria:
              horas

          }
        );

      } catch (erro) {

        console.error(
          "Erro GET /api/previsao:",
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
    // ROTA NÃO ENCONTRADA
    // ============================================================

    return corsResponse(
      json(
        {
          sucesso: false,
          erro: "Rota não encontrada.",
          rota: url.pathname,
          metodo: request.method
        },
        404
      )
    );

  }
};
