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

    const ALERTA_RIO =
      "https://websempre.rio.rj.gov.br/estacoes/";

    const COR_RIO =
      "https://cor.rio/category/estagios/";

    const OPEN_METEO =
      "https://api.open-meteo.com/v1/forecast";

    const GOES19 =
      "https://ftp.cptec.inpe.br/goes/goes19/";

    // =====================================================
    // CABEÇALHOS
    // =====================================================

    const jsonHeaders = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    };

    // =====================================================
    // FUNÇÕES AUXILIARES
    // =====================================================

    function respostaJSON(dados, status = 200) {

      return new Response(
        JSON.stringify(dados, null, 2),
        {
          status,
          headers: jsonHeaders
        }
      );

    }

    function limparHTML(texto) {

      return String(texto || "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/\s+/g, " ")
        .trim();

    }

    function numero(texto) {

      if (
        texto === null ||
        texto === undefined ||
        texto === ""
      ) {
        return null;
      }

      const valor = String(texto)
        .replace(",", ".")
        .replace(/[^\d.-]/g, "");

      const n = Number(valor);

      return Number.isFinite(n)
        ? n
        : null;

    }

    function grausParaDirecao(graus) {

      const n = numero(graus);

      if (n === null) {
        return "--";
      }

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

      const indice =
        Math.round(n / 45) % 8;

      return direcoes[indice];

    }

    // =====================================================
    // 1 — API DA NOSSA ESTAÇÃO
    //
    // IMPORTANTE:
    // ESTES DADOS CONTINUAM SIMULADOS
    // ATÉ O ARDUINO + SENSORES ESTAREM INSTALADOS.
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

        return respostaJSON({

          sucesso: true,

          estacao: ESTACAO,

          origem:
            "SIMULADO",

          aviso:
            "Os dados da Estação Constelación são simulados até a instalação dos sensores físicos.",

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

        return respostaJSON(
          {
            sucesso: false,
            erro:
              "Não foi possível consultar as leituras"
          },
          500
        );

      }

    }

    // =====================================================
    // 2 — RECEBER FUTURAMENTE DADOS REAIS
    // ARDUINO UNO + ESP8266
    // =====================================================

    if (
      url.pathname === "/api/leituras" &&
      request.method === "POST"
    ) {

      try {

        const token =
          request.headers.get(
            "Authorization"
          );

        if (!env.STATION_TOKEN) {

          return respostaJSON(
            {
              sucesso: false,
              erro:
                "STATION_TOKEN não configurado"
            },
            503
          );

        }

        if (
          token !==
          `Bearer ${env.STATION_TOKEN}`
        ) {

          return respostaJSON(
            {
              sucesso: false,
              erro:
                "Não autorizado"
            },
            401
          );

        }

        const dados =
          await request.json();

        const temperatura =
          Number(dados.temperatura);

        const umidade =
          Number(dados.umidade);

        const pressao =
          Number(dados.pressao);

        const chuva =
          Number(dados.chuva);

        const vento =
          Number(dados.vento);

        const direcao =
          String(
            dados.direcao_vento || ""
          ).toUpperCase();

        if (
          !Number.isFinite(temperatura) ||
          temperatura < -20 ||
          temperatura > 60
        ) {

          return respostaJSON(
            {
              sucesso: false,
              erro:
                "Temperatura inválida"
            },
            400
          );

        }

        if (
          !Number.isFinite(umidade) ||
          umidade < 0 ||
          umidade > 100
        ) {

          return respostaJSON(
            {
              sucesso: false,
              erro:
                "Umidade inválida"
            },
            400
          );

        }

        if (
          !Number.isFinite(pressao) ||
          pressao < 800 ||
          pressao > 1100
        ) {

          return respostaJSON(
            {
              sucesso: false,
              erro:
                "Pressão atmosférica inválida"
            },
            400
          );

        }

        if (
          !Number.isFinite(chuva) ||
          chuva < 0 ||
          chuva > 1000
        ) {

          return respostaJSON(
            {
              sucesso: false,
              erro:
                "Valor de chuva inválido"
            },
            400
          );

        }

        if (
          !Number.isFinite(vento) ||
          vento < 0 ||
          vento > 300
        ) {

          return respostaJSON(
            {
              sucesso: false,
              erro:
                "Velocidade do vento inválida"
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
          !direcoesValidas.includes(
            direcao
          )
        ) {

          return respostaJSON(
            {
              sucesso: false,
              erro:
                "Direção do vento inválida"
            },
            400
          );

        }

        const agora =
          new Date();

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
            "ESP8266"
          )
          .run();

        return respostaJSON({

          sucesso: true,

          mensagem:
            "Leitura recebida com sucesso",

          estacao:
            ESTACAO,

          origem:
            "REAL",

          dispositivo:
            "ESP8266",

          data_hora:
            agora.toISOString()

        });

      } catch (erro) {

        console.error(
          "Erro ao receber dados:",
          erro
        );

        return respostaJSON(
          {
            sucesso: false,
            erro:
              "Não foi possível processar a leitura"
          },
          400
        );

      }

    }

    // =====================================================
    // 3 — OPEN-METEO
    // PREVISÃO EXTERNA
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

        const parametros =
          [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation_probability",
            "precipitation",
            "pressure_msl",
            "wind_speed_10m",
            "wind_direction_10m"
          ].join(",");

        const apiUrl =
          `${OPEN_METEO}` +
          `?latitude=${latitude}` +
          `&longitude=${longitude}` +
          `&hourly=${parametros}` +
          `&forecast_days=2` +
          `&timezone=America%2FSao_Paulo` +
          `&temperature_unit=celsius` +
          `&wind_speed_unit=kmh` +
          `&precipitation_unit=mm`;

        const resposta =
          await fetch(apiUrl, {
            headers: {
              "User-Agent":
                "Estacao-Meteorologica-Constelacion/1.0"
            }
          });

        if (!resposta.ok) {

          throw new Error(
            `Open-Meteo HTTP ${resposta.status}`
          );

        }

        const previsao =
          await resposta.json();

        return respostaJSON({

          sucesso: true,

          fonte:
            "Open-Meteo",

          tipo:
            "PREVISÃO METEOROLÓGICA",

          atualizado_em:
            new Date().toISOString(),

          local: {

            latitude,

            longitude,

            descricao:
              LOCAL

          },

          previsao

        });

      } catch (erro) {

        console.error(
          "Erro Open-Meteo:",
          erro
        );

        return respostaJSON(
          {
            sucesso: false,
            fonte: "Open-Meteo",
            erro:
              "Não foi possível obter a previsão"
          },
          502
        );

      }

    }

    // =====================================================
    // 4 — ALERTA RIO
    //
    // DADOS OFICIAIS:
    // SÃO CRISTÓVÃO — ESTAÇÃO 32
    // IRAJÁ — ESTAÇÃO 11
    // =====================================================

    if (
      url.pathname === "/api/alertario" &&
      request.method === "GET"
    ) {

      try {

        const resposta =
          await fetch(
            ALERTA_RIO,
            {
              cache: "no-store",
              headers: {
                "User-Agent":
                  "Estacao-Meteorologica-Constelacion/1.0"
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

        // -------------------------------------------------
        // TABELAS
        // -------------------------------------------------

        const linhas =
          html.match(
            /<tr[\s\S]*?<\/tr>/gi
          ) || [];

        function extrairCelulas(linha) {

          const celulas =
            linha.match(
              /<td[\s\S]*?<\/td>/gi
            ) || [];

          return celulas.map(
            celula =>
              limparHTML(celula)
          );

        }

        // -------------------------------------------------
        // SÃO CRISTÓVÃO
        // -------------------------------------------------

        let meteorologia =
          null;

        for (
          const linha of linhas
        ) {

          if (
            /São Cristóvão/i.test(
              linha
            )
          ) {

            const valores =
              extrairCelulas(
                linha
              );

            if (
              valores.length >= 9
            ) {

              meteorologia =
                valores;

              break;

            }

          }

        }

        // -------------------------------------------------
        // IRAJÁ — CHUVA
        // -------------------------------------------------

        let chuva =
          null;

        for (
          const linha of linhas
        ) {

          if (
            /\bIrajá\b/i.test(
              linha
            )
          ) {

            const valores =
              extrairCelulas(
                linha
              );

            if (
              valores.length >= 16
            ) {

              chuva =
                valores;

              break;

            }

          }

        }

        // -------------------------------------------------
        // SITUAÇÃO ATUAL
        // -------------------------------------------------

        const situacao =
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

          const padrao =
            new RegExp(
              `${regiao}[\\s\\S]{0,150}?Estágio\\s*([1-5])`,
              "i"
            );

          const match =
            html.match(padrao);

          if (match) {

            situacao[regiao] =
              `Estágio ${match[1]}`;

          }

        }

        if (!meteorologia) {

          return respostaJSON(
            {
              sucesso: false,
              fonte:
                "Alerta Rio / Prefeitura do Rio",
              erro:
                "Não foi possível localizar São Cristóvão"
            },
            502
          );

        }

        return respostaJSON({

          sucesso: true,

          fonte:
            "Sistema Alerta Rio - Prefeitura do Rio de Janeiro",

          tipo:
            "DADOS OFICIAIS ATUALIZADOS",

          atualizado_em:
            new Date().toISOString(),

          sao_cristovao: {

            estacao:
              "São Cristóvão",

            numero_estacao:
              32,

            horario:
              meteorologia[2],

            temperatura:
              meteorologia[3],

            umidade:
              meteorologia[4],

            pressao:
              meteorologia[5],

            ponto_orvalho:
              meteorologia[6],

            vento:
              meteorologia[7],

            direcao_vento_graus:
              meteorologia[8],

            direcao_vento:
              grausParaDirecao(
                meteorologia[8]
              )

          },

          iraja: chuva
            ? {

                estacao:
                  "Irajá",

                numero_estacao:
                  11,

                localizacao:
                  chuva[2],

                horario:
                  chuva[3],

                cinco_minutos:
                  chuva[4],

                dez_minutos:
                  chuva[5],

                quinze_minutos:
                  chuva[6],

                trinta_minutos:
                  chuva[7],

                uma_hora:
                  chuva[8],

                duas_horas:
                  chuva[9],

                tres_horas:
                  chuva[10],

                quatro_horas:
                  chuva[11],

                seis_horas:
                  chuva[12],

                doze_horas:
                  chuva[13],

                vinte_quatro_horas:
                  chuva[14],

                noventa_e_seis_horas:
                  chuva[15]

              }
            : null,

          situacao

        });

      } catch (erro) {

        console.error(
          "Erro Alerta Rio:",
          erro
        );

        return respostaJSON(
          {
            sucesso: false,
            fonte:
              "Alerta Rio / Prefeitura do Rio",
            erro:
              "Não foi possível consultar o Alerta Rio"
          },
          502
        );

      }

    }

    // =====================================================
    // 5 — DEFESA CIVIL / COR-RIO
    //
    // O Worker consulta a página oficial e procura
    // a atualização mais recente de estágio.
    // =====================================================

    if (
      url.pathname === "/api/defesacivil" &&
      request.method === "GET"
    ) {

      try {

        const resposta =
          await fetch(
            COR_RIO,
            {
              cache: "no-store",
              headers: {
                "User-Agent":
                  "Estacao-Meteorologica-Constelacion/1.0"
              }
            }
          );

        if (!resposta.ok) {

          throw new Error(
            `COR-Rio HTTP ${resposta.status}`
          );

        }

        const html =
          await resposta.text();

        const texto =
          limparHTML(html);

        // -------------------------------------------------
        // PROCURAR O PRIMEIRO ESTÁGIO MENCIONADO
        // -------------------------------------------------

        const encontrados =
          [
            ...texto.matchAll(
              /Estágio\s+([1-5])/gi
            )
          ];

        let estagio =
          null;

        if (
          encontrados.length
        ) {

          estagio =
            Number(
              encontrados[0][1]
            );

        }

        // -------------------------------------------------
        // DATA/HORA DA CONSULTA
        // -------------------------------------------------

        const atualizado_em =
          new Date().toISOString();

        return respostaJSON({

          sucesso: true,

          fonte:
            "Centro de Operações e Resiliência - COR-Rio",

          tipo:
            "STATUS OFICIAL DO MUNICÍPIO",

          estagio,

          atualizado_em,

          url_fonte:
            COR_RIO,

          observacao:
            "O estágio é obtido da publicação oficial do COR-Rio. Consulte a fonte oficial para informações operacionais completas."

        });

      } catch (erro) {

        console.error(
          "Erro Defesa Civil:",
          erro
        );

        return respostaJSON(
          {
            sucesso: false,
            fonte:
              "COR-Rio / Defesa Civil",
            erro:
              "Não foi possível consultar o status oficial"
          },
          502
        );

      }

    }

    // =====================================================
    // 6 — SATÉLITE GOES-19 / CPTEC-INPE
    //
    // O INPE disponibiliza produtos GOES-19 em sua
    // infraestrutura de dados.
    // =====================================================

    if (
      url.pathname === "/api/satelite" &&
      request.method === "GET"
    ) {

      try {

        return respostaJSON({

          sucesso: true,

          fonte:
            "CPTEC/INPE",

          satelite:
            "GOES-19",

          atualizado_em:
            new Date().toISOString(),

          produtos: {

            base_dados:
              GOES19,

            broadcast:
              `${GOES19}broadcast/`,

            imagens_rgb:
              `${GOES19}rgb/`,

            vento:
              `${GOES19}vento/`,

            rad_solar:
              `${GOES19}rad_solar/`

          },

          observacao:
            "Os produtos são disponibilizados pelo CPTEC/INPE. A atualização depende da disponibilidade do produto oficial."

        });

      } catch (erro) {

        console.error(
          "Erro satélite:",
          erro
        );

        return respostaJSON(
          {
            sucesso: false,
            fonte:
              "CPTEC/INPE",
            erro:
              "Não foi possível consultar os dados do satélite"
          },
          502
        );

      }

    }

    // =====================================================
    // 7 — STATUS GERAL DAS FONTES
    //
    // ÚTIL PARA O DASHBOARD SABER SE AS FONTES ESTÃO
    // RESPONDENDO.
    // =====================================================

    if (
      url.pathname === "/api/status" &&
      request.method === "GET"
    ) {

      return respostaJSON({

        sucesso: true,

        estacao_constelacion: {

          status:
            "SIMULADO",

          motivo:
            "Sensores físicos ainda não instalados"

        },

        fontes_externas: {

          open_meteo:
            "ATIVA",

          alerta_rio:
            "ATIVA",

          defesa_civil_cor:
            "ATIVA",

          cptec_inpe_goes19:
            "ATIVA"

        },

        atualizado_em:
          new Date().toISOString()

      });

    }

    // =====================================================
    // 8 — SITE
    // =====================================================

    if (
      url.pathname === "/"
    ) {

      return env.ASSETS.fetch(
        request
      );

    }

    // =====================================================
    // 9 — ROTA NÃO ENCONTRADA
    // =====================================================

    return respostaJSON(
      {
        sucesso: false,
        erro:
          "Rota não encontrada"
      },
      404
    );

  },

  // =====================================================
  // SIMULADOR DA ESTAÇÃO CONSTELACIÓN
  //
  // ESTES DADOS CONTINUAM SIMULADOS.
  // SERÃO SUBSTITUÍDOS PELOS SENSORES FUTURAMENTE.
  // =====================================================

  async scheduled(
    event,
    env,
    ctx
  ) {

    try {

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

    } catch (erro) {

      console.error(
        "Erro no simulador:",
        erro
      );

    }

  }

};
