export default {

  async fetch(request, env) {

    const url = new URL(request.url);


    // =====================================================
    // CONFIGURAÇÕES
    // =====================================================

    const ESTACAO =
      "Estação Meteorológica Constelación";

    const LOCAL =
      "Estrada do Barro Vermelho, Colégio - Rio de Janeiro";


    // =====================================================
    // API - ÚLTIMAS LEITURAS
    // =====================================================

    if (
      url.pathname === "/api/leituras" &&
      request.method === "GET"
    ) {

      try {

        const resultado =
          await env.DB.prepare(`
            SELECT *
            FROM leituras
            ORDER BY id DESC
            LIMIT 20
          `).all();


        return Response.json({

          sucesso: true,

          estacao: ESTACAO,

          quantidade:
            resultado.results.length,

          leituras:
            resultado.results

        });


      } catch (erro) {

        console.error(
          "Erro ao consultar D1:",
          erro
        );


        return Response.json(
          {

            sucesso: false,

            erro:
              "Não foi possível consultar as leituras"

          },

          {
            status: 500
          }
        );

      }

    }


    // =====================================================
    // API - RECEBER DADOS DO ESP32
    // =====================================================

    if (
      url.pathname === "/api/leituras" &&
      request.method === "POST"
    ) {

      try {

        // -------------------------------------------------
        // PROTEÇÃO DO ENDPOINT
        // -------------------------------------------------

        const token =
          request.headers.get(
            "Authorization"
          );


        /*
         * O token será configurado futuramente
         * como variável secreta no Cloudflare:
         *
         * STATION_TOKEN
         *
         * Enquanto não configurarmos o token,
         * o endpoint permanece bloqueado.
         */


        if (
          !env.STATION_TOKEN
        ) {

          return Response.json(
            {

              sucesso: false,

              erro:
                "STATION_TOKEN não configurado"

            },

            {
              status: 503
            }
          );

        }


        if (
          token !==
          `Bearer ${env.STATION_TOKEN}`
        ) {

          return Response.json(
            {

              sucesso: false,

              erro:
                "Não autorizado"

            },

            {
              status: 401
            }
          );

        }


        // -------------------------------------------------
        // RECEBER JSON
        // -------------------------------------------------

        const dados =
          await request.json();


        // -------------------------------------------------
        // VALIDAR DADOS
        // -------------------------------------------------

        const temperatura =
          Number(
            dados.temperatura
          );


        const umidade =
          Number(
            dados.umidade
          );


        const pressao =
          Number(
            dados.pressao
          );


        const chuva =
          Number(
            dados.chuva
          );


        const vento =
          Number(
            dados.vento
          );


        const direcao =
          String(
            dados.direcao_vento || ""
          );


        // -------------------------------------------------
        // VERIFICAÇÃO DOS VALORES
        // -------------------------------------------------

        if (
          !Number.isFinite(temperatura) ||
          temperatura < -20 ||
          temperatura > 60
        ) {

          return Response.json(
            {

              sucesso: false,

              erro:
                "Temperatura inválida"

            },

            {
              status: 400
            }
          );

        }


        if (
          !Number.isFinite(umidade) ||
          umidade < 0 ||
          umidade > 100
        ) {

          return Response.json(
            {

              sucesso: false,

              erro:
                "Umidade inválida"

            },

            {
              status: 400
            }
          );

        }


        if (
          !Number.isFinite(pressao) ||
          pressao < 800 ||
          pressao > 1100
        ) {

          return Response.json(
            {

              sucesso: false,

              erro:
                "Pressão atmosférica inválida"

            },

            {
              status: 400
            }
          );

        }


        if (
          !Number.isFinite(chuva) ||
          chuva < 0 ||
          chuva > 1000
        ) {

          return Response.json(
            {

              sucesso: false,

              erro:
                "Valor de chuva inválido"

            },

            {
              status: 400
            }
          );

        }


        if (
          !Number.isFinite(vento) ||
          vento < 0 ||
          vento > 300
        ) {

          return Response.json(
            {

              sucesso: false,

              erro:
                "Velocidade do vento inválida"

            },

            {
              status: 400
            }
          );

        }


        // -------------------------------------------------
        // DIREÇÃO DO VENTO
        // -------------------------------------------------

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
            direcao
          )
        ) {

          return Response.json(
            {

              sucesso: false,

              erro:
                "Direção do vento inválida"

            },

            {
              status: 400
            }
          );

        }


        // -------------------------------------------------
        // DATA/HORA
        // -------------------------------------------------

        const agora =
          new Date();


        // -------------------------------------------------
        // GRAVAR NO D1
        // -------------------------------------------------

        await env.DB.prepare(`

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

          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?)

        `)

          .bind(

            agora.toISOString(),

            temperatura,

            umidade,

            pressao,

            chuva,

            vento,

            direcao,

            "REAL",

            "ESP32"

          )

          .run();


        // -------------------------------------------------
        // RESPOSTA
        // -------------------------------------------------

        return Response.json({

          sucesso: true,

          mensagem:
            "Leitura recebida com sucesso",

          estacao:
            ESTACAO,

          origem:
            "REAL",

          dispositivo:
            "ESP32",

          data_hora:
            agora.toISOString()

        });


      } catch (erro) {

        console.error(
          "Erro ao receber dados do ESP32:",
          erro
        );


        return Response.json(
          {

            sucesso: false,

            erro:
              "Não foi possível processar a leitura"

          },

          {
            status: 400
          }
        );

      }

    }


    // =====================================================
    // API - PREVISÃO METEOROLÓGICA
    // =====================================================

    if (
      url.pathname === "/api/previsao" &&
      request.method === "GET"
    ) {

      try {

        const latitude =
          -22.84563;

        const longitude =
          -43.33847;


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


        const resposta =
          await fetch(apiUrl);


        if (
          !resposta.ok
        ) {

          return Response.json(
            {

              sucesso: false,

              erro:
                "Não foi possível obter a previsão meteorológica"

            },

            {
              status: 502
            }
          );

        }


        const previsao =
          await resposta.json();


        return Response.json({

          sucesso: true,

          fonte:
            "Open-Meteo",

          local: {

            latitude:
              latitude,

            longitude:
              longitude,

            descricao:
              LOCAL

          },

          previsao:
            previsao

        });


      } catch (erro) {

        console.error(
          "Erro previsão:",
          erro
        );


        return Response.json(
          {

            sucesso: false,

            erro:
              "Erro ao consultar previsão meteorológica"

          },

          {
            status: 502
          }
        );

      }

    }


    // =====================================================
    // API - ALERTA RIO
    // =====================================================

    if (
      url.pathname === "/api/alertario" &&
      request.method === "GET"
    ) {

      try {

        const resposta =
          await fetch(
            "https://websempre.rio.rj.gov.br/estacoes/"
          );


        if (
          !resposta.ok
        ) {

          throw new Error(
            "Erro ao acessar o Alerta Rio"
          );

        }


        const html =
          await resposta.text();


        // -------------------------------------------------
        // LOCALIZAR LINHAS
        // -------------------------------------------------

        const linhas =
          html.match(
            /<tr[\s\S]*?<\/tr>/gi
          ) || [];


        // =================================================
        // SÃO CRISTÓVÃO
        // =================================================

        let dadosMeteorologicos =
          null;


        for (
          const linha of linhas
        ) {

          if (
            linha.includes(
              "São Cristóvão"
            )
          ) {

            const celulas =
              linha.match(
                /<td[\s\S]*?<\/td>/gi
              ) || [];


            const valores =
              celulas.map(
                celula =>
                  celula
                    .replace(
                      /<[^>]*>/g,
                      ""
                    )
                    .replace(
                      /&nbsp;/g,
                      " "
                    )
                    .trim()
              );


            if (
              valores.length >= 9
            ) {

              dadosMeteorologicos =
                valores;

            }

          }

        }


        // =================================================
        // IRAJÁ
        // =================================================

        let dadosChuva =
          null;


        for (
          const linha of linhas
        ) {

          if (
            linha.includes(
              "Irajá"
            )
          ) {

            const celulas =
              linha.match(
                /<td[\s\S]*?<\/td>/gi
              ) || [];


            const valores =
              celulas.map(
                celula =>
                  celula
                    .replace(
                      /<[^>]*>/g,
                      ""
                    )
                    .replace(
                      /&nbsp;/g,
                      " "
                    )
                    .trim()
              );


            if (
              valores.length >= 16
            ) {

              dadosChuva =
                valores;

            }

          }

        }


        // =================================================
        // SITUAÇÃO DO ALERTA RIO
        // =================================================

        const situacoes =
          {};


        const regioes = [

          "Baía de Guanabara",

          "Baía de Sepetiba",

          "Barra/Jacarepaguá",

          "Zona Sul"

        ];


        for (
          const regiao of regioes
        ) {

          const indice =
            html.indexOf(
              regiao
            );


          if (
            indice !== -1
          ) {

            const trecho =
              html.substring(
                indice,
                indice + 150
              );


            const match =
              trecho.match(
                /Estágio\s+([1-5])/i
              );


            if (
              match
            ) {

              situacoes[regiao] =
                `Estágio ${match[1]}`;

            }

          }

        }


        // -------------------------------------------------
        // VERIFICAÇÃO
        // -------------------------------------------------

        if (
          !dadosMeteorologicos
        ) {

          return Response.json(
            {

              sucesso: false,

              erro:
                "Não foi possível localizar São Cristóvão no Alerta Rio"

            },

            {
              status: 502
            }
          );

        }


        if (
          !dadosChuva
        ) {

          return Response.json(
            {

              sucesso: false,

              erro:
                "Não foi possível localizar Irajá no Alerta Rio"

            },

            {
              status: 502
            }
          );

        }


        // =================================================
        // RESPOSTA FINAL
        // =================================================

        return Response.json({

          sucesso: true,

          fonte:
            "Sistema Alerta Rio - Prefeitura do Rio de Janeiro",

          estacao:
            "São Cristóvão",

          numero_estacao:
            32,

          dados: {

            horario:
              dadosMeteorologicos[2],

            temperatura:
              dadosMeteorologicos[3],

            umidade:
              dadosMeteorologicos[4],

            pressao:
              dadosMeteorologicos[5],

            ponto_orvalho:
              dadosMeteorologicos[6],

            vento:
              dadosMeteorologicos[7],

            direcao_vento:
              dadosMeteorologicos[8]

          },

          chuva: {

            estacao:
              "Irajá",

            numero_estacao:
              11,

            localizacao:
              dadosChuva[2],

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

          },

          situacao:
            situacoes

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

          {
            status: 502
          }
        );

      }

    }


    // =====================================================
    // SITE
    // =====================================================

    if (
      url.pathname === "/"
    ) {

      return env.ASSETS.fetch(
        request
      );

    }


    // =====================================================
    // ROTA NÃO ENCONTRADA
    // =====================================================

    return Response.json(
      {

        sucesso: false,

        erro:
          "Rota não encontrada"

      },

      {
        status: 404
      }
    );

  },


  // =====================================================
  // SIMULADOR METEOROLÓGICO
  // =====================================================

  async scheduled(
    event,
    env,
    ctx
  ) {

    const agora =
      new Date();


    const temperatura =
      Number(
        (
          25 +
          Math.random() * 5
        ).toFixed(1)
      );


    const umidade =
      Number(
        (
          65 +
          Math.random() * 20
        ).toFixed(1)
      );


    const pressao =
      Number(
        (
          1010 +
          Math.random() * 8
        ).toFixed(1)
      );


    const chuva =
      Math.random() < 0.15
        ? Number(
            (
              Math.random() * 3
            ).toFixed(1)
          )
        : 0;


    const vento =
      Number(
        (
          5 +
          Math.random() * 20
        ).toFixed(1)
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
        Math.floor(
          Math.random() *
          direcoes.length
        )
      ];


    // -----------------------------------------------------
    // GRAVAR DADOS SIMULADOS
    // -----------------------------------------------------

    await env.DB.prepare(`

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

      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?)

    `)

      .bind(

        agora.toISOString(),

        temperatura,

        umidade,

        pressao,

        chuva,

        vento,

        direcao,

        "SIMULADO",

        "simulador"

      )

      .run();

  }

};
