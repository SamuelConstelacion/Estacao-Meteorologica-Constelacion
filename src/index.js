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
      return new Response(
        "Estação Meteorológica Constelación - API online",
        {
          headers: {
            "content-type": "text/plain; charset=UTF-8"
          }
        }
      );
    }

    return Response.json(
      {
        sucesso: false,
        erro: "Rota não encontrada"
      },
      { status: 404 }
    );
  }
};
