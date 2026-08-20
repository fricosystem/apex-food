'use strict';

const { executar } = require('../../_lib/middleware');
const { exigirSessao } = require('../../_lib/sessao');
const { getAdminDb } = require('../../../backend/firebase/admin');

module.exports = async function restaurantes(req, res) {
  return executar(req, res, { metodos: ['GET'], appCheck: true }, async () => {
    const sessao = await exigirSessao(req);
    const consulta = await getAdminDb()
      .collectionGroup('membros')
      .where('idUsuario', '==', sessao.uid)
      .limit(50)
      .get();

    const itens = [];
    for (const documento of consulta.docs) {
      const dadosMembro = documento.data() || {};
      const restauranteRef = documento.ref.parent.parent;
      const idRestaurante = restauranteRef?.id;
      if (!idRestaurante || dadosMembro.estado !== 'ativo' || dadosMembro.idRestaurante !== idRestaurante) continue;
      const restaurante = await getAdminDb().collection('restaurantes').doc(idRestaurante).get();
      if (!restaurante.exists) continue;
      const dados = restaurante.data() || {};
      itens.push({
        idRestaurante,
        nome: typeof dados.nome === 'string' ? dados.nome : 'Restaurante',
        estado: dados.estado || 'ativo',
        papeis: Array.isArray(dadosMembro.papeis) ? dadosMembro.papeis.slice(0, 20) : [],
      });
    }

    return { corpo: { restaurantes: itens } };
  });
};
