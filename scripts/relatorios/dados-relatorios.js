(() => {
  'use strict';

  const estadoVazio = () => ({
    atualizadoEm: '',
    pedidosConsiderados: 0,
    produtosBase: 0,
    vendasDiarias: [],
    vendasSemanais: [],
    vendasMensais: [],
    canais: [],
    produtosMaisVendidos: [],
    diasSemana: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'],
    faixasHorarias: ['11h–12h', '12h–13h', '13h–14h', '14h–15h', '15h–16h', '18h–19h', '19h–20h', '20h–21h', '21h–22h', '22h–23h'],
    mapaCalor: [],
    avaliacoes: [],
    distribuicaoNotas: [],
    performanceEquipe: [],
    indicadores: { notaMedia: 0, totalAvaliacoes: 0, taxaResposta: 0, vendasHoje: 0, pedidosHoje: 0, picoAlmoco: '—', picoJantar: '—' },
  });

  window.dadosRelatoriosApexFood = estadoVazio();

  const lista = (resposta, chave) => {
    if (!resposta) return [];
    if (Array.isArray(resposta)) return resposta;
    if (Array.isArray(resposta[chave])) return resposta[chave];
    if (resposta.dados && Array.isArray(resposta.dados[chave])) return resposta.dados[chave];
    return [];
  };

  const numero = valor => {
    if (valor === null || valor === undefined || valor === '') return 0;
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? convertido : 0;
  };

  const valorMonetario = objeto => {
    if (!objeto) return 0;
    if (objeto.valorCentavos !== undefined) return numero(objeto.valorCentavos) / 100;
    if (objeto.totalCentavos !== undefined) return numero(objeto.totalCentavos) / 100;
    return numero(objeto.valor ?? objeto.total ?? objeto.valorTotal ?? objeto.receita);
  };

  const dataObjeto = objeto => {
    const valor = objeto?.criadoEm || objeto?.dataCriacao || objeto?.data || objeto?.atualizadoEm || objeto?.timestamp;
    if (!valor) return null;
    if (typeof valor === 'object' && typeof valor.toDate === 'function') return valor.toDate();
    if (typeof valor === 'number') return new Date(valor);
    if (typeof valor === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(valor)) {
      const [dia, mes, ano] = valor.slice(0, 10).split('/').map(Number);
      return new Date(ano, mes - 1, dia);
    }
    const convertido = new Date(valor);
    return Number.isNaN(convertido.getTime()) ? null : convertido;
  };

  const chaveDia = data => data ? `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}` : '';
  const nomeMes = data => data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const inicioSemana = data => { const copia = new Date(data); const dia = copia.getDay() || 7; copia.setDate(copia.getDate() - dia + 1); copia.setHours(0, 0, 0, 0); return copia; };
  const formatarAtualizacao = data => data ? data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';

  function pedidoValido(pedido) {
    return !['cancelado', 'cancelada', 'excluido', 'excluida'].includes(String(pedido?.status || pedido?.estado || '').toLowerCase());
  }

  function itensPedido(pedido) {
    return Array.isArray(pedido?.itens) ? pedido.itens : Array.isArray(pedido?.items) ? pedido.items : [];
  }

  function construirDados(respostas) {
    const pedidos = lista(respostas.pedidos, 'pedidos').filter(pedidoValido);
    const cardapio = respostas.cardapio || {};
    const produtos = lista(cardapio, 'produtos');
    const categorias = lista(cardapio, 'categorias');
    const equipe = respostas.equipe || {};
    const funcionarios = lista(equipe, 'funcionarios');
    const comissoes = lista(equipe, 'comissoes');
    const financeiro = respostas.financeiro || {};
    const movimentacoes = lista(financeiro, 'movimentacoes');
    const mapaProdutos = new Map(produtos.map(produto => [String(produto.id), produto]));
    const mapaCategorias = new Map(categorias.map(categoria => [String(categoria.id), categoria]));
    const agora = new Date();

    const porDia = new Map();
    const porSemana = new Map();
    const porMes = new Map();
    const porCanal = new Map();
    const porProduto = new Map();
    const porHorario = new Map();

    pedidos.forEach(pedido => {
      const data = dataObjeto(pedido);
      const valor = valorMonetario(pedido) || itensPedido(pedido).reduce((total, item) => total + (numero(item.quantidade || item.qtd || 1) * valorMonetario(item)), 0);
      const canalId = String(pedido.canal || pedido.origem || pedido.tipoAtendimento || 'outros').toLowerCase();
      const canalNome = { salao: 'Salão', delivery: 'Delivery', retirada: 'Retirada', mesa: 'Salão' }[canalId] || 'Outros';
      const canalAtual = porCanal.get(canalNome) || { nome: canalNome, vendas: 0, pedidos: 0 };
      canalAtual.vendas += valor; canalAtual.pedidos += 1; porCanal.set(canalNome, canalAtual);
      if (data) {
        const dia = chaveDia(data);
        const registroDia = porDia.get(dia) || { data: dia, label: `${String(data.getDate()).padStart(2, '0')} ${nomeMes(data)}`, pedidos: 0, vendas: 0 };
        registroDia.pedidos += 1; registroDia.vendas += valor; porDia.set(dia, registroDia);
        const semanaData = inicioSemana(data); const semana = chaveDia(semanaData);
        const registroSemana = porSemana.get(semana) || { inicio: semana, pedidos: 0, vendas: 0 };
        registroSemana.pedidos += 1; registroSemana.vendas += valor; porSemana.set(semana, registroSemana);
        const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        const registroMes = porMes.get(mes) || { periodo: data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }), pedidos: 0, vendas: 0 };
        registroMes.pedidos += 1; registroMes.vendas += valor; porMes.set(mes, registroMes);
        const hora = data.getHours();
        if (hora >= 11) {
          const faixa = hora < 16 ? Math.min(hora - 11, 4) : Math.min(Math.max(hora - 18, 0) + 5, 9);
          const chave = `${data.getDay() || 7}-${faixa}`;
          porHorario.set(chave, (porHorario.get(chave) || 0) + 1);
        }
      }
      itensPedido(pedido).forEach(item => {
        const produtoId = String(item.produtoId || item.idProduto || item.produto || 'sem-produto');
        const produtoBase = mapaProdutos.get(produtoId) || {};
        const atual = porProduto.get(produtoId) || { produtoId, nome: item.nome || item.nomeProduto || produtoBase.nome || 'Produto sem identificação', categoriaId: item.categoriaId || produtoBase.categoria || 'outros', quantidade: 0, receita: 0, preco: valorMonetario(item) || numero(produtoBase.preco) };
        const quantidade = Math.max(1, numero(item.quantidade || item.qtd || 1));
        const totalItem = item.totalCentavos !== undefined ? numero(item.totalCentavos) / 100 : (item.total !== undefined ? numero(item.total) : valorMonetario(item) * quantidade);
        atual.quantidade += quantidade; atual.receita += totalItem; porProduto.set(produtoId, atual);
      });
    });

    const vendasDiarias = [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data)).slice(-31).map(item => ({ ...item, ticketMedio: item.vendas / Math.max(item.pedidos, 1) }));
    const vendasSemanais = [...porSemana.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([, item]) => ({ periodo: item.inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''), pedidos: item.pedidos, vendas: item.vendas, ticketMedio: item.vendas / Math.max(item.pedidos, 1) }));
    const vendasMensais = [...porMes.values()].slice(-12).map(item => ({ ...item, ticketMedio: item.vendas / Math.max(item.pedidos, 1) }));
    const totalVendas = pedidos.reduce((total, pedido) => total + valorMonetario(pedido), 0);
    const canais = [...porCanal.values()].map((item, indice) => ({ ...item, percentual: totalVendas ? Math.round(item.vendas / totalVendas * 100) : 0, cor: ['bg-accent', 'bg-blue', 'bg-purple', 'bg-green'][indice % 4], icone: ['armchair', 'bike', 'shopping-bag', 'layers'][indice % 4] }));
    const produtosMaisVendidos = [...porProduto.values()].sort((a, b) => b.quantidade - a.quantidade).map((item, indice) => { const categoria = mapaCategorias.get(String(item.categoriaId)); const produto = mapaProdutos.get(String(item.produtoId)) || {}; const preco = item.preco || numero(produto.preco); const custo = numero(produto.custo); return { ...item, posicao: indice + 1, categoria: categoria?.nome || 'Sem categoria', preco, custo, margem: preco && custo ? Math.round((preco - custo) / preco * 100) : 0, variacao: 0 }; });
    const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const faixasHorarias = ['11h–12h', '12h–13h', '13h–14h', '14h–15h', '15h–16h', '18h–19h', '19h–20h', '20h–21h', '21h–22h', '22h–23h'];
    const mapaCalor = diasSemana.map((_, dia) => faixasHorarias.map((_, faixa) => porHorario.get(`${dia + 1}-${faixa}`) || 0));
    const comissoesMapa = new Map(comissoes.map(item => [String(item.funcionarioId), item]));
    const performanceEquipe = funcionarios.filter(item => ['Garçom', 'Garçonete', 'Bartender'].includes(item.cargo)).map(item => { const comissao = comissoesMapa.get(String(item.id)) || {}; return { funcionarioId: item.id, nome: item.nome, iniciais: item.iniciais || '', cargo: item.cargo, turno: item.turno || '', status: item.status, vendas: numero(item.vendasMes || item.vendas), pedidos: numero(item.pedidos), avaliacao: numero(item.avaliacao), percentualComissao: numero(comissao.percentual || item.comissao), comissao: numero(comissao.comissao), variacao: numero(comissao.variacao), cor: item.cor || 'from-accent to-orange-400' }; }).sort((a, b) => b.vendas - a.vendas).map((item, indice) => ({ ...item, posicao: indice + 1 }));
    const hoje = pedidos.filter(pedido => { const data = dataObjeto(pedido); return data && chaveDia(data) === chaveDia(agora); });
    const atualizado = pedidos.map(dataObjeto).filter(Boolean).sort((a, b) => b - a)[0] || agora;
    return { atualizadoEm: formatarAtualizacao(atualizado), pedidosConsiderados: pedidos.length, produtosBase: produtos.length, vendasDiarias, vendasSemanais, vendasMensais, canais, produtosMaisVendidos, diasSemana, faixasHorarias, mapaCalor, avaliacoes: [], distribuicaoNotas: [], performanceEquipe, indicadores: { notaMedia: 0, totalAvaliacoes: 0, taxaResposta: 0, vendasHoje: hoje.reduce((total, pedido) => total + valorMonetario(pedido), 0), pedidosHoje: hoje.length, picoAlmoco: '—', picoJantar: '—' } };
  }

  async function carregarDadosRelatorios() {
    const api = window.apexModulosApi;
    if (!api) return window.dadosRelatoriosApexFood;
    const resultados = await Promise.allSettled([api.listarPedidos(), api.listarCardapio(), api.listarEquipe(), api.listarFinanceiro()]);
    const respostas = { pedidos: resultados[0].status === 'fulfilled' ? resultados[0].value : {}, cardapio: resultados[1].status === 'fulfilled' ? resultados[1].value : {}, equipe: resultados[2].status === 'fulfilled' ? resultados[2].value : {}, financeiro: resultados[3].status === 'fulfilled' ? resultados[3].value : {} };
    Object.assign(window.dadosRelatoriosApexFood, construirDados(respostas));
    document.dispatchEvent(new CustomEvent('apex:relatorios-atualizado'));
    return window.dadosRelatoriosApexFood;
  }

  window.recarregarRelatorios = carregarDadosRelatorios;
  carregarDadosRelatorios().catch(() => { document.dispatchEvent(new CustomEvent('apex:relatorios-atualizado')); });
})();
