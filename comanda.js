// comanda.js - Versão Corrigida com NUMERAÇÃO DE COMANDAS FUNCIONANDO CORRETAMENTE

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, doc, getDocs, getDoc, 
    query, where, orderBy, Timestamp, onSnapshot, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

//BANCO DE DADOS

const firebaseConfig = {
    apiKey: "AIzaSyC5xXm9T2nzh6xxZ5-zrMHfCNdqQOG8SZI",
    authDomain: "studio-nogueira-e07bb.firebaseapp.com",
    projectId: "studio-nogueira-e07bb",
    storageBucket: "studio-nogueira-e07bb.firebasestorage.app",
    messagingSenderId: "150077330983",
    appId: "1:150077330983:web:a49838c4cde9df4e1de002",
    measurementId: "G-WX477KDZQC"
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Estado global
let comandas = [], servicos = [], produtos = [], clientes = [], profissionais = [], pacotes = [];
let currentFilter = "aberta", currentBarbeiroFilter = "", currentSearch = "", currentPeriodo = "hoje";
let dataInicioPersonalizada = "", dataFimPersonalizada = "";
let unsubscribeComandas = null, comandaEditando = null;
let descontoAplicado = { valor: 0, tipo: "percentual", programaId: null, nomePrograma: null, produtosIds: [] };
let produtosDisponiveis = [], produtosSelecionadosPrograma = [];

// Variáveis para filtro de comanda específica
let filtrandoComandaEspecifica = false;
let comandaEspecificaId = null;

// Variáveis para ausência e cancelamento
let comandaParaAusencia = null;
let comandaParaReativar = null;
let comandaParaCancelamento = null;
let comandaParaReativarCancelada = null;

// Exportar funções globais
window.comandaEditando = null;
window.db = db;
window.getDoc = getDoc;
window.doc = doc;

// Elementos DOM
const comandasGrid = document.getElementById("comandasGrid");
const modalComanda = document.getElementById("modalComanda");
const modalDetalhes = document.getElementById("modalDetalhesComanda");
const modalEditarComanda = document.getElementById("modalEditarComanda");
const comandaCliente = document.getElementById("comandaCliente");
const comandaBarbeiro = document.getElementById("comandaBarbeiro");
const comandaServicosContainer = document.getElementById("comandaServicosContainer");
const btnAdicionarServico = document.getElementById("btnAdicionarServicoComanda");
const btnSalvarComanda = document.getElementById("btnSalvarComanda");
const btnFinalizarComanda = document.getElementById("btnFinalizarComanda");
const filterStatus = document.getElementById("filterStatusComanda");
const filterBarbeiro = document.getElementById("filterBarbeiroComanda");
const filterPeriodo = document.getElementById("filterPeriodoComanda");
const periodoPersonalizadoDiv = document.getElementById("periodoPersonalizado");
const dataInicioPersonalizadaInput = document.getElementById("dataInicioPersonalizada");
const dataFimPersonalizadaInput = document.getElementById("dataFimPersonalizada");
const searchInput = document.getElementById("searchComanda");
const btnLimparFiltros = document.getElementById("btnLimparFiltrosComanda");

// Métricas
const totalComandasEl = document.getElementById("totalComandas");
const faturamentoDiaEl = document.getElementById("faturamentoDia");
const mediaComandaEl = document.getElementById("mediaComanda");
const clientesAtendidosEl = document.getElementById("clientesAtendidos");

// ==================== FUNÇÕES UTILITÁRIAS ====================

function mostrarToast(msg, tipo = "sucesso") {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        toast.innerHTML = '<i class="fa-solid fa-circle-check"></i><span id="toastMsg"></span>';
        document.body.appendChild(toast);
    }
    const toastMsg = document.getElementById("toastMsg");
    if (toastMsg) toastMsg.textContent = msg;
    toast.style.background = tipo === "sucesso" ? "linear-gradient(135deg, #2199EF, #1a7fcc)" : "linear-gradient(135deg, #ef4444, #dc2626)";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

window.mostrarToast = mostrarToast;

function formatarMoeda(v) { 
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); 
}

function escapeHtml(t) { 
    if (!t) return ''; 
    const d = document.createElement('div'); 
    d.textContent = t; 
    return d.innerHTML; 
}

function getMetodoIcon(metodo) {
    const icons = {
        'dinheiro': '💵',
        'pix': '📱',
        'cartao_credito': '💳',
        'cartao_debito': '💳',
        'transferencia': '🏦',
        'pendente': '⏳'
    };
    return icons[metodo] || '💰';
}

function getMetodoNome(metodo) {
    const nomes = {
        'dinheiro': 'Dinheiro',
        'pix': 'Pix',
        'cartao_credito': 'Cartão Crédito',
        'cartao_debito': 'Cartão Débito',
        'transferencia': 'Transferência',
        'pendente': 'Pendente'
    };
    return nomes[metodo] || metodo;
}

// ==================== FUNÇÕES PARA NUMERAÇÃO SEQUENCIAL (CORRIGIDAS) ====================

async function getProximoNumeroComanda() {
    try {
        console.log("🔢 Buscando próximo número de comanda...");
        
        const comandasSnapshot = await getDocs(collection(db, "comandas"));
        const numerosExistentes = [];
        
        comandasSnapshot.forEach(doc => {
            const data = doc.data();
            // Verifica se o número existe e é válido
            if (data.numeroComanda) {
                let num = data.numeroComanda;
                if (typeof num === 'string') {
                    num = parseInt(num);
                }
                if (typeof num === 'number' && !isNaN(num) && num > 0) {
                    numerosExistentes.push(num);
                }
            }
        });
        
        console.log(`📊 Números existentes (${numerosExistentes.length}): ${numerosExistentes.sort((a,b) => a-b).join(', ')}`);
        
        let proximoNumero = 1;
        if (numerosExistentes.length > 0) {
            proximoNumero = Math.max(...numerosExistentes) + 1;
        }
        
        // Garantir que o número seja um inteiro positivo
        proximoNumero = Math.max(1, Math.floor(proximoNumero));
        
        console.log(`🔢 Próximo número disponível: ${proximoNumero}`);
        return proximoNumero;
        
    } catch (error) {
        console.error("❌ Erro ao gerar próximo número de comanda:", error);
        const fallbackNumero = Math.floor(Date.now() % 100000);
        console.log(`⚠️ Usando número de fallback: ${fallbackNumero}`);
        return fallbackNumero;
    }
}

// FUNÇÃO CORRIGIDA: getNumeroExibido agora tem fallback usando o ID
function getNumeroExibido(comanda) {
    // Prioridade 1: número salvo como número válido
    if (comanda.numeroComanda && typeof comanda.numeroComanda === 'number' && comanda.numeroComanda > 0) {
        return comanda.numeroComanda;
    }
    // Prioridade 2: número salvo como string que não seja "?" ou vazio
    if (comanda.numeroComanda && typeof comanda.numeroComanda === 'string' && 
        comanda.numeroComanda !== "?" && comanda.numeroComanda !== "???" && comanda.numeroComanda !== "") {
        const num = parseInt(comanda.numeroComanda);
        if (!isNaN(num) && num > 0) return num;
        return comanda.numeroComanda;
    }
    // Prioridade 3: usar parte do ID como fallback
    if (comanda.id && comanda.id.length >= 5) {
        const idNum = parseInt(comanda.id.slice(-5), 16);
        if (!isNaN(idNum) && idNum > 0) return idNum;
        return comanda.id.slice(-5);
    }
    // Último recurso
    return "???";
}

function getClienteInfo(comanda) {
    if (comanda.clienteId) {
        const cliente = clientes.find(c => c.id === comanda.clienteId);
        if (cliente) {
            return {
                nome: cliente.nome || "Cliente",
                telefone: cliente.telefone || cliente.whatsapp || cliente.celular || "Não informado"
            };
        }
    }
    if (comanda.clienteNome) {
        return {
            nome: comanda.clienteNome,
            telefone: comanda.clienteTelefone || "Não informado"
        };
    }
    return { nome: "Cliente não encontrado", telefone: "Não informado" };
}

function getBarbeiroInfo(comanda) {
    if (comanda.barbeiroId) {
        const barbeiro = profissionais.find(p => p.id === comanda.barbeiroId);
        if (barbeiro) return barbeiro.nome || comanda.barbeiroNome || "Barbeiro";
    }
    return comanda.barbeiroNome || "Barbeiro não definido";
}

// ==================== FUNÇÕES DE PRÉ-LANÇAMENTO ====================

async function carregarPreLancamentosCliente(clienteId) {
    if (!clienteId) return [];
    
    try {
        console.log(`🔍 Buscando pré-lançamentos pendentes para o cliente: ${clienteId}`);
        
        const lembretesQuery = query(
            collection(db, "lembretes_comanda"), 
            where("clienteId", "==", clienteId),
            where("status", "==", "pendente")
        );
        const lembretesSnapshot = await getDocs(lembretesQuery);
        
        const preLancamentos = [];
        for (const doc of lembretesSnapshot.docs) {
            const data = doc.data();
            preLancamentos.push({ 
                id: doc.id, 
                produtoId: data.produtoId,
                produtoNome: data.produtoNome,
                preco: data.preco || 0,
                quantidade: data.quantidade || 1,
                observacao: data.observacao || "",
                dataCriacao: data.dataCriacao,
                comandaOrigemId: data.comandaOrigemId
            });
            console.log(`📦 Pré-lançamento encontrado: ${data.produtoNome} (x${data.quantidade || 1})`);
        }
        
        console.log(`📦 Total de ${preLancamentos.length} pré-lançamentos pendentes`);
        return preLancamentos;
    } catch (error) {
        console.error("Erro ao carregar pré-lançamentos:", error);
        return [];
    }
}

async function renderizarPreLancamentosNaSecao() {
    const preLancamentoLista = document.getElementById("preLancamentoLista");
    if (!preLancamentoLista) return;
    
    const editarCliente = document.getElementById("editarCliente");
    const clienteId = editarCliente ? editarCliente.value : null;
    
    if (!clienteId) {
        preLancamentoLista.innerHTML = `<div class="empty-pre-lancamento">
            <i class="fa-solid fa-info-circle"></i>
            <p>Selecione um cliente para ver os pré-lançamentos</p>
            <small>Produtos adicionados como pré-lançamento aparecerão aqui</small>
        </div>`;
        return;
    }
    
    try {
        console.log(`🔍 Renderizando pré-lançamentos para o cliente: ${clienteId}`);
        
        const lembretesQuery = query(
            collection(db, "lembretes_comanda"), 
            where("clienteId", "==", clienteId),
            where("status", "==", "pendente")
        );
        const lembretesSnapshot = await getDocs(lembretesQuery);
        
        if (lembretesSnapshot.empty) {
            preLancamentoLista.innerHTML = `<div class="empty-pre-lancamento">
                <i class="fa-solid fa-info-circle"></i>
                <p>Nenhum produto em pré-lançamento para este cliente</p>
                <small>Produtos adicionados como pré-lançamento aparecerão aqui</small>
            </div>`;
            return;
        }
        
        preLancamentoLista.innerHTML = '';
        for (const doc of lembretesSnapshot.docs) {
            const item = doc.data();
            const itemId = doc.id;
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'pre-lancamento-item';
            itemDiv.setAttribute('data-id', itemId);
            itemDiv.innerHTML = `
                <div class="pre-lancamento-item-info">
                    <h5><i class="fa-solid fa-box"></i> ${escapeHtml(item.produtoNome)} <span class="lembrete-badge">Pré-lançamento Pendente</span></h5>
                    ${item.observacao ? `<p><i class="fa-solid fa-comment"></i> ${escapeHtml(item.observacao)}</p>` : ''}
                    <small>📦 Quantidade: ${item.quantidade || 1}x | 💰 Preço unitário: ${formatarMoeda(item.preco)}</small>
                    <small style="display: block; margin-top: 4px;">⏳ Aguardando entrega na próxima visita</small>
                </div>
                <div class="pre-lancamento-item-valor">${formatarMoeda((item.preco || 0) * (item.quantidade || 1))}</div>
                <div class="pre-lancamento-item-actions">
                    <button class="btn-remover-pre-lancamento" data-id="${itemId}" data-nome="${escapeHtml(item.produtoNome)}"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            preLancamentoLista.appendChild(itemDiv);
        }
        
        document.querySelectorAll('#preLancamentoLista .btn-remover-pre-lancamento').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const lembreteId = btn.getAttribute('data-id');
                const produtoNome = btn.getAttribute('data-nome');
                
                if (confirm(`Remover "${produtoNome}" da lista de pré-lançamentos?`)) {
                    try {
                        await deleteDoc(doc(db, "lembretes_comanda", lembreteId));
                        
                        if (window.comandaEditando && window.comandaEditando.produtos) {
                            const index = window.comandaEditando.produtos.findIndex(p => p.lembreteId === lembreteId);
                            if (index !== -1) {
                                window.comandaEditando.produtos.splice(index, 1);
                            }
                        }
                        
                        mostrarToast(`✅ "${produtoNome}" removido dos pré-lançamentos!`);
                        await renderizarPreLancamentosNaSecao();
                        if (typeof renderizarListaItensEdicao === 'function') renderizarListaItensEdicao();
                        if (typeof recalcularTotalComDesconto === 'function') recalcularTotalComDesconto();
                    } catch (error) {
                        console.error("Erro ao remover pré-lançamento:", error);
                        mostrarToast("Erro ao remover pré-lançamento", "erro");
                    }
                }
            });
        });
        
    } catch (error) {
        console.error("Erro ao renderizar pré-lançamentos:", error);
        preLancamentoLista.innerHTML = `<div class="empty-pre-lancamento" style="color:#ef4444;">
            <i class="fa-solid fa-exclamation-triangle"></i>
            <p>Erro ao carregar pré-lançamentos: ${error.message}</p>
        </div>`;
    }
}

async function adicionarPreLancamentosAComanda() {
    const editarCliente = document.getElementById("editarCliente");
    const clienteId = editarCliente ? editarCliente.value : null;
    
    if (!clienteId || !window.comandaEditando) {
        console.log("⚠️ Não é possível adicionar pré-lançamentos");
        return [];
    }
    
    try {
        console.log(`🔍 Buscando pré-lançamentos para adicionar à comanda - Cliente: ${clienteId}`);
        
        const lembretesQuery = query(
            collection(db, "lembretes_comanda"), 
            where("clienteId", "==", clienteId),
            where("status", "==", "pendente")
        );
        const lembretesSnapshot = await getDocs(lembretesQuery);
        
        console.log(`📦 Encontrados ${lembretesSnapshot.size} pré-lançamentos pendentes`);
        
        const produtosAdicionados = [];
        
        for (const lembreteDoc of lembretesSnapshot.docs) {
            const data = lembreteDoc.data();
            const jaExiste = window.comandaEditando.produtos.some(p => 
                p.produtoId === data.produtoId && p.isPreLancamento === true
            );
            
            if (!jaExiste) {
                window.comandaEditando.produtos.push({
                    produtoId: data.produtoId,
                    nome: data.produtoNome,
                    preco: data.preco || 0,
                    quantidade: data.quantidade || 1,
                    isPreLancamento: true,
                    afetaEstoque: false,
                    observacaoPreLancamento: data.observacao || "",
                    lembreteId: lembreteDoc.id,
                    comandaOrigemId: data.comandaOrigemId
                });
                produtosAdicionados.push(data.produtoNome);
                console.log(`✅ Adicionado pré-lançamento à comanda: ${data.produtoNome}`);
            }
        }
        
        if (produtosAdicionados.length > 0) {
            mostrarToast(`📦 ${produtosAdicionados.length} produto(s) em pré-lançamento foram adicionados!`, "sucesso");
            if (typeof renderizarListaItensEdicao === 'function') renderizarListaItensEdicao();
            if (typeof recalcularTotalComDesconto === 'function') recalcularTotalComDesconto();
        }
        
        return produtosAdicionados;
    } catch (error) {
        console.error("Erro ao adicionar pré-lançamentos:", error);
        return [];
    }
}

async function carregarESincronizarPreLancamentosCliente(clienteId) {
    if (!clienteId) return [];
    
    try {
        console.log(`🔍 ========== BUSCANDO PRÉ-LANÇAMENTOS PENDENTES ==========`);
        console.log(`👤 Cliente ID: ${clienteId}`);
        
        const lembretesQuery = query(
            collection(db, "lembretes_comanda"), 
            where("clienteId", "==", clienteId),
            where("status", "==", "pendente")
        );
        const lembretesSnapshot = await getDocs(lembretesQuery);
        
        console.log(`📦 Encontrados ${lembretesSnapshot.size} pré-lançamentos pendentes`);
        
        const preLancamentos = [];
        for (const lembreteDoc of lembretesSnapshot.docs) {
            const data = lembreteDoc.data();
            preLancamentos.push({ 
                id: lembreteDoc.id, 
                produtoId: data.produtoId,
                produtoNome: data.produtoNome,
                preco: data.preco || 0,
                quantidade: data.quantidade || 1,
                observacao: data.observacao || "",
                dataCriacao: data.dataCriacao,
                comandaOrigemId: data.comandaOrigemId
            });
            console.log(`📦 PRÉ-LANÇAMENTO ENCONTRADO: ${data.produtoNome}`);
        }
        
        if (window.comandaEditando && preLancamentos.length > 0) {
            console.log(`🔄 Sincronizando ${preLancamentos.length} pré-lançamentos com a comanda atual...`);
            
            const idsExistentes = (window.comandaEditando.produtos || [])
                .filter(p => p.isPreLancamento === true)
                .map(p => p.produtoId);
            
            for (const pre of preLancamentos) {
                if (!idsExistentes.includes(pre.produtoId)) {
                    window.comandaEditando.produtos.push({
                        produtoId: pre.produtoId,
                        nome: pre.produtoNome,
                        preco: pre.preco,
                        quantidade: pre.quantidade || 1,
                        isPreLancamento: true,
                        afetaEstoque: false,
                        observacaoPreLancamento: pre.observacao || "",
                        lembreteId: pre.id,
                        comandaOrigemId: pre.comandaOrigemId
                    });
                    console.log(`✅ ADICIONADO: ${pre.produtoNome}`);
                }
            }
            
            if (typeof renderizarListaItensEdicao === 'function') renderizarListaItensEdicao();
            if (typeof recalcularTotalComDesconto === 'function') recalcularTotalComDesconto();
            if (typeof renderizarPreLancamentosNaSecao === 'function') await renderizarPreLancamentosNaSecao();
        }
        
        console.log(`🔍 ========== FIM DA BUSCA ==========`);
        return preLancamentos;
    } catch (error) {
        console.error("Erro ao carregar pré-lançamentos:", error);
        return [];
    }
}

// ==================== FUNÇÃO PARA DISPARAR ATUALIZAÇÃO ====================

function dispararAtualizacaoPagamento(comandaId) {
    console.log("📢 Disparando atualização de pagamento para comanda:", comandaId);
    const event = new CustomEvent('pagamentoAtualizado', { 
        detail: { comandaId: comandaId, action: 'comanda_atualizada', timestamp: Date.now(), source: 'comanda.js' }
    });
    window.dispatchEvent(event);
    try {
        localStorage.setItem('pagamentoAtualizado', JSON.stringify({ comandaId: comandaId, timestamp: Date.now(), action: 'comanda_atualizada' }));
        setTimeout(() => localStorage.removeItem('pagamentoAtualizado'), 500);
    } catch(e) { console.warn("Erro ao salvar no localStorage:", e); }
}

// ==================== FUNÇÕES DE FIDELIDADE ====================

async function getConfigFidelidade() {
    try {
        const configDoc = await getDoc(doc(db, "configuracoes", "fidelidade"));
        if (configDoc.exists()) return configDoc.data();
        return {
            pontosPorRealServico: 1,
            pontosPorRealProduto: 0.5,
            pontosAniversario: 100,
            pontosIndicacao: 50,
            pontosAvaliacao: 20,
            niveis: { bronze: 0, prata: 500, ouro: 1500, diamante: 5000 }
        };
    } catch (error) {
        console.error("Erro ao buscar configurações de fidelidade:", error);
        return { pontosPorRealServico: 1, pontosPorRealProduto: 0.5, niveis: { bronze: 0, prata: 500, ouro: 1500, diamante: 5000 } };
    }
}

async function adicionarPontosFidelidade(clienteId, clienteNome, valorTotal, tipo = "servico") {
    try {
        if (!clienteId) return false;
        const config = await getConfigFidelidade();
        let pontos = 0;
        if (tipo === "servico") {
            pontos = Math.floor(valorTotal * (config.pontosPorRealServico || 1));
        } else {
            pontos = Math.floor(valorTotal * (config.pontosPorRealProduto || 0.5));
        }
        if (pontos === 0) return false;
        
        const fidelidadeQuery = query(collection(db, "clientes_fidelidade"), where("clienteId", "==", clienteId));
        const fidelidadeSnap = await getDocs(fidelidadeQuery);
        if (!fidelidadeSnap.empty) {
            const fidelidadeDoc = fidelidadeSnap.docs[0];
            const pontosAtuais = fidelidadeDoc.data().pontos || 0;
            const pontosGanhos = fidelidadeDoc.data().pontosGanhos || 0;
            await updateDoc(doc(db, "clientes_fidelidade", fidelidadeDoc.id), {
                pontos: pontosAtuais + pontos,
                pontosGanhos: pontosGanhos + pontos,
                ultimaCompra: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
        } else {
            await addDoc(collection(db, "clientes_fidelidade"), {
                clienteId: clienteId,
                nome: clienteNome,
                pontos: pontos,
                pontosGanhos: pontos,
                totalResgatados: 0,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
        }
        await addDoc(collection(db, "historico_pontos"), {
            clienteId: clienteId,
            clienteNome: clienteNome,
            quantidade: pontos,
            motivo: `Compra finalizada - ${tipo === "servico" ? "Serviço" : "Produto"} no valor de ${formatarMoeda(valorTotal)}`,
            data: Timestamp.now()
        });
        mostrarToast(`🎉 +${pontos} pontos no programa de fidelidade!`, "sucesso");
        return true;
    } catch (error) {
        console.error("Erro ao adicionar pontos de fidelidade:", error);
        return false;
    }
}

// ==================== FUNÇÃO PARA CALCULAR TOTAL DA COMANDA ====================

function calcularTotaisComanda(comandaData) {
    let subtotal = 0;
    (comandaData.servicos || []).forEach(s => { subtotal += (s.preco || 0) * (s.quantidade || 1); });
    (comandaData.pacotes || []).forEach(p => { subtotal += (p.preco || 0); });
    (comandaData.produtos || []).forEach(p => {
        if (!p.isPreLancamento) {
            subtotal += (p.preco || 0) * (p.quantidade || 1);
        }
    });
    let descontoValor = 0;
    if (comandaData.desconto?.valor > 0) {
        if (comandaData.desconto.tipo === "percentual") {
            descontoValor = (subtotal * comandaData.desconto.valor) / 100;
        } else {
            descontoValor = comandaData.desconto.valor;
        }
    }
    return { subtotal, descontoValor, totalFinal: Math.max(0, subtotal - descontoValor) };
}

// ==================== FUNÇÃO PARA SINCRONIZAR PAGAMENTO ====================

async function sincronizarPagamentoComFinanceiro(comandaId, comandaData) {
    try {
        console.log("💰 Sincronizando pagamento com o módulo financeiro...");
        const { subtotal, descontoValor, totalFinal } = calcularTotaisComanda(comandaData);
        let clienteNome = comandaData.clienteNome;
        let profissionalNome = comandaData.barbeiroNome;
        try {
            if (comandaData.clienteId) {
                const clienteDoc = await getDoc(doc(db, "clientes", comandaData.clienteId));
                if (clienteDoc.exists()) clienteNome = clienteDoc.data().nome;
            }
            if (comandaData.barbeiroId) {
                const profDoc = await getDoc(doc(db, "profissionais", comandaData.barbeiroId));
                if (profDoc.exists()) profissionalNome = profDoc.data().nome;
            }
        } catch (e) { console.warn("Erro ao buscar nomes:", e); }
        const primeiroServico = comandaData.servicos?.[0];
        const servicoId = primeiroServico?.servicoId || null;
        const formaPagamento = comandaData.formaPagamento || "dinheiro";
        const parcelas = comandaData.parcelas || 1;
        const pagamentoData = {
            comandaId: comandaId, clienteId: comandaData.clienteId, clienteNome: clienteNome || "Cliente",
            servicoId: servicoId, servicoNome: primeiroServico?.nome || (comandaData.servicos?.length > 0 ? `${comandaData.servicos.length} serviços` : "Múltiplos itens"),
            profissionalId: comandaData.barbeiroId, profissionalNome: profissionalNome || "Não informado",
            valor: totalFinal, subtotal: subtotal, desconto: descontoValor, descontoAplicado: comandaData.desconto?.valor || 0,
            metodo: formaPagamento, parcelas: parcelas, data: new Date().toISOString().split('T')[0],
            status: "pago", observacao: `Comanda #${comandaData.numeroComanda || comandaId.slice(-6)} - Finalizada${comandaData.observacoes ? ` | ${comandaData.observacoes}` : ''}`,
            servicos: comandaData.servicos || [], produtos: (comandaData.produtos || []).filter(p => !p.isPreLancamento),
            produtosPreLancamento: (comandaData.produtos || []).filter(p => p.isPreLancamento), pacotes: comandaData.pacotes || [],
            atualizadoEm: Timestamp.now(), origem: "comanda", numeroComanda: comandaData.numeroComanda, dataFinalizacao: Timestamp.now()
        };
        const pagamentosQuery = query(collection(db, "pagamentos"), where("comandaId", "==", comandaId));
        const pagamentosSnapshot = await getDocs(pagamentosQuery);
        if (!pagamentosSnapshot.empty) {
            const pagamentoExistente = pagamentosSnapshot.docs[0];
            await updateDoc(doc(db, "pagamentos", pagamentoExistente.id), { ...pagamentoData, updatedAt: Timestamp.now() });
            console.log(`✅ Pagamento atualizado na coleção "pagamentos": ${pagamentoExistente.id}`);
        } else {
            pagamentoData.createdAt = Timestamp.now();
            const newPagamentoRef = await addDoc(collection(db, "pagamentos"), pagamentoData);
            console.log(`✅ Novo pagamento criado na coleção "pagamentos": ${newPagamentoRef.id}`);
        }
        console.log(`✅ Pagamento sincronizado! Valor: ${formatarMoeda(totalFinal)} | Parcelas: ${parcelas}x`);
        dispararAtualizacaoPagamento(comandaId);
        return true;
    } catch (error) {
        console.error("❌ Erro ao sincronizar pagamento:", error);
        return false;
    }
}

// ==================== FUNÇÕES DE FILTRO E PERÍODO ====================

function getDateRange() {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
    switch(currentPeriodo) {
        case "hoje": return { inicio: hoje, fim: amanha };
        case "ontem": const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1); const ontemFim = new Date(ontem); ontemFim.setDate(ontemFim.getDate() + 1); return { inicio: ontem, fim: ontemFim };
        case "semana": const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay()); const fimSemana = new Date(inicioSemana); fimSemana.setDate(fimSemana.getDate() + 7); return { inicio: inicioSemana, fim: fimSemana };
        case "mes": return { inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1), fim: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1) };
        case "personalizado": if (dataInicioPersonalizada && dataFimPersonalizada) { const inicio = new Date(dataInicioPersonalizada); inicio.setHours(0,0,0,0); const fim = new Date(dataFimPersonalizada); fim.setHours(23,59,59,999); return { inicio, fim }; }
        default: return { inicio: hoje, fim: amanha };
    }
}

function filtrarPorPeriodo(c) {
    const data = c.dataCriacao?.toDate ? c.dataCriacao.toDate() : new Date(c.dataCriacao);
    const { inicio, fim } = getDateRange();
    return data >= inicio && data <= fim;
}

// ==================== CARREGAMENTO DE DADOS ====================

async function carregarDados() {
    try {
        console.log("🔄 Carregando dados do Firebase...");
        mostrarToast("Carregando dados...");
        const [servicosSnap, produtosSnap, clientesSnap, profissionaisSnap, pacotesSnap] = await Promise.all([
            getDocs(collection(db, "servicos")), getDocs(collection(db, "produtos")),
            getDocs(collection(db, "clientes")), getDocs(collection(db, "profissionais")),
            getDocs(collection(db, "pacotes"))
        ]);
        servicos = servicosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        produtos = produtosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        produtosDisponiveis = [...produtos];
        clientes = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        profissionais = profissionaisSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        pacotes = pacotesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log("✅ Dados carregados:", { servicos: servicos.length, produtos: produtos.length, clientes: clientes.length, profissionais: profissionais.length, pacotes: pacotes.length });
        popularSelects();
        popularSelectsEdicao();
        iniciarListenerComandas();
        
        // Executar correção automática de números ao carregar
        setTimeout(() => {
            corrigirNumerosComandasAutomatico();
        }, 2000);
        
        mostrarToast("Dados carregados!");
        verificarComandaEspecifica();
    } catch (error) { 
        console.error("Erro ao carregar dados:", error); 
        mostrarToast("Erro ao carregar dados: " + error.message, "erro"); 
        if (comandasGrid) {
            comandasGrid.innerHTML = `<div class="empty-comandas" style="color:#ef4444;">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <p>Erro ao carregar dados: ${error.message}</p>
                <button class="btn-primary" onclick="location.reload()">Tentar Novamente</button>
            </div>`;
        }
    }
}

// FUNÇÃO PARA CORRIGIR NÚMEROS DAS COMANDAS AUTOMATICAMENTE
async function corrigirNumerosComandasAutomatico() {
    try {
        console.log("🔧 Verificando e corrigindo números das comandas automaticamente...");
        const comandasSnapshot = await getDocs(collection(db, "comandas"));
        let countCorrigidas = 0;
        
        // Coletar todos os números válidos existentes
        const numerosExistentes = [];
        const docsParaCorrigir = [];
        
        comandasSnapshot.forEach(doc => {
            const data = doc.data();
            const numeroAtual = data.numeroComanda;
            
            // Verificar se o número é inválido
            let isInvalido = false;
            if (!numeroAtual) isInvalido = true;
            else if (numeroAtual === "?" || numeroAtual === "???" || numeroAtual === "") isInvalido = true;
            else if (typeof numeroAtual === 'string' && isNaN(parseInt(numeroAtual))) isInvalido = true;
            else if (typeof numeroAtual === 'number' && (numeroAtual <= 0 || isNaN(numeroAtual))) isInvalido = true;
            
            if (isInvalido) {
                docsParaCorrigir.push({ id: doc.id, doc: doc });
                console.log(`📌 Comanda ${doc.id} tem número inválido: "${numeroAtual}"`);
            } else {
                // Adicionar números válidos à lista
                let num = numeroAtual;
                if (typeof num === 'string') num = parseInt(num);
                if (typeof num === 'number' && !isNaN(num) && num > 0) {
                    numerosExistentes.push(num);
                }
            }
        });
        
        if (docsParaCorrigir.length === 0) {
            console.log("✅ Todas as comandas já têm números válidos!");
            return;
        }
        
        // Ordenar números existentes
        numerosExistentes.sort((a, b) => a - b);
        
        // Encontrar o próximo número disponível
        let proximoNumero = 1;
        for (const num of numerosExistentes) {
            if (num === proximoNumero) {
                proximoNumero++;
            } else if (num > proximoNumero) {
                break;
            }
        }
        
        console.log(`🔢 Próximo número disponível: ${proximoNumero}`);
        
        // Corrigir cada comanda
        for (const item of docsParaCorrigir) {
            console.log(`✅ Corrigindo comanda ${item.id} com número #${proximoNumero}`);
            await updateDoc(doc(db, "comandas", item.id), {
                numeroComanda: proximoNumero,
                updatedAt: Timestamp.now()
            });
            proximoNumero++;
            countCorrigidas++;
        }
        
        console.log(`✅ Correção automática concluída! ${countCorrigidas} comandas corrigidas.`);
        if (countCorrigidas > 0) {
            mostrarToast(`${countCorrigidas} comandas receberam numeração!`, "sucesso");
            setTimeout(() => {
                if (typeof aplicarFiltros === 'function') aplicarFiltros();
            }, 1000);
        }
        
    } catch (error) {
        console.error("Erro na correção automática:", error);
    }
}

function popularSelects() {
    const populate = (select, data, valueKey, textKey) => {
        if (!select) return;
        select.innerHTML = '<option value="">Selecione...</option>';
        data.forEach(item => select.innerHTML += `<option value="${item[valueKey]}">${escapeHtml(item[textKey])}</option>`);
    };
    populate(comandaCliente, clientes, "id", "nome");
    populate(comandaBarbeiro, profissionais, "id", "nome");
    if (filterBarbeiro) {
        filterBarbeiro.innerHTML = '<option value="">Todos os barbeiros</option>';
        profissionais.forEach(p => filterBarbeiro.innerHTML += `<option value="${p.id}">${escapeHtml(p.nome)}</option>`);
    }
}

function popularSelectsEdicao() {
    console.log("🔄 Populando selects de edição...");
    const novoServicoSelect = document.getElementById("novoServicoSelect");
    if (novoServicoSelect) {
        novoServicoSelect.innerHTML = '<option value="">Selecione um serviço</option>';
        servicos.forEach(servico => {
            novoServicoSelect.innerHTML += `<option value="${servico.id}" data-preco="${servico.preco}" data-nome="${escapeHtml(servico.nome)}" data-tipo="servico">${escapeHtml(servico.nome)} - ${formatarMoeda(servico.preco)}</option>`;
        });
    }
    const novoProdutoSelect = document.getElementById("novoProdutoSelect");
    if (novoProdutoSelect) {
        novoProdutoSelect.innerHTML = '<option value="">Selecione um produto</option>';
        produtos.forEach(produto => {
            novoProdutoSelect.innerHTML += `<option value="${produto.id}" data-preco="${produto.preco}" data-nome="${escapeHtml(produto.nome)}" data-tipo="produto">${escapeHtml(produto.nome)} - ${formatarMoeda(produto.preco)}</option>`;
        });
    }
    const editarCliente = document.getElementById("editarCliente");
    const editarBarbeiro = document.getElementById("editarBarbeiro");
    if (editarCliente) {
        editarCliente.innerHTML = '<option value="">Selecione um cliente</option>';
        clientes.forEach(cliente => {
            editarCliente.innerHTML += `<option value="${cliente.id}">${escapeHtml(cliente.nome)}</option>`;
        });
        editarCliente.disabled = false;
        editarCliente.addEventListener('change', async () => {
            console.log("🔄 Cliente alterado, recarregando pré-lançamentos...");
            await renderizarPreLancamentosNaSecao();
            if (window.comandaEditando) {
                window.comandaEditando.clienteId = editarCliente.value;
                await adicionarPreLancamentosAComanda();
                if (typeof renderizarListaItensEdicao === 'function') renderizarListaItensEdicao();
                if (typeof recalcularTotalComDesconto === 'function') recalcularTotalComDesconto();
            }
        });
    }
    if (editarBarbeiro) {
        editarBarbeiro.innerHTML = '<option value="">Selecione um barbeiro</option>';
        profissionais.forEach(prof => {
            editarBarbeiro.innerHTML += `<option value="${prof.id}">${escapeHtml(prof.nome)}</option>`;
        });
        editarBarbeiro.disabled = false;
    }
}

// ==================== FUNÇÕES PARA FILTRAR COMANDA ESPECÍFICA ====================

function verificarComandaEspecifica() {
    const urlParams = new URLSearchParams(window.location.search);
    const comandaId = urlParams.get('id');
    if (!comandaId) return;
    console.log("🔍 Comanda específica detectada na URL:", comandaId);
    mostrarToast("Carregando comanda específica...", "sucesso");
    let tentativas = 0;
    const maxTentativas = 50;
    const aguardarDados = setInterval(() => {
        tentativas++;
        if (comandas && comandas.length > 0 && clientes && clientes.length > 0) {
            clearInterval(aguardarDados);
            filtrarPorIdComanda(comandaId);
        } else if (tentativas >= maxTentativas) {
            clearInterval(aguardarDados);
            mostrarToast("Erro ao carregar comanda específica", "erro");
        }
    }, 500);
}

window.filtrarPorIdComanda = async function(comandaId) {
    if (!comandas || comandas.length === 0) {
        setTimeout(() => window.filtrarPorIdComanda(comandaId), 500);
        return;
    }
    filtrandoComandaEspecifica = true;
    comandaEspecificaId = comandaId;
    const comandaEspecifica = comandas.find(c => c.id === comandaId);
    if (!comandaEspecifica) {
        mostrarToast("Comanda não encontrada", "erro");
        if (comandasGrid) {
            comandasGrid.innerHTML = `<div class="empty-comandas" style="color:#ef4444;">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <p>Comanda não encontrada: ${comandaId}</p>
                <button class="btn-primary" onclick="window.location.href='comanda.html'">Voltar para Comandas</button>
            </div>`;
        }
        return;
    }
    const statsContainer = document.querySelector(".stats-comanda");
    const filterContainer = document.querySelector(".filter-comanda");
    const topbarActions = document.querySelector(".topbar-actions");
    if (statsContainer) statsContainer.style.display = "none";
    if (filterContainer) filterContainer.style.display = "none";
    if (topbarActions) topbarActions.style.display = "none";
    renderizarComandaEspecifica(comandaEspecifica);
    adicionarBotaoVoltarFiltro();
    const numeroExibido = getNumeroExibido(comandaEspecifica);
    mostrarToast(`Comanda #${numeroExibido} carregada`, "sucesso");
};

function renderizarComandaEspecifica(comanda) {
    if (!comandasGrid) return;
    let itensHtml = '';
    const { subtotal, descontoValor, totalFinal } = calcularTotaisComanda(comanda);
    const numeroExibido = getNumeroExibido(comanda);
    const clienteInfo = getClienteInfo(comanda);
    const barbeiroNome = getBarbeiroInfo(comanda);
    const isAusente = comanda.status === "ausente";
    const isCancelado = comanda.status === "cancelado";
    const statusText = isAusente ? "Ausente" : (isCancelado ? "Cancelado" : (comanda.status === "aberta" ? "Em andamento" : "Finalizada"));
    const statusColor = isAusente ? "#ef4444" : (isCancelado ? "#ef4444" : (comanda.status === "aberta" ? "#f59e0b" : "#10b981"));
    const statusBg = isAusente ? "rgba(239, 68, 68, 0.2)" : (isCancelado ? "rgba(239, 68, 68, 0.2)" : (comanda.status === "aberta" ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)"));
    const metodoNome = getMetodoNome(comanda.formaPagamento);
    const metodoIcon = getMetodoIcon(comanda.formaPagamento);
    const parcelasTexto = comanda.parcelas && comanda.parcelas > 1 ? ` (${comanda.parcelas}x)` : '';
    
    (comanda.servicos || []).forEach(s => {
        const serv = servicos.find(sv => sv.id === s.servicoId) || s;
        const qtd = s.quantidade || 1;
        const valor = (serv.preco || 0) * qtd;
        itensHtml += `<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <span>✂️ ${escapeHtml(serv.nome)} ${qtd > 1 ? `x${qtd}` : ''}</span>
            <span style="color: #2199EF;">${formatarMoeda(valor)}</span>
        </div>`;
    });
    (comanda.pacotes || []).forEach(p => {
        const pac = pacotes.find(pc => pc.id === p.pacoteId) || p;
        const precoFinal = p.preco || 0;
        itensHtml += `<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <span>🎁 ${escapeHtml(pac.nome)} (Pacote)</span>
            <span style="color: #2199EF;">${formatarMoeda(precoFinal)}</span>
        </div>`;
    });
    (comanda.produtos || []).forEach(p => {
        const prod = produtos.find(pr => pr.id === p.produtoId) || p;
        const qtd = p.quantidade || 1;
        const valor = (prod.preco || 0) * qtd;
        const preLancamentoBadge = p.isPreLancamento ? '<span style="background: rgba(33, 153, 239, 0.2); padding: 2px 6px; border-radius: 10px; font-size: 0.6rem; margin-left: 6px;">📦 Pré-lançamento</span>' : '';
        itensHtml += `<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <span>📦 ${escapeHtml(prod.nome)} ${qtd > 1 ? `x${qtd}` : ''} ${preLancamentoBadge}</span>
            <span style="color: #2199EF;">${formatarMoeda(valor)}</span>
        </div>`;
    });
    
    const totalHtml = descontoValor > 0 ? `<span style="text-decoration: line-through; font-size: 0.75rem; color: #94a3b8;">${formatarMoeda(subtotal)}</span> <strong style="color: #10b981;">${formatarMoeda(totalFinal)}</strong>` : `<strong>${formatarMoeda(totalFinal)}</strong>`;
    const data = comanda.dataCriacao?.toDate ? comanda.dataCriacao.toDate() : new Date();
    const dataFormatada = data.toLocaleDateString('pt-BR');
    const horario = data.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
    const ausenciaBadge = isAusente && comanda.justificativaAusencia ? `<span class="ausencia-badge" title="${escapeHtml(comanda.justificativaAusencia)}"><i class="fa-solid fa-comment"></i> ${escapeHtml(comanda.justificativaAusencia.substring(0, 30))}${comanda.justificativaAusencia.length > 30 ? '...' : ''}</span>` : '';
    const canceladoBadge = isCancelado && comanda.justificativaCancelamento ? `<span class="cancelado-badge" title="${escapeHtml(comanda.justificativaCancelamento)}"><i class="fa-solid fa-comment"></i> ${escapeHtml(comanda.justificativaCancelamento.substring(0, 30))}${comanda.justificativaCancelamento.length > 30 ? '...' : ''}</span>` : '';
    
    comandasGrid.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; justify-content: center; align-items: center; min-height: 400px;">
            <div class="comanda-card ${isAusente ? 'status-ausente' : (isCancelado ? 'status-cancelado' : '')}" data-id="${comanda.id}" style="max-width: 550px; width: 100%; margin: 0 auto; background: var(--bg-card); border-radius: 20px; border: 1px solid var(--border-color); overflow: hidden;">
                <div style="padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
                        <div style="background: #2199EF; color: white; padding: 6px 16px; border-radius: 25px; font-weight: bold; font-size: 0.9rem;"><i class="fa-solid fa-hashtag"></i> ${numeroExibido}</div>
                        <div style="padding: 6px 16px; border-radius: 25px; font-size: 0.8rem; font-weight: 600; background: ${statusBg}; color: ${statusColor};">${statusText} ${ausenciaBadge} ${canceladoBadge}</div>
                    </div>
                    <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--border-color);">
                        <h3 style="margin: 0 0 5px 0; font-size: 1.1rem;">${escapeHtml(clienteInfo.nome)}</h3>
                        <div style="font-size: 0.75rem; color: #94a3b8;"><i class="fa-solid fa-phone"></i> ${escapeHtml(clienteInfo.telefone)}</div>
                        <div style="font-size: 0.7rem; color: #64748b; margin-top: 8px;"><i class="fa-regular fa-calendar"></i> ${dataFormatada} às ${horario}</div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <div style="font-size: 0.7rem; color: #94a3b8; margin-bottom: 8px;"><i class="fa-solid fa-list"></i> ITENS</div>
                        ${itensHtml || '<div style="text-align: center; padding: 20px; color: #94a3b8;">Nenhum item</div>'}
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 15px 0; padding: 10px 0; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                        <span style="color: #94a3b8; font-size: 0.8rem;"><i class="fa-solid fa-user-md"></i> BARBEIRO</span>
                        <span style="font-weight: 500; font-size: 0.8rem;">${escapeHtml(barbeiroNome)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 15px 0; padding: 10px 0;">
                        <span style="color: #94a3b8; font-size: 0.8rem;"><i class="fa-solid fa-credit-card"></i> PAGAMENTO</span>
                        <span style="font-weight: 500; font-size: 0.8rem;">${metodoIcon} ${metodoNome}${parcelasTexto}</span>
                    </div>
                    <div style="margin-top: 15px; text-align: right;"><strong>Total:</strong> ${totalHtml}</div>
                    <div style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
                        <button class="btn-view" data-id="${comanda.id}" style="flex: 1; padding: 10px; background: rgba(33, 153, 239, 0.15); border: none; border-radius: 10px; color: #2199EF; cursor: pointer; font-size: 0.8rem;"><i class="fa-solid fa-eye"></i> Ver detalhes</button>
                        ${!isAusente && !isCancelado && comanda.status === "aberta" ? `
                            <button class="btn-editar" data-id="${comanda.id}" style="flex: 1; padding: 10px; background: rgba(33, 153, 239, 0.15); border: none; border-radius: 10px; color: #2199EF; cursor: pointer; font-size: 0.8rem;"><i class="fa-solid fa-pen"></i> Editar</button>
                            <button class="btn-cancelar" data-id="${comanda.id}" style="flex: 1; padding: 10px; background: rgba(239, 68, 68, 0.15); border: none; border-radius: 10px; color: #ef4444; cursor: pointer; font-size: 0.8rem;"><i class="fa-solid fa-ban"></i> Cancelar</button>
                            <button class="btn-marcar-ausente" data-id="${comanda.id}" style="flex: 1; padding: 10px; background: rgba(239, 68, 68, 0.15); border: none; border-radius: 10px; color: #ef4444; cursor: pointer; font-size: 0.8rem;"><i class="fa-solid fa-user-slash"></i> Ausente</button>
                            <button class="btn-finalizar" data-id="${comanda.id}" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #10b981, #059669); border: none; border-radius: 10px; color: white; cursor: pointer; font-size: 0.8rem;"><i class="fa-solid fa-check-circle"></i> Finalizar</button>
                        ` : ''}
                        ${isAusente ? `<button class="btn-reativar" data-id="${comanda.id}" style="flex: 1; padding: 10px; background: rgba(16, 185, 129, 0.15); border: none; border-radius: 10px; color: #10b981; cursor: pointer; font-size: 0.8rem;"><i class="fa-solid fa-rotate-left"></i> Reativar</button>` : ''}
                        ${isCancelado ? `<button class="btn-reativar-cancelado" data-id="${comanda.id}" style="flex: 1; padding: 10px; background: rgba(16, 185, 129, 0.15); border: none; border-radius: 10px; color: #10b981; cursor: pointer; font-size: 0.8rem;"><i class="fa-solid fa-rotate-left"></i> Reativar</button>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const card = document.querySelector('.comanda-card');
    if (card) {
        const btnView = card.querySelector('.btn-view');
        const btnEditar = card.querySelector('.btn-editar');
        const btnFinalizar = card.querySelector('.btn-finalizar');
        const btnMarcarAusente = card.querySelector('.btn-marcar-ausente');
        const btnCancelar = card.querySelector('.btn-cancelar');
        const btnReativar = card.querySelector('.btn-reativar');
        const btnReativarCancelado = card.querySelector('.btn-reativar-cancelado');
        if (btnView) btnView.addEventListener('click', (e) => { e.stopPropagation(); verDetalhesComanda(comanda.id); });
        if (btnEditar) btnEditar.addEventListener('click', (e) => { e.stopPropagation(); abrirModalEditarComanda(comanda.id); });
        if (btnFinalizar) btnFinalizar.addEventListener('click', async (e) => { e.stopPropagation(); if(confirm("Finalizar esta comanda?")) await finalizarComanda(comanda.id); });
        if (btnMarcarAusente) btnMarcarAusente.addEventListener('click', (e) => { e.stopPropagation(); abrirModalJustificarAusencia(comanda.id); });
        if (btnCancelar) btnCancelar.addEventListener('click', (e) => { e.stopPropagation(); abrirModalJustificarCancelamento(comanda.id); });
        if (btnReativar) btnReativar.addEventListener('click', (e) => { e.stopPropagation(); abrirModalReativarComanda(comanda.id); });
        if (btnReativarCancelado) btnReativarCancelado.addEventListener('click', (e) => { e.stopPropagation(); abrirModalReativarComandaCancelada(comanda.id); });
        card.addEventListener('click', (e) => { if(e.target.tagName !== 'BUTTON') verDetalhesComanda(comanda.id); });
    }
}

function adicionarBotaoVoltarFiltro() {
    let backButton = document.getElementById("backToComandasBtn");
    if (!backButton) {
        backButton = document.createElement("button");
        backButton.id = "backToComandasBtn";
        backButton.className = "btn-ghost";
        backButton.style.marginBottom = "16px";
        backButton.style.display = "inline-flex";
        backButton.style.alignItems = "center";
        backButton.style.gap = "8px";
        backButton.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Voltar para todas as comandas';
        backButton.onclick = () => limparFiltroComandaEspecifica();
        const containerFluid = document.querySelector(".container-fluid");
        if (containerFluid && containerFluid.firstChild) {
            containerFluid.insertBefore(backButton, containerFluid.firstChild);
        }
    }
    backButton.style.display = "inline-flex";
}

window.limparFiltroComandaEspecifica = function() {
    filtrandoComandaEspecifica = false;
    comandaEspecificaId = null;
    const statsContainer = document.querySelector(".stats-comanda");
    const filterContainer = document.querySelector(".filter-comanda");
    const topbarActions = document.querySelector(".topbar-actions");
    const backButton = document.getElementById("backToComandasBtn");
    if (statsContainer) statsContainer.style.display = "";
    if (filterContainer) filterContainer.style.display = "";
    if (topbarActions) topbarActions.style.display = "";
    if (backButton) backButton.style.display = "none";
    aplicarFiltros();
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.pushState({}, "", url);
    mostrarToast("Mostrando todas as comandas", "sucesso");
};

// ==================== LISTENER E FILTROS ====================

function iniciarListenerComandas() {
    if (unsubscribeComandas) unsubscribeComandas();
    unsubscribeComandas = onSnapshot(
        query(collection(db, "comandas"), orderBy("dataCriacao", "desc")), 
        (snapshot) => {
            comandas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            console.log(`📊 ${comandas.length} comandas carregadas`);
            console.log(`   - Abertas: ${comandas.filter(c => c.status === "aberta").length}`);
            console.log(`   - Finalizadas: ${comandas.filter(c => c.status === "finalizada").length}`);
            console.log(`   - Ausentes: ${comandas.filter(c => c.status === "ausente").length}`);
            console.log(`   - Canceladas: ${comandas.filter(c => c.status === "cancelado").length}`);
            aplicarFiltros();
            atualizarMetricas();
            dispararAtualizacaoPagamento('all');
        }, 
        (err) => console.error("Erro no listener:", err)
    );
}

function aplicarFiltros() {
    if (filtrandoComandaEspecifica && comandaEspecificaId) {
        const comandaEspecifica = comandas.find(c => c.id === comandaEspecificaId);
        if (comandaEspecifica) {
            renderizarComandaEspecifica(comandaEspecifica);
            return;
        }
    }
    if (!comandasGrid) return;
    let filtradas = [...comandas];
    if (currentFilter !== "todas") filtradas = filtradas.filter(c => c.status === currentFilter);
    filtradas = filtradas.filter(c => filtrarPorPeriodo(c));
    if (currentBarbeiroFilter) filtradas = filtradas.filter(c => c.barbeiroId === currentBarbeiroFilter);
    if (currentSearch) {
        const search = currentSearch.toLowerCase();
        filtradas = filtradas.filter(c => {
            const cliente = clientes.find(cl => cl.id === c.clienteId);
            const numeroStr = c.numeroComanda ? c.numeroComanda.toString() : "";
            return (cliente && cliente.nome.toLowerCase().includes(search)) || numeroStr.includes(search) || (c.id?.toLowerCase().includes(search));
        });
    }
    console.log(`📊 Filtro aplicado: ${currentFilter} | Total: ${filtradas.length} comandas`);
    renderizarComandas(filtradas);
}

// ==================== RENDERIZAÇÃO DE COMANDAS (CORRIGIDA) ====================

function renderizarComandas(lista) {
    if (!comandasGrid) return;
    if (lista.length === 0) {
        comandasGrid.innerHTML = `<div class="empty-comandas"><i class="fa-solid fa-receipt"></i><p>Nenhuma comanda encontrada</p><button class="btn-primary" id="emptyStateBtn"><i class="fa-solid fa-plus"></i> Nova Comanda</button></div>`;
        const emptyBtn = document.getElementById("emptyStateBtn");
        if (emptyBtn) emptyBtn.addEventListener("click", () => abrirNovaComanda());
        return;
    }
    const listaOrdenada = [...lista].sort((a, b) => {
        const numA = typeof a.numeroComanda === 'number' ? a.numeroComanda : 0;
        const numB = typeof b.numeroComanda === 'number' ? b.numeroComanda : 0;
        return numB - numA;
    });
    comandasGrid.innerHTML = listaOrdenada.map((c) => {
        const clienteInfo = getClienteInfo(c);
        const barbeiroNome = getBarbeiroInfo(c);
        const { subtotal, descontoValor, totalFinal } = calcularTotaisComanda(c);
        const numeroExibido = getNumeroExibido(c);
        const isAusente = c.status === "ausente";
        const isCancelado = c.status === "cancelado";
        const statusText = isAusente ? "Ausente" : (isCancelado ? "Cancelado" : (c.status === "aberta" ? "Em andamento" : "Finalizada"));
        const statusColor = isAusente ? "#ef4444" : (isCancelado ? "#ef4444" : (c.status === "aberta" ? "#f59e0b" : "#10b981"));
        const statusBg = isAusente ? "rgba(239, 68, 68, 0.2)" : (isCancelado ? "rgba(239, 68, 68, 0.2)" : (c.status === "aberta" ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)"));
        const metodoNome = getMetodoNome(c.formaPagamento);
        const metodoIcon = getMetodoIcon(c.formaPagamento);
        const parcelasTexto = c.parcelas && c.parcelas > 1 ? ` (${c.parcelas}x)` : '';
        let itensHtml = '';
        (c.servicos || []).forEach(s => {
            const serv = servicos.find(sv => sv.id === s.servicoId) || s;
            const qtd = s.quantidade || 1;
            const valor = (serv.preco || 0) * qtd;
            itensHtml += `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span style="font-size: 0.75rem;">✂️ ${escapeHtml(serv.nome)} ${qtd > 1 ? `x${qtd}` : ''}</span>
                <span style="font-size: 0.75rem; color: #2199EF;">${formatarMoeda(valor)}</span>
            </div>`;
        });
        (c.pacotes || []).forEach(p => {
            const pac = pacotes.find(pc => pc.id === p.pacoteId) || p;
            const precoFinal = p.preco || 0;
            itensHtml += `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span style="font-size: 0.75rem;">🎁 ${escapeHtml(pac.nome)} (Pacote)</span>
                <span style="font-size: 0.75rem; color: #2199EF;">${formatarMoeda(precoFinal)}</span>
            </div>`;
        });
        (c.produtos || []).forEach(p => {
            const prod = produtos.find(pr => pr.id === p.produtoId) || p;
            const qtd = p.quantidade || 1;
            const valor = (prod.preco || 0) * qtd;
            const preLancamentoBadge = p.isPreLancamento ? '<span style="background: rgba(33, 153, 239, 0.2); padding: 2px 4px; border-radius: 8px; font-size: 0.55rem; margin-left: 4px;">📦 Pré-lançamento</span>' : '';
            itensHtml += `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span style="font-size: 0.75rem;">📦 ${escapeHtml(prod.nome)} ${qtd > 1 ? `x${qtd}` : ''} ${preLancamentoBadge}</span>
                <span style="font-size: 0.75rem; color: #2199EF;">${formatarMoeda(valor)}</span>
            </div>`;
        });
        const totalHtml = descontoValor > 0 ? `<span style="text-decoration: line-through; font-size: 0.7rem; color: #94a3b8;">${formatarMoeda(subtotal)}</span> <strong style="color: #10b981;">${formatarMoeda(totalFinal)}</strong>` : `<strong>${formatarMoeda(totalFinal)}</strong>`;
        const data = c.dataCriacao?.toDate ? c.dataCriacao.toDate() : new Date();
        const dataFormatada = data.toLocaleDateString('pt-BR');
        const horario = data.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
        const ausenciaBadge = isAusente && c.justificativaAusencia ? `<span class="ausencia-badge" title="${escapeHtml(c.justificativaAusencia)}"><i class="fa-solid fa-comment"></i> ${escapeHtml(c.justificativaAusencia.substring(0, 30))}${c.justificativaAusencia.length > 30 ? '...' : ''}</span>` : '';
        const canceladoBadge = isCancelado && c.justificativaCancelamento ? `<span class="cancelado-badge" title="${escapeHtml(c.justificativaCancelamento)}"><i class="fa-solid fa-comment"></i> ${escapeHtml(c.justificativaCancelamento.substring(0, 30))}${c.justificativaCancelamento.length > 30 ? '...' : ''}</span>` : '';
        
        return `<div class="comanda-card ${isAusente ? 'status-ausente' : (isCancelado ? 'status-cancelado' : '')}" data-id="${c.id}" style="background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-color); overflow: hidden; transition: all 0.3s ease;">
            <div style="padding: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                    <div style="background: linear-gradient(135deg, #2199EF, #1a7fcc); color: white; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(33, 153, 239, 0.3);">
                        <i class="fa-solid fa-hashtag"></i> ${numeroExibido}
                    </div>
                    <div style="padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; background: ${statusBg}; color: ${statusColor};">${statusText} ${ausenciaBadge} ${canceladoBadge}</div>
                </div>
                <div style="margin-bottom: 10px;">
                    <h3 style="margin: 0 0 4px 0; font-size: 0.9rem;">${escapeHtml(clienteInfo.nome)}</h3>
                    <div style="font-size: 0.65rem; color: #64748b;"><i class="fa-solid fa-phone"></i> ${escapeHtml(clienteInfo.telefone)}</div>
                    <div style="font-size: 0.6rem; color: #64748b; margin-top: 4px;"><i class="fa-regular fa-calendar"></i> ${dataFormatada} ${horario}</div>
                </div>
                <div class="comanda-body" style="max-height: 130px; overflow-y: auto; margin: 8px 0;">
                    <div style="font-size: 0.65rem; color: #94a3b8; margin-bottom: 6px;"><i class="fa-solid fa-list"></i> ITENS</div>
                    ${itensHtml || '<div style="text-align: center; padding: 12px; color: #94a3b8;">Nenhum item</div>'}
                </div>
                <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 0.7rem;">
                    <span style="color: #94a3b8;"><i class="fa-solid fa-user-md"></i> BARBEIRO</span>
                    <span style="font-weight: 500;">${escapeHtml(barbeiroNome)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 0.7rem;">
                    <span style="color: #94a3b8;"><i class="fa-solid fa-credit-card"></i> PAGAMENTO</span>
                    <span style="font-weight: 500;">${metodoIcon} ${metodoNome}${parcelasTexto}</span>
                </div>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); text-align: right;"><strong>Total:</strong> ${totalHtml}</div>
                <div class="comanda-footer" style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
                    <button class="btn-view" data-id="${c.id}" style="flex: 1; padding: 8px; background: rgba(33, 153, 239, 0.15); border: none; border-radius: 8px; color: #2199EF; cursor: pointer; font-size: 0.7rem;"><i class="fa-solid fa-eye"></i> Ver detalhes</button>
                    ${!isAusente && !isCancelado && c.status === "aberta" ? `
                        <button class="btn-editar" data-id="${c.id}" style="flex: 1; padding: 8px; background: rgba(33, 153, 239, 0.15); border: none; border-radius: 8px; color: #2199EF; cursor: pointer; font-size: 0.7rem;"><i class="fa-solid fa-pen"></i> Editar</button>
                        <button class="btn-cancelar" data-id="${c.id}" style="flex: 1; padding: 8px; background: rgba(239, 68, 68, 0.15); border: none; border-radius: 8px; color: #ef4444; cursor: pointer; font-size: 0.7rem;"><i class="fa-solid fa-ban"></i> Cancelar</button>
                        <button class="btn-marcar-ausente" data-id="${c.id}" style="flex: 1; padding: 8px; background: rgba(239, 68, 68, 0.15); border: none; border-radius: 8px; color: #ef4444; cursor: pointer; font-size: 0.7rem;"><i class="fa-solid fa-user-slash"></i> Ausente</button>
                        <button class="btn-finalizar" data-id="${c.id}" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #10b981, #059669); border: none; border-radius: 8px; color: white; cursor: pointer; font-size: 0.7rem;"><i class="fa-solid fa-check-circle"></i> Finalizar</button>
                    ` : ''}
                    ${isAusente ? `<button class="btn-reativar" data-id="${c.id}" style="flex: 1; padding: 8px; background: rgba(16, 185, 129, 0.15); border: none; border-radius: 8px; color: #10b981; cursor: pointer; font-size: 0.7rem;"><i class="fa-solid fa-rotate-left"></i> Reativar</button>` : ''}
                    ${isCancelado ? `<button class="btn-reativar-cancelado" data-id="${c.id}" style="flex: 1; padding: 8px; background: rgba(16, 185, 129, 0.15); border: none; border-radius: 8px; color: #10b981; cursor: pointer; font-size: 0.7rem;"><i class="fa-solid fa-rotate-left"></i> Reativar</button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
    
    document.querySelectorAll('.btn-view').forEach(btn => { btn.onclick = (e) => { e.stopPropagation(); verDetalhesComanda(btn.dataset.id); }; });
    document.querySelectorAll('.btn-editar').forEach(btn => { btn.onclick = (e) => { e.stopPropagation(); abrirModalEditarComanda(btn.dataset.id); }; });
    document.querySelectorAll('.btn-finalizar').forEach(btn => { btn.onclick = async (e) => { e.stopPropagation(); if(confirm("Finalizar esta comanda?")) await finalizarComanda(btn.dataset.id); }; });
    document.querySelectorAll('.btn-marcar-ausente').forEach(btn => { btn.onclick = (e) => { e.stopPropagation(); abrirModalJustificarAusencia(btn.dataset.id); }; });
    document.querySelectorAll('.btn-cancelar').forEach(btn => { btn.onclick = (e) => { e.stopPropagation(); abrirModalJustificarCancelamento(btn.dataset.id); }; });
    document.querySelectorAll('.btn-reativar').forEach(btn => { btn.onclick = (e) => { e.stopPropagation(); abrirModalReativarComanda(btn.dataset.id); }; });
    document.querySelectorAll('.btn-reativar-cancelado').forEach(btn => { btn.onclick = (e) => { e.stopPropagation(); abrirModalReativarComandaCancelada(btn.dataset.id); }; });
    document.querySelectorAll('.comanda-card').forEach(card => { card.onclick = (e) => { if(e.target.tagName !== 'BUTTON') verDetalhesComanda(card.dataset.id); }; });
}

// ==================== DETALHES DA COMANDA ====================

async function verDetalhesComanda(id) {
    const docSnap = await getDoc(doc(db, "comandas", id));
    if (!docSnap.exists()) return mostrarToast("Comanda não encontrada", "erro");
    const c = { id: docSnap.id, ...docSnap.data() };
    const numeroExibido = getNumeroExibido(c);
    const clienteInfo = getClienteInfo(c);
    const barbeiroNome = getBarbeiroInfo(c);
    const isAusente = c.status === "ausente";
    const isCancelado = c.status === "cancelado";
    const metodoNome = getMetodoNome(c.formaPagamento);
    const metodoIcon = getMetodoIcon(c.formaPagamento);
    const parcelasTexto = c.parcelas && c.parcelas > 1 ? ` (${c.parcelas}x)` : '';
    let servicosHtml = '', produtosHtml = '', pacotesHtml = '';
    const { subtotal, descontoValor, totalFinal } = calcularTotaisComanda(c);
    
    for (const s of (c.servicos || [])) {
        const serv = servicos.find(sv => sv.id === s.servicoId) || s;
        const qtd = s.quantidade || 1;
        const valor = (serv.preco || 0) * qtd;
        servicosHtml += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div><span style="font-size: 0.85rem;">✂️ ${escapeHtml(serv.nome)}</span>${qtd > 1 ? `<span style="font-size: 0.7rem; color: #94a3b8; margin-left: 8px;">(x${qtd})</span>` : ''}</div>
            <span style="color: #2199EF; font-weight: 500;">${formatarMoeda(valor)}</span>
        </div>`;
    }
    for (const p of (c.pacotes || [])) {
        const pac = pacotes.find(pc => pc.id === p.pacoteId) || p;
        const precoFinal = p.preco || 0;
        pacotesHtml += `<div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.02)); border-radius: 12px; margin-bottom: 12px; border: 1px solid rgba(245, 158, 11, 0.2); overflow: hidden;">
            <div style="padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: rgba(245, 158, 11, 0.2); padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; color: #f59e0b;"><i class="fa-solid fa-gift"></i> PACOTE</span>
                        <span style="font-weight: 700; font-size: 0.9rem; color: #f59e0b;">${escapeHtml(pac.nome)}</span>
                    </div>
                </div>
                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(245, 158, 11, 0.3);">
                    <span style="font-size: 0.8rem; font-weight: 700; color: #f59e0b;">${formatarMoeda(precoFinal)}</span>
                </div>
            </div>
        </div>`;
    }
    for (const p of (c.produtos || [])) {
        const prod = produtos.find(pr => pr.id === p.produtoId) || p;
        const qtd = p.quantidade || 1;
        const valor = (prod.preco || 0) * qtd;
        const preLancamentoBadge = p.isPreLancamento ? '<span style="background: rgba(33, 153, 239, 0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.6rem; margin-left: 8px;">📦 Pré-lançamento</span>' : '';
        produtosHtml += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div><span style="font-size: 0.85rem;">📦 ${escapeHtml(prod.nome)}</span>${preLancamentoBadge}${qtd > 1 ? `<span style="font-size: 0.7rem; color: #94a3b8; margin-left: 8px;">(x${qtd})</span>` : ''}</div>
            <span style="color: #2199EF; font-weight: 500;">${formatarMoeda(valor)}</span>
        </div>`;
    }
    
    const data = c.dataCriacao?.toDate ? c.dataCriacao.toDate() : new Date();
    const dataFormatada = data.toLocaleDateString('pt-BR');
    const horario = data.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
    const detalhesBody = document.getElementById("detalhesComandaBody");
    if (detalhesBody) {
        detalhesBody.innerHTML = `<div class="detalhes-comanda" style="padding: 0;">
            <div style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--border-color);">
                    <h3 style="color: #2199EF; margin: 0; font-size: 1.1rem;"><i class="fa-solid fa-hashtag"></i> COMANDA #${numeroExibido}</h3>
                    <div style="padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; ${isAusente ? 'background: rgba(239, 68, 68, 0.2); color: #ef4444;' : (isCancelado ? 'background: rgba(239, 68, 68, 0.2); color: #ef4444;' : (c.status === 'aberta' ? 'background: rgba(245, 158, 11, 0.2); color: #f59e0b;' : 'background: rgba(16, 185, 129, 0.2); color: #10b981;'))}">${isAusente ? 'Ausente' : (isCancelado ? 'Cancelado' : (c.status === "aberta" ? "Em andamento" : "Finalizada"))}</div>
                </div>
                ${isAusente && c.justificativaAusencia ? `<div class="ausencia-justificativa" style="background: rgba(239, 68, 68, 0.05); border-left: 3px solid #ef4444; padding: 10px; border-radius: 8px; margin-bottom: 20px;"><strong><i class="fa-solid fa-comment"></i> Motivo da ausência:</strong><p style="margin: 5px 0 0 0; font-size: 0.85rem;">${escapeHtml(c.justificativaAusencia)}</p>${c.dataAusencia ? `<small style="color: #64748b;">Data: ${c.dataAusencia.toDate().toLocaleDateString('pt-BR')} às ${c.dataAusencia.toDate().toLocaleTimeString('pt-BR')}</small>` : ''}</div>` : ''}
                ${isCancelado && c.justificativaCancelamento ? `<div class="cancelamento-justificativa" style="background: rgba(239, 68, 68, 0.05); border-left: 3px solid #ef4444; padding: 10px; border-radius: 8px; margin-bottom: 20px;"><strong><i class="fa-solid fa-comment"></i> Motivo do cancelamento:</strong><p style="margin: 5px 0 0 0; font-size: 0.85rem;">${escapeHtml(c.justificativaCancelamento)}</p>${c.dataCancelamento ? `<small style="color: #64748b;">Data: ${c.dataCancelamento.toDate().toLocaleDateString('pt-BR')} às ${c.dataCancelamento.toDate().toLocaleTimeString('pt-BR')}</small>` : ''}</div>` : ''}
                <div style="background: var(--bg-dark); border-radius: 16px; padding: 16px; margin-bottom: 20px;">
                    <h4 style="color: #2199EF; margin-bottom: 12px; font-size: 0.85rem;"><i class="fa-solid fa-user"></i> CLIENTE</h4>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between; flex-wrap: wrap;"><span style="color: #94a3b8;">Nome:</span><span style="font-weight: 500;">${escapeHtml(clienteInfo.nome)}</span></div>
                        <div style="display: flex; justify-content: space-between; flex-wrap: wrap;"><span style="color: #94a3b8;">Telefone:</span><span style="font-weight: 500;">${escapeHtml(clienteInfo.telefone)}</span></div>
                        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; padding-top: 8px; margin-top: 4px; border-top: 1px solid var(--border-color);"><span style="color: #94a3b8;">Data/Hora:</span><span style="font-weight: 500;">${dataFormatada} às ${horario}</span></div>
                    </div>
                </div>
                <div style="background: var(--bg-dark); border-radius: 16px; padding: 16px; margin-bottom: 20px;">
                    <h4 style="color: #2199EF; margin-bottom: 12px; font-size: 0.85rem;"><i class="fa-solid fa-user-md"></i> BARBEIRO</h4>
                    <div style="display: flex; justify-content: space-between;"><span style="color: #94a3b8;">Profissional:</span><span style="font-weight: 500;">${escapeHtml(barbeiroNome)}</span></div>
                </div>
                <div style="background: var(--bg-dark); border-radius: 16px; padding: 16px; margin-bottom: 20px;">
                    <h4 style="color: #2199EF; margin-bottom: 12px; font-size: 0.85rem;"><i class="fa-solid fa-credit-card"></i> PAGAMENTO</h4>
                    <div style="display: flex; justify-content: space-between;"><span style="color: #94a3b8;">Forma de Pagamento:</span><span style="font-weight: 500;">${metodoIcon} ${metodoNome}${parcelasTexto}</span></div>
                </div>
                ${servicosHtml ? `<div style="background: var(--bg-dark); border-radius: 16px; padding: 16px; margin-bottom: 20px;"><h4 style="color: #2199EF; margin-bottom: 12px; font-size: 0.85rem;"><i class="fa-solid fa-cut"></i> SERVIÇOS</h4>${servicosHtml}</div>` : ''}
                ${pacotesHtml ? `<div style="margin-bottom: 20px;"><h4 style="color: #f59e0b; margin-bottom: 12px; font-size: 0.85rem;"><i class="fa-solid fa-gift"></i> PACOTES</h4>${pacotesHtml}</div>` : ''}
                ${produtosHtml ? `<div style="background: var(--bg-dark); border-radius: 16px; padding: 16px; margin-bottom: 20px;"><h4 style="color: #2199EF; margin-bottom: 12px; font-size: 0.85rem;"><i class="fa-solid fa-box"></i> PRODUTOS</h4>${produtosHtml}</div>` : ''}
                <div style="background: var(--bg-dark); border-radius: 16px; padding: 16px;">
                    <h4 style="color: #2199EF; margin-bottom: 12px; font-size: 0.85rem;"><i class="fa-solid fa-credit-card"></i> VALORES</h4>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><span style="color: #94a3b8;">Subtotal:</span><span>${formatarMoeda(subtotal)}</span></div>
                    ${descontoValor > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><span style="color: #94a3b8;">Desconto:</span><span style="color: #10b981;">- ${formatarMoeda(descontoValor)}</span></div>` : ''}
                    <div style="display: flex; justify-content: space-between; padding-top: 12px; margin-top: 8px; border-top: 1px solid var(--border-color); font-weight: 800; color: #2199EF;"><span>Total:</span><span>${formatarMoeda(totalFinal)}</span></div>
                </div>
                ${c.observacoes ? `<div style="background: var(--bg-dark); border-radius: 16px; padding: 16px; margin-top: 20px;"><h4 style="color: #2199EF; margin-bottom: 8px; font-size: 0.85rem;"><i class="fa-solid fa-note-sticky"></i> OBSERVAÇÕES</h4><p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">${escapeHtml(c.observacoes)}</p></div>` : ''}
            </div>
        </div>`;
    }
    modalDetalhes.classList.add("active");
}

// ==================== VERIFICAÇÃO DE ESTOQUE ====================

async function verificarDisponibilidadeProdutos(produtosLista) {
    const produtosIndisponiveis = [];
    for (const item of produtosLista) {
        if (item.isPreLancamento) continue;
        const produtoRef = doc(db, "produtos", item.produtoId);
        const produtoDoc = await getDoc(produtoRef);
        if (produtoDoc.exists()) {
            const produtoData = produtoDoc.data();
            const quantidadeEmEstoque = produtoData.quantidade || 0;
            const quantidadeSolicitada = item.quantidade || 1;
            if (quantidadeEmEstoque < quantidadeSolicitada) {
                produtosIndisponiveis.push({ id: item.produtoId, nome: item.nome || produtoData.nome, disponivel: quantidadeEmEstoque, solicitado: quantidadeSolicitada });
            }
        }
    }
    return produtosIndisponiveis;
}

async function podeFinalizarComanda(comandaData) {
    const produtosLista = comandaData.produtos || [];
    const produtosNormais = produtosLista.filter(p => !p.isPreLancamento);
    if (produtosNormais.length === 0) return { pode: true, mensagem: "" };
    const indisponiveis = await verificarDisponibilidadeProdutos(produtosNormais);
    if (indisponiveis.length > 0) {
        let mensagem = "❌ Não foi possível finalizar a comanda. Produtos sem estoque disponível:\n\n";
        indisponiveis.forEach(p => { mensagem += `• ${p.nome}: solicitado ${p.solicitado}, disponível ${p.disponivel}\n`; });
        mensagem += "\n⚠️ Remova os produtos indisponíveis ou aguarde a reposição do estoque.";
        return { pode: false, mensagem: mensagem, produtosIndisponiveis: indisponiveis };
    }
    return { pode: true, mensagem: "" };
}

// ==================== FINALIZAR COMANDA ====================

async function finalizarComanda(id) {
    try {
        console.log("🎯 Iniciando finalização da comanda:", id);
        const comandaDoc = await getDoc(doc(db, "comandas", id));
        if (!comandaDoc.exists()) {
            mostrarToast("Comanda não encontrada", "erro");
            return;
        }
        const comandaData = { id: comandaDoc.id, ...comandaDoc.data() };
        
        const verificacao = await podeFinalizarComanda(comandaData);
        if (!verificacao.pode) {
            mostrarToast(verificacao.mensagem, "erro");
            return;
        }
        
        const produtosLista = comandaData.produtos || [];
        const produtosNormais = produtosLista.filter(p => !p.isPreLancamento);
        
        for (const item of produtosNormais) {
            const produtoRef = doc(db, "produtos", item.produtoId);
            const produtoDoc = await getDoc(produtoRef);
            if (produtoDoc.exists()) {
                const produtoData = produtoDoc.data();
                const novaQuantidade = Math.max(0, (produtoData.quantidade || 0) - (item.quantidade || 1));
                await updateDoc(produtoRef, { quantidade: novaQuantidade, updatedAt: Timestamp.now() });
                await addDoc(collection(db, "movimentacoes"), {
                    produtoId: item.produtoId, produtoNome: item.nome, tipo: "saida",
                    quantidade: item.quantidade || 1, quantidadeAnterior: produtoData.quantidade || 0,
                    quantidadeNova: novaQuantidade, observacao: `Venda finalizada - Comanda #${comandaData.numeroComanda || id.slice(-6)}`,
                    data: Timestamp.now(), usuario: "Sistema"
                });
                console.log(`📦 Estoque atualizado: ${item.nome} - nova quantidade: ${novaQuantidade}`);
            }
        }
        
        const produtosPreLancamento = produtosLista.filter(p => p.isPreLancamento === true);
        for (const item of produtosPreLancamento) {
            if (item.lembreteId) {
                await updateDoc(doc(db, "lembretes_comanda", item.lembreteId), { status: "entregue", dataEntrega: Timestamp.now(), comandaFinalizadaId: id });
                console.log(`✅ Pré-lançamento "${item.nome}" marcado como entregue`);
            }
        }
        
        if (comandaData.clienteId) {
            const { totalFinal } = calcularTotaisComanda(comandaData);
            if (totalFinal > 0) {
                await adicionarPontosFidelidade(comandaData.clienteId, comandaData.clienteNome, totalFinal, "servico");
            }
        }
        
        await sincronizarPagamentoComFinanceiro(id, comandaData);
        
        if (comandaData.agendamentoId) {
            try {
                const agendamentoRef = doc(db, "agendamentos", comandaData.agendamentoId);
                await updateDoc(agendamentoRef, { status: "finalizado", dataFinalizacao: Timestamp.now(), atualizadoEm: Timestamp.now() });
                console.log(`✅ Agendamento ${comandaData.agendamentoId} atualizado para finalizado`);
            } catch (error) { console.error("Erro ao atualizar agendamento:", error); }
        }
        
        await updateDoc(doc(db, "comandas", id), { status: "finalizada", dataFinalizacao: Timestamp.now(), updatedAt: Timestamp.now() });
        console.log("✅ Comanda finalizada com sucesso!");
        mostrarToast("Comanda finalizada com sucesso! Estoque atualizado e pagamento registrado.");
        dispararAtualizacaoPagamento(id);
        
        if (filtrandoComandaEspecifica && comandaEspecificaId === id) {
            setTimeout(() => filtrarPorIdComanda(id), 1000);
        }
    } catch (error) {
        console.error("❌ Erro ao finalizar comanda:", error);
        mostrarToast("Erro ao finalizar comanda: " + error.message, "erro");
    }
}

// ==================== FUNÇÕES DE AUSÊNCIA ====================

function abrirModalJustificarAusencia(comandaId) {
    comandaParaAusencia = comandaId;
    const justificativa = document.getElementById("justificativaAusencia");
    if (justificativa) justificativa.value = "";
    const modal = document.getElementById("modalJustificarAusencia");
    if (modal) modal.classList.add("active");
}

function fecharModalJustificarAusencia() {
    const modal = document.getElementById("modalJustificarAusencia");
    if (modal) modal.classList.remove("active");
    comandaParaAusencia = null;
}

async function marcarComoAusente() {
    if (!comandaParaAusencia) return;
    const justificativa = document.getElementById("justificativaAusencia")?.value || "";
    try {
        const comandaDoc = await getDoc(doc(db, "comandas", comandaParaAusencia));
        const comandaData = comandaDoc.data();
        await updateDoc(doc(db, "comandas", comandaParaAusencia), {
            status: "ausente", justificativaAusencia: justificativa, dataAusencia: Timestamp.now(), updatedAt: Timestamp.now()
        });
        if (comandaData.agendamentoId) {
            await updateDoc(doc(db, "agendamentos", comandaData.agendamentoId), {
                status: "ausente", dataAusencia: Timestamp.now(), motivoAusencia: justificativa || "Cliente não compareceu", atualizadoEm: Timestamp.now()
            });
            console.log(`✅ Agendamento ${comandaData.agendamentoId} marcado como ausente`);
            mostrarToast("Comanda e agendamento marcados como ausente!");
            if (typeof window.atualizarAgenda === 'function') setTimeout(() => window.atualizarAgenda(), 500);
        } else {
            mostrarToast("Comanda marcada como ausente!");
        }
        dispararAtualizacaoPagamento(comandaParaAusencia);
        fecharModalJustificarAusencia();
    } catch (error) {
        console.error("Erro ao marcar como ausente:", error);
        mostrarToast("Erro ao marcar comanda como ausente", "erro");
    }
}

function abrirModalReativarComanda(comandaId) {
    comandaParaReativar = comandaId;
    const modal = document.getElementById("modalReativarComanda");
    if (modal) modal.classList.add("active");
}

function fecharModalReativarComanda() {
    const modal = document.getElementById("modalReativarComanda");
    if (modal) modal.classList.remove("active");
    comandaParaReativar = null;
}

async function reativarComanda() {
    if (!comandaParaReativar) return;
    try {
        const comandaDoc = await getDoc(doc(db, "comandas", comandaParaReativar));
        if (!comandaDoc.exists()) {
            mostrarToast("Comanda não encontrada", "erro");
            return;
        }
        const comandaData = comandaDoc.data();
        await updateDoc(doc(db, "comandas", comandaParaReativar), { status: "aberta", updatedAt: Timestamp.now() });
        if (comandaData.agendamentoId) {
            await updateDoc(doc(db, "agendamentos", comandaData.agendamentoId), { status: "confirmado", atualizadoEm: Timestamp.now() });
            console.log(`✅ Agendamento ${comandaData.agendamentoId} reativado`);
            mostrarToast("Comanda reativada! Agendamento retornou para Confirmados.", "sucesso");
        } else {
            mostrarToast("Comanda reativada com sucesso!", "sucesso");
        }
        dispararAtualizacaoPagamento(comandaParaReativar);
        fecharModalReativarComanda();
        if (typeof window.atualizarAgenda === 'function') setTimeout(() => window.atualizarAgenda(), 500);
        if (typeof aplicarFiltros === 'function') aplicarFiltros();
        if (filtrandoComandaEspecifica && comandaEspecificaId === comandaParaReativar) {
            setTimeout(() => filtrarPorIdComanda(comandaParaReativar), 1000);
        }
    } catch (error) {
        console.error("Erro ao reativar comanda:", error);
        mostrarToast("Erro ao reativar comanda: " + error.message, "erro");
    }
}

// ==================== FUNÇÕES DE CANCELAMENTO ====================

function abrirModalJustificarCancelamento(comandaId) {
    comandaParaCancelamento = comandaId;
    const justificativa = document.getElementById("justificativaCancelamento");
    if (justificativa) justificativa.value = "";
    const modal = document.getElementById("modalJustificarCancelamento");
    if (modal) modal.classList.add("active");
}

function fecharModalJustificarCancelamento() {
    const modal = document.getElementById("modalJustificarCancelamento");
    if (modal) modal.classList.remove("active");
    comandaParaCancelamento = null;
}

async function marcarComoCancelado() {
    if (!comandaParaCancelamento) return;
    const justificativa = document.getElementById("justificativaCancelamento")?.value || "";
    try {
        const comandaDoc = await getDoc(doc(db, "comandas", comandaParaCancelamento));
        const comandaData = comandaDoc.data();
        await updateDoc(doc(db, "comandas", comandaParaCancelamento), {
            status: "cancelado", justificativaCancelamento: justificativa, dataCancelamento: Timestamp.now(), updatedAt: Timestamp.now()
        });
        if (comandaData.agendamentoId) {
            await updateDoc(doc(db, "agendamentos", comandaData.agendamentoId), {
                status: "cancelado", motivoCancelamento: justificativa || "Cancelado pelo sistema", atualizadoEm: Timestamp.now()
            });
            console.log(`✅ Agendamento ${comandaData.agendamentoId} cancelado`);
            mostrarToast("Comanda e agendamento cancelados!");
        } else {
            mostrarToast("Comanda cancelada!");
        }
        dispararAtualizacaoPagamento(comandaParaCancelamento);
        fecharModalJustificarCancelamento();
    } catch (error) {
        console.error("Erro ao cancelar comanda:", error);
        mostrarToast("Erro ao cancelar comanda", "erro");
    }
}

function abrirModalReativarComandaCancelada(comandaId) {
    comandaParaReativarCancelada = comandaId;
    const modal = document.getElementById("modalReativarComandaCancelada");
    if (modal) modal.classList.add("active");
}

function fecharModalReativarComandaCancelada() {
    const modal = document.getElementById("modalReativarComandaCancelada");
    if (modal) modal.classList.remove("active");
    comandaParaReativarCancelada = null;
}

async function reativarComandaCancelada() {
    if (!comandaParaReativarCancelada) return;
    try {
        const comandaDoc = await getDoc(doc(db, "comandas", comandaParaReativarCancelada));
        if (!comandaDoc.exists()) {
            mostrarToast("Comanda não encontrada", "erro");
            return;
        }
        const comandaData = comandaDoc.data();
        await updateDoc(doc(db, "comandas", comandaParaReativarCancelada), { status: "aberta", updatedAt: Timestamp.now() });
        if (comandaData.agendamentoId) {
            await updateDoc(doc(db, "agendamentos", comandaData.agendamentoId), { status: "confirmado", atualizadoEm: Timestamp.now() });
            console.log(`✅ Agendamento ${comandaData.agendamentoId} reativado`);
            mostrarToast("Comanda reativada! Agendamento retornou para Confirmados.", "sucesso");
        } else {
            mostrarToast("Comanda reativada com sucesso!", "sucesso");
        }
        dispararAtualizacaoPagamento(comandaParaReativarCancelada);
        fecharModalReativarComandaCancelada();
        if (typeof window.atualizarAgenda === 'function') setTimeout(() => window.atualizarAgenda(), 500);
        if (typeof aplicarFiltros === 'function') aplicarFiltros();
        if (filtrandoComandaEspecifica && comandaEspecificaId === comandaParaReativarCancelada) {
            setTimeout(() => filtrarPorIdComanda(comandaParaReativarCancelada), 1000);
        }
    } catch (error) {
        console.error("Erro ao reativar comanda cancelada:", error);
        mostrarToast("Erro ao reativar comanda: " + error.message, "erro");
    }
}

// ==================== FUNÇÕES DE COMANDA ====================

function abrirNovaComanda() {
    if (!servicos.length || !clientes.length || !profissionais.length) {
        mostrarToast("Cadastre serviços, clientes e barbeiros primeiro!", "erro");
        return;
    }
    document.getElementById("modalComandaTitle").innerHTML = '<i class="fa-solid fa-receipt"></i> Nova Comanda';
    document.getElementById("comandaId").value = "";
    if (comandaCliente) comandaCliente.value = "";
    if (comandaBarbeiro) comandaBarbeiro.value = "";
    const comandaObservacoes = document.getElementById("comandaObservacoes");
    if (comandaObservacoes) comandaObservacoes.value = "";
    const comandaPagamento = document.getElementById("comandaPagamento");
    if (comandaPagamento) comandaPagamento.value = "pendente";
    
    if (comandaServicosContainer) {
        comandaServicosContainer.innerHTML = `<div class="servico-comanda-item"><div class="servico-comanda-row"><select class="servico-comanda-select" required><option value="">Selecione um serviço</option>${servicos.map(s => `<option value="${s.id}">${escapeHtml(s.nome)} - ${formatarMoeda(s.preco)}</option>`).join('')}</select><button type="button" class="btn-remove-servico-comanda" style="display:none;"><i class="fa-solid fa-trash"></i></button></div></div>`;
        const select = comandaServicosContainer.querySelector(".servico-comanda-select");
        if (select) select.addEventListener("change", () => calcularTotaisModal());
    }
    calcularTotaisModal();
    modalComanda.classList.add("active");
    
    console.log("🆕 Nova comanda - Número será gerado automaticamente ao salvar");
}

function fecharModalComanda() { if (modalComanda) modalComanda.classList.remove("active"); }
function fecharModalDetalhes() { if (modalDetalhes) modalDetalhes.classList.remove("active"); }
function fecharModalEditar() { if (modalEditarComanda) modalEditarComanda.classList.remove("active"); comandaEditando = null; window.comandaEditando = null; descontoAplicado = { valor: 0, tipo: "percentual", programaId: null, nomePrograma: null, produtosIds: [] }; }
function fecharModalProgramas() { const modal = document.getElementById("modalProgramasDesconto"); if (modal) modal.classList.remove("active"); }

function calcularTotaisModal() {
    let total = 0;
    document.querySelectorAll(".servico-comanda-select").forEach(select => {
        if (select.value) {
            const servico = servicos.find(s => s.id === select.value);
            if (servico) total += servico.preco;
        }
    });
    const subtotalEl = document.getElementById("comandaSubtotal");
    const totalEl = document.getElementById("comandaTotal");
    if (subtotalEl) subtotalEl.textContent = formatarMoeda(total);
    if (totalEl) totalEl.textContent = formatarMoeda(total);
    return total;
}

function adicionarServicoComanda(servicoId = null) {
    if (!comandaServicosContainer) return;
    const item = document.createElement("div");
    item.className = "servico-comanda-item";
    item.innerHTML = `<div class="servico-comanda-row"><select class="servico-comanda-select" required><option value="">Selecione um serviço</option>${servicos.map(s => `<option value="${s.id}" ${servicoId === s.id ? 'selected' : ''}>${escapeHtml(s.nome)} - ${formatarMoeda(s.preco)}</option>`).join('')}</select><button type="button" class="btn-remove-servico-comanda"><i class="fa-solid fa-trash"></i></button></div>`;
    item.querySelector(".servico-comanda-select").addEventListener("change", calcularTotaisModal);
    item.querySelector(".btn-remove-servico-comanda").onclick = () => { item.remove(); if (!document.querySelectorAll(".servico-comanda-item").length) adicionarServicoComanda(); calcularTotaisModal(); };
    comandaServicosContainer.appendChild(item);
    calcularTotaisModal();
}

async function salvarComanda(finalizar = false) {
    const clienteId = comandaCliente?.value, barbeiroId = comandaBarbeiro?.value, observacoes = document.getElementById("comandaObservacoes")?.value, formaPagamento = document.getElementById("comandaPagamento")?.value;
    if (!clienteId || !barbeiroId) return mostrarToast("Preencha todos os campos", "erro");
    
    const servicosSelecionados = [];
    document.querySelectorAll(".servico-comanda-select").forEach(select => { 
        if (select.value) { 
            const s = servicos.find(sv => sv.id === select.value); 
            if (s) servicosSelecionados.push({ servicoId: s.id, nome: s.nome, preco: s.preco, quantidade: 1, tipo: "servico" }); 
        } 
    });
    
    if (!servicosSelecionados.length) return mostrarToast("Adicione um serviço", "erro");
    
    const total = servicosSelecionados.reduce((s, i) => s + i.preco, 0);
    const barbeiroNome = profissionais.find(p => p.id === barbeiroId)?.nome || "Barbeiro";
    const clienteNome = clientes.find(c => c.id === clienteId)?.nome || "Cliente";
    const clienteTelefone = clientes.find(c => c.id === clienteId)?.telefone || "";
    
    // CORREÇÃO: Garantir que o número da comanda seja gerado corretamente
    const proximoNumero = await getProximoNumeroComanda();
    console.log(`📝 Gerando nova comanda com número: ${proximoNumero}`);
    
    if (!proximoNumero || proximoNumero === 0) {
        console.error("❌ Erro: Número da comanda é inválido!", proximoNumero);
        mostrarToast("Erro ao gerar número da comanda. Tente novamente.", "erro");
        return;
    }
    
    let produtosPreLancamento = [];
    try {
        const lembretesQuery = query(collection(db, "lembretes_comanda"), where("clienteId", "==", clienteId), where("status", "==", "pendente"));
        const lembretesSnapshot = await getDocs(lembretesQuery);
        lembretesSnapshot.forEach(doc => {
            const data = doc.data();
            produtosPreLancamento.push({
                produtoId: data.produtoId, nome: data.produtoNome, preco: data.preco || 0,
                quantidade: data.quantidade || 1, isPreLancamento: true, afetaEstoque: false,
                observacaoPreLancamento: data.observacao || "", lembreteId: doc.id,
                comandaOrigemId: data.comandaOrigemId
            });
        });
        if (produtosPreLancamento.length > 0) {
            mostrarToast(`📦 ${produtosPreLancamento.length} produto(s) em pré-lançamento foram adicionados à comanda!`, "sucesso");
        }
    } catch (error) { console.error("Erro ao carregar pré-lançamentos:", error); }
    
    const comandaData = { 
        clienteId, barbeiroId, barbeiroNome, clienteNome: clienteNome, clienteTelefone: clienteTelefone,
        servicos: servicosSelecionados, pacotes: [], produtos: produtosPreLancamento,
        subtotal: total, total: total, observacoes: observacoes || "",
        formaPagamento: finalizar ? formaPagamento : "pendente", 
        numeroComanda: proximoNumero,
        dataCriacao: Timestamp.now(), 
        status: finalizar ? "finalizada" : "aberta",
        updatedAt: Timestamp.now()
    };
    
    if (finalizar) comandaData.dataFinalizacao = Timestamp.now();
    
    const comandaIdField = document.getElementById("comandaId")?.value;
    let comandaRef;
    
    if (comandaIdField) {
        await updateDoc(doc(db, "comandas", comandaIdField), comandaData);
        comandaRef = comandaIdField;
        console.log(`✅ Comanda ${comandaRef} atualizada - Número: ${proximoNumero}`);
        mostrarToast(`✅ Comanda #${proximoNumero} atualizada com sucesso!`, "sucesso");
    } else {
        const newDoc = await addDoc(collection(db, "comandas"), comandaData);
        comandaRef = newDoc.id;
        console.log(`✅ Nova comanda criada - ID: ${comandaRef}, Número: ${proximoNumero}`);
        
        // Verificar se o número foi realmente salvo
        const savedDoc = await getDoc(doc(db, "comandas", comandaRef));
        const savedNumero = savedDoc.data()?.numeroComanda;
        console.log(`🔍 Verificação: Número salvo no Firestore: ${savedNumero}`);
        
        if (savedNumero !== proximoNumero) {
            console.error(`❌ ERRO: Número salvo (${savedNumero}) diferente do gerado (${proximoNumero})`);
            await updateDoc(doc(db, "comandas", comandaRef), { numeroComanda: proximoNumero });
            console.log(`✅ Corrigido: Número ${proximoNumero} foi reaplicado`);
        }
    }
    
    if (finalizar) {
        const comandaSalva = { ...comandaData, id: comandaRef };
        await sincronizarPagamentoComFinanceiro(comandaRef, comandaSalva);
        mostrarToast(`✅ Comanda #${proximoNumero} finalizada com sucesso!`, "sucesso");
    } else {
        dispararAtualizacaoPagamento(comandaRef);
        mostrarToast(`✅ Comanda #${proximoNumero} salva com sucesso!`, "sucesso");
    }
    
    fecharModalComanda();
}

async function atualizarMetricas() {
    const abertas = comandas.filter(c => c.status === "aberta" && filtrarPorPeriodo(c));
    const finalizadas = comandas.filter(c => c.status === "finalizada" && c.dataFinalizacao?.toDate && filtrarPorPeriodo(c));
    let faturamento = 0;
    for (const c of finalizadas) {
        const { totalFinal } = calcularTotaisComanda(c);
        faturamento += totalFinal;
    }
    if (totalComandasEl) totalComandasEl.textContent = abertas.length;
    if (faturamentoDiaEl) faturamentoDiaEl.textContent = formatarMoeda(faturamento);
    if (mediaComandaEl) mediaComandaEl.textContent = formatarMoeda(finalizadas.length ? faturamento / finalizadas.length : 0);
    if (clientesAtendidosEl) clientesAtendidosEl.textContent = new Set(finalizadas.map(c => c.clienteId)).size;
}

// ==================== EDIÇÃO DE COMANDA ====================

async function abrirModalEditarComanda(id) {
    console.log("📝 ========== ABRINDO MODAL DE EDIÇÃO ==========");
    console.log("📝 ID da comanda:", id);
    
    const docSnap = await getDoc(doc(db, "comandas", id));
    if (!docSnap.exists()) {
        console.error("❌ Comanda não encontrada:", id);
        return mostrarToast("Comanda não encontrada", "erro");
    }
    
    comandaEditando = { id, ...docSnap.data() };
    window.comandaEditando = comandaEditando;
    comandaEditando.servicos = comandaEditando.servicos || [];
    comandaEditando.pacotes = comandaEditando.pacotes || [];
    comandaEditando.produtos = comandaEditando.produtos || [];
    
    console.log("📊 Dados da comanda carregados:");
    console.log("   - Cliente ID:", comandaEditando.clienteId);
    console.log("   - Número da comanda:", comandaEditando.numeroComanda);
    console.log("   - Produtos de pré-lançamento existentes:", comandaEditando.produtos.filter(p => p.isPreLancamento).length);
    
    for (const p of comandaEditando.produtos) {
        const produto = produtos.find(pr => pr.id === p.produtoId);
        if (produto) p.estoqueDisponivel = produto.quantidade || 0;
        if (p.isPreLancamento) {
            console.log(`   📦 Pré-lançamento existente: ${p.nome}`);
        }
    }
    
    if (comandaEditando.desconto?.valor > 0) {
        descontoAplicado = { valor: comandaEditando.desconto.valor, tipo: comandaEditando.desconto.tipo, programaId: comandaEditando.desconto.programaId, nomePrograma: comandaEditando.desconto.nomePrograma, produtosIds: comandaEditando.desconto.produtosIds || [] };
    } else {
        descontoAplicado = { valor: 0, tipo: "percentual", programaId: null, nomePrograma: null, produtosIds: [] };
    }
    
    const editarCliente = document.getElementById("editarCliente");
    const editarBarbeiro = document.getElementById("editarBarbeiro");
    
    if (editarCliente) {
        if (editarCliente.options.length <= 1) {
            editarCliente.innerHTML = '<option value="">Selecione um cliente</option>';
            clientes.forEach(cliente => {
                editarCliente.innerHTML += `<option value="${cliente.id}">${escapeHtml(cliente.nome)}</option>`;
            });
        }
        editarCliente.disabled = false;
        editarCliente.value = comandaEditando.clienteId || "";
        console.log("📋 Cliente selecionado:", editarCliente.value);
    }
    
    if (editarBarbeiro) {
        if (editarBarbeiro.options.length <= 1) {
            editarBarbeiro.innerHTML = '<option value="">Selecione um barbeiro</option>';
            profissionais.forEach(prof => {
                editarBarbeiro.innerHTML += `<option value="${prof.id}">${escapeHtml(prof.nome)}</option>`;
            });
        }
        editarBarbeiro.disabled = false;
        editarBarbeiro.value = comandaEditando.barbeiroId || "";
    }
    
    const editarObservacoes = document.getElementById("editarObservacoes");
    if (editarObservacoes) editarObservacoes.value = comandaEditando.observacoes || "";
    
    if (comandaEditando.clienteId) {
        console.log("👤 Cliente ID encontrado:", comandaEditando.clienteId);
        await carregarESincronizarPreLancamentosCliente(comandaEditando.clienteId);
    } else {
        console.log("⚠️ Cliente ID não encontrado na comanda.");
    }
    
    await renderizarPreLancamentosNaSecao();
    await adicionarPreLancamentosAComanda();
    renderizarListaItensEdicao();
    recalcularTotalComDesconto();
    atualizarInterfaceDesconto();
    
    console.log("📝 ========== MODAL DE EDIÇÃO ABERTO ==========");
    
    if (modalEditarComanda) modalEditarComanda.classList.add("active");
}

window.abrirModalEditarComanda = abrirModalEditarComanda;
window.verDetalhesComanda = verDetalhesComanda;

function renderizarListaItensEdicao() {
    const container = document.getElementById("listaItensComanda");
    if (!container) return;
    if (!comandaEditando) {
        container.innerHTML = '<div class="empty-itens">Nenhuma comanda carregada</div>';
        return;
    }
    let itens = [], subtotal = 0;
    (comandaEditando.servicos || []).forEach((s, idx) => {
        const nome = s.nome || servicos.find(sv => sv.id === s.servicoId)?.nome || "Serviço";
        const preco = s.preco || servicos.find(sv => sv.id === s.servicoId)?.preco || 0;
        const qtd = s.quantidade || 1;
        const valor = preco * qtd;
        subtotal += valor;
        itens.push({ tipo: "servico", indice: idx, nome, preco, quantidade: qtd, valorTotal: valor, isServico: true });
    });
    (comandaEditando.pacotes || []).forEach((p, idx) => {
        const nome = p.nome || pacotes.find(pc => pc.id === p.pacoteId)?.nome || "Pacote";
        const precoFinal = p.preco || 0;
        subtotal += precoFinal;
        itens.push({ tipo: "pacote", indice: idx, nome, preco: precoFinal, quantidade: 1, valorTotal: precoFinal, isPacote: true });
    });
    (comandaEditando.produtos || []).forEach((p, idx) => {
        const nome = p.nome || produtos.find(pr => pr.id === p.produtoId)?.nome || "Produto";
        const preco = p.preco || produtos.find(pr => pr.id === p.produtoId)?.preco || 0;
        const qtd = p.quantidade || 1;
        const valor = preco * qtd;
        subtotal += valor;
        const estoqueDisponivel = produtos.find(pr => pr.id === p.produtoId)?.quantidade || 0;
        const temEstoque = estoqueDisponivel >= qtd || p.isPreLancamento === true;
        itens.push({ 
            tipo: "produto", indice: idx, nome, preco, quantidade: qtd, valorTotal: valor, 
            estoqueDisponivel, temEstoque, isPreLancamento: p.isPreLancamento === true,
            lembreteId: p.lembreteId, isProduto: true
        });
    });
    const editarSubtotal = document.getElementById("editarSubtotal");
    if (editarSubtotal) editarSubtotal.textContent = formatarMoeda(subtotal);
    if (itens.length === 0) {
        container.innerHTML = '<div class="empty-itens">Nenhum item adicionado</div>';
        return;
    }
    container.innerHTML = itens.map((item, idx) => {
        let icone = "", badgeHtml = "", alertaEstoqueHtml = "", disabledQtd = "";
        if (item.tipo === "servico") icone = "✂️";
        else if (item.tipo === "pacote") icone = "🎁";
        else {
            icone = "📦";
            if (item.isPreLancamento) {
                badgeHtml = '<span style="background: #2199EF; color: #fff; padding: 2px 8px; border-radius: 20px; font-size: 0.6rem; margin-left: 8px; font-weight: 600;">📦 PRÉ-LANÇAMENTO PENDENTE</span>';
                disabledQtd = '';
            }
            if (!item.isPreLancamento && !item.temEstoque) {
                alertaEstoqueHtml = `<span style="background: rgba(239, 68, 68, 0.2); padding: 2px 6px; border-radius: 10px; font-size: 0.6rem; margin-left: 6px; color: #ef4444;">⚠️ Estoque: ${item.estoqueDisponivel}</span>`;
            }
        }
        return `<div class="item-edicao ${(!item.isProduto && !item.temEstoque && !item.isPreLancamento) ? 'item-sem-estoque' : ''}" data-index="${idx}" data-tipo="${item.tipo}" data-indice="${item.indice}">
            <div class="item-info">
                <span class="item-nome">${icone} ${escapeHtml(item.nome)}${badgeHtml}${alertaEstoqueHtml}</span>
                <span class="item-preco">${formatarMoeda(item.preco)}</span>
                <div class="item-quantidade">
                    <button class="btn-qtd" data-op="menos" ${disabledQtd}>-</button>
                    <span class="qtd-valor">${item.quantidade}</span>
                    <button class="btn-qtd" data-op="mais" ${disabledQtd}>+</button>
                </div>
                <span class="item-valor-total">Total: ${formatarMoeda(item.valorTotal)}</span>
                <button class="btn-remove-item" data-tipo="${item.tipo}" data-indice="${item.indice}" data-is-pre-lancamento="${item.isPreLancamento || false}"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
    
    container.querySelectorAll('.btn-qtd').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.closest('.item-edicao').dataset.index);
            const op = btn.dataset.op;
            const item = itens[idx];
            if (op === 'mais') {
                if (item.tipo === "servico") {
                    comandaEditando.servicos[item.indice].quantidade = (comandaEditando.servicos[item.indice].quantidade || 1) + 1;
                } else if (item.tipo === "pacote") {
                    mostrarToast("Pacotes não permitem alteração de quantidade", "erro");
                    return;
                } else if (item.tipo === "produto") {
                    const novaQuantidade = (comandaEditando.produtos[item.indice].quantidade || 1) + 1;
                    if (!item.isPreLancamento) {
                        const produtoId = comandaEditando.produtos[item.indice].produtoId;
                        const estoqueDisponivel = produtos.find(p => p.id === produtoId)?.quantidade || 0;
                        if (estoqueDisponivel < novaQuantidade) {
                            mostrarToast(`⚠️ Estoque insuficiente! Disponível: ${estoqueDisponivel} un.`, "erro");
                            return;
                        }
                    }
                    comandaEditando.produtos[item.indice].quantidade = novaQuantidade;
                }
            } else if (op === 'menos' && item.quantidade > 1) {
                if (item.tipo === "servico") {
                    comandaEditando.servicos[item.indice].quantidade = (comandaEditando.servicos[item.indice].quantidade || 1) - 1;
                } else if (item.tipo === "produto") {
                    comandaEditando.produtos[item.indice].quantidade = (comandaEditando.produtos[item.indice].quantidade || 1) - 1;
                }
            }
            renderizarListaItensEdicao();
            recalcularTotalComDesconto();
        };
    });
    
    container.querySelectorAll('.btn-remove-item').forEach(btn => {
        btn.onclick = async () => {
            const tipo = btn.getAttribute('data-tipo');
            const indice = parseInt(btn.getAttribute('data-indice'));
            const isPreLancamento = btn.getAttribute('data-is-pre-lancamento') === 'true';
            
            const itemNome = tipo === "servico" ? comandaEditando.servicos[indice]?.nome :
                            (tipo === "pacote" ? comandaEditando.pacotes[indice]?.nome :
                            comandaEditando.produtos[indice]?.nome);
            
            if (confirm(`Remover "${itemNome}" da comanda?`)) {
                if (tipo === "servico") {
                    comandaEditando.servicos.splice(indice, 1);
                } else if (tipo === "pacote") {
                    comandaEditando.pacotes.splice(indice, 1);
                } else if (tipo === "produto") {
                    const produtoRemovido = comandaEditando.produtos[indice];
                    comandaEditando.produtos.splice(indice, 1);
                    
                    if (isPreLancamento && produtoRemovido.lembreteId) {
                        console.log(`📦 Pré-lançamento "${produtoRemovido.nome}" removido da comanda, mas permanece na lista de lembretes`);
                        if (typeof renderizarPreLancamentosNaSecao === 'function') {
                            await renderizarPreLancamentosNaSecao();
                        }
                    }
                }
                renderizarListaItensEdicao();
                recalcularTotalComDesconto();
                mostrarToast(`✅ "${itemNome}" removido da comanda!`, "sucesso");
            }
        };
    });
}

window.renderizarListaItensEdicao = renderizarListaItensEdicao;

function adicionarItemNaComanda() {
    const tipo = document.getElementById("tipoItemSelect")?.value || "servico";
    const itemId = tipo === "servico" ? document.getElementById("novoServicoSelect")?.value : document.getElementById("novoProdutoSelect")?.value;
    if (!itemId) return mostrarToast("Selecione um item", "erro");
    const item = tipo === "servico" ? servicos.find(s => s.id === itemId) : produtos.find(p => p.id === itemId);
    if (!item) return;
    if (tipo === "servico") {
        comandaEditando.servicos.push({ servicoId: item.id, nome: item.nome, preco: item.preco, quantidade: 1, tipo: "servico" });
    } else {
        comandaEditando.produtos.push({ produtoId: item.id, nome: item.nome, preco: item.preco, quantidade: 1 });
        if (item.quantidade <= 0) mostrarToast(`⚠️ Produto "${item.nome}" adicionado com estoque zero!`, "erro");
    }
    const novoServicoSelect = document.getElementById("novoServicoSelect");
    const novoProdutoSelect = document.getElementById("novoProdutoSelect");
    if (novoServicoSelect) novoServicoSelect.value = "";
    if (novoProdutoSelect) novoProdutoSelect.value = "";
    renderizarListaItensEdicao();
    recalcularTotalComDesconto();
}

function recalcularTotalComDesconto() {
    if (!comandaEditando) return;
    let subtotal = 0, baseDesconto = 0;
    (comandaEditando.servicos || []).forEach(s => { const v = (s.preco || 0) * (s.quantidade || 1); subtotal += v; baseDesconto += v; });
    (comandaEditando.pacotes || []).forEach(p => { const v = p.preco || 0; subtotal += v; baseDesconto += v; });
    (comandaEditando.produtos || []).forEach(p => { 
        const v = (p.preco || 0) * (p.quantidade || 1); 
        subtotal += v; 
        let aplica = true; 
        if (descontoAplicado.produtosIds?.length) aplica = descontoAplicado.produtosIds.includes(p.produtoId); 
        if (aplica && !p.isPreLancamento) baseDesconto += v; 
    });
    let valorDesconto = 0, total = subtotal;
    if (descontoAplicado.valor > 0 && baseDesconto > 0) {
        if (descontoAplicado.tipo === "percentual") valorDesconto = (baseDesconto * descontoAplicado.valor) / 100;
        else valorDesconto = Math.min(descontoAplicado.valor, baseDesconto);
        total = subtotal - valorDesconto;
    }
    comandaEditando.subtotal = subtotal;
    comandaEditando.desconto = { valor: descontoAplicado.valor, tipo: descontoAplicado.tipo, valorCalculado: valorDesconto, programaId: descontoAplicado.programaId, nomePrograma: descontoAplicado.nomePrograma, produtosIds: descontoAplicado.produtosIds };
    comandaEditando.total = total;
    const editarTotal = document.getElementById("editarTotal");
    if (editarTotal) editarTotal.innerHTML = descontoAplicado.valor > 0 ? `<span class="total-original">${formatarMoeda(subtotal)}</span> ${formatarMoeda(total)}` : formatarMoeda(total);
    const descontoRow = document.getElementById("editarDescontoRow");
    const descontoValor = document.getElementById("editarDescontoValor");
    if (descontoRow) descontoRow.style.display = descontoAplicado.valor > 0 ? "flex" : "none";
    if (descontoValor) descontoValor.textContent = `- ${formatarMoeda(valorDesconto)}`;
}

window.recalcularTotalComDesconto = recalcularTotalComDesconto;

async function salvarEdicaoComanda() {
    if (!comandaEditando) return;
    const produtosIndisponiveis = [];
    for (const p of (comandaEditando.produtos || [])) {
        if (!p.isPreLancamento) {
            const produtoOriginal = produtos.find(pr => pr.id === p.produtoId);
            if (produtoOriginal && (produtoOriginal.quantidade || 0) < (p.quantidade || 1)) {
                produtosIndisponiveis.push(`${p.nome} (solicitado: ${p.quantidade}, disponível: ${produtoOriginal.quantidade || 0})`);
            }
        }
    }
    if (produtosIndisponiveis.length > 0) {
        mostrarToast(`⚠️ Não é possível salvar. Produtos com estoque insuficiente:\n${produtosIndisponiveis.join('\n')}`, "erro");
        return;
    }
    const editarObservacoes = document.getElementById("editarObservacoes");
    const barbeiroNome = profissionais.find(p => p.id === comandaEditando.barbeiroId)?.nome || comandaEditando.barbeiroNome || "Barbeiro";
    await updateDoc(doc(db, "comandas", comandaEditando.id), {
        servicos: comandaEditando.servicos, pacotes: comandaEditando.pacotes, produtos: comandaEditando.produtos,
        barbeiroNome: barbeiroNome, clienteNome: clientes.find(c => c.id === comandaEditando.clienteId)?.nome || comandaEditando.clienteNome,
        clienteTelefone: clientes.find(c => c.id === comandaEditando.clienteId)?.telefone || comandaEditando.clienteTelefone || "",
        subtotal: comandaEditando.subtotal, desconto: comandaEditando.desconto, total: comandaEditando.total,
        observacoes: editarObservacoes?.value || "", updatedAt: Timestamp.now()
    });
    dispararAtualizacaoPagamento(comandaEditando.id);
    mostrarToast("Comanda atualizada com sucesso!");
    fecharModalEditar();
}

// ==================== FUNÇÕES DE DESCONTO ====================

function toggleDescontoForm() { const f = document.getElementById("descontoForm"); if (f) f.style.display = f.style.display === "none" ? "block" : "none"; }
function aplicarDescontoManual() {
    const valor = parseFloat(document.getElementById("descontoValor")?.value);
    const tipo = document.querySelector(".desconto-tipo-btn.active")?.dataset.tipo;
    if (isNaN(valor) || valor <= 0) return mostrarToast("Valor inválido", "erro");
    descontoAplicado = { valor, tipo, programaId: null, nomePrograma: null, produtosIds: [] };
    recalcularTotalComDesconto();
    atualizarInterfaceDesconto();
    const descontoForm = document.getElementById("descontoForm");
    const descontoValorInput = document.getElementById("descontoValor");
    if (descontoForm) descontoForm.style.display = "none";
    if (descontoValorInput) descontoValorInput.value = "";
}
function removerDesconto() { descontoAplicado = { valor: 0, tipo: "percentual", programaId: null, nomePrograma: null, produtosIds: [] }; recalcularTotalComDesconto(); atualizarInterfaceDesconto(); mostrarToast("Desconto removido!"); }
function atualizarInterfaceDesconto() {
    const f = document.getElementById("descontoForm"), i = document.getElementById("descontoInfo"), t = document.getElementById("descontoTexto");
    if (descontoAplicado.valor > 0) { if (f) f.style.display = "none"; if (i) i.style.display = "block"; if (t) t.textContent = descontoAplicado.tipo === "percentual" ? `${descontoAplicado.valor}% de desconto${descontoAplicado.nomePrograma ? ` (${descontoAplicado.nomePrograma})` : ''}` : `R$ ${descontoAplicado.valor.toFixed(2)} de desconto`; }
    else { if (f) f.style.display = "none"; if (i) i.style.display = "none"; }
}

// ==================== FUNÇÕES DE PROGRAMA DE DESCONTO ====================

async function carregarProgramasDesconto() {
    try {
        const programasSnapshot = await getDocs(collection(db, "programas_desconto"));
        const programas = [];
        const hoje = new Date();
        for (const doc of programasSnapshot.docs) {
            const p = { id: doc.id, ...doc.data() };
            let ativo = true;
            if (p.dataInicio && new Date(p.dataInicio) > hoje) ativo = false;
            if (p.dataFim && new Date(p.dataFim) < hoje) ativo = false;
            if (p.horarioInicio && p.horarioFim && ativo) {
                const agora = new Date();
                const horaAtual = agora.getHours() + agora.getMinutes() / 60;
                const horaInicio = parseFloat(p.horarioInicio.replace(':', '.'));
                const horaFim = parseFloat(p.horarioFim.replace(':', '.'));
                if (horaAtual < horaInicio || horaAtual > horaFim) ativo = false;
            }
            p.ativo = ativo;
            programas.push(p);
        }
        return programas;
    } catch (error) {
        console.error("Erro ao carregar programas de desconto:", error);
        return [];
    }
}

async function carregarProgramasAtivos() {
    const programas = await carregarProgramasDesconto();
    return programas.filter(p => p.ativo === true);
}

function renderizarProgramasDesconto(programas) {
    const grid = document.getElementById("programasDescontoGrid");
    if (!grid) return;
    if (!programas || programas.length === 0) {
        grid.innerHTML = `<div class="empty-comandas" style="grid-column: 1 / -1;"><i class="fa-solid fa-ticket"></i><p>Nenhum programa de desconto ativo no momento</p><small>Crie um novo programa de desconto abaixo</small></div>`;
        return;
    }
    grid.innerHTML = programas.map(p => `
        <div class="programa-card" style="background: var(--bg-dark); border-radius: 16px; padding: 16px; border: 1px solid var(--border-color); transition: all 0.3s ease;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <h4 style="color: #f59e0b; margin: 0; font-size: 1rem; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-ticket"></i> ${escapeHtml(p.nome)}</h4>
                <div style="background: ${p.ativo ? '#10b98120' : '#ef444420'}; padding: 4px 8px; border-radius: 12px;"><span style="font-size: 0.65rem; color: ${p.ativo ? '#10b981' : '#ef4444'};">${p.ativo ? 'ATIVO' : 'INATIVO'}</span></div>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 12px;">${escapeHtml(p.descricao || "Sem descrição")}</p>
            <div style="background: rgba(245, 158, 11, 0.1); border-radius: 12px; padding: 12px; margin-bottom: 12px;"><div style="font-size: 1.2rem; font-weight: 700; color: #f59e0b; text-align: center;">${p.tipo === "percentual" ? `${p.valor}% OFF` : `${formatarMoeda(p.valor)} OFF`}</div></div>
            ${p.dataInicio || p.dataFim ? `<div style="font-size: 0.65rem; color: var(--text-muted); margin-bottom: 8px;"><i class="fa-regular fa-calendar"></i> ${p.dataInicio ? `Início: ${new Date(p.dataInicio).toLocaleDateString('pt-BR')}` : ''}${p.dataInicio && p.dataFim ? ' | ' : ''}${p.dataFim ? `Fim: ${new Date(p.dataFim).toLocaleDateString('pt-BR')}` : ''}</div>` : ''}
            ${p.horarioInicio && p.horarioFim ? `<div style="font-size: 0.65rem; color: var(--text-muted); margin-bottom: 12px;"><i class="fa-regular fa-clock"></i> ${p.horarioInicio} - ${p.horarioFim}</div>` : ''}
            <div style="font-size: 0.65rem; color: var(--text-muted); margin-bottom: 12px; padding: 6px; background: rgba(0,0,0,0.2); border-radius: 8px;"><i class="fa-solid fa-box"></i> ${p.todosProdutos ? 'Aplica-se a todos os produtos' : (p.produtosIds && p.produtosIds.length > 0 ? `${p.produtosIds.length} produto(s) selecionado(s)` : 'Nenhum produto específico')}</div>
            <button class="btn-aplicar-programa" data-id="${p.id}" data-valor="${p.valor}" data-tipo="${p.tipo}" data-nome="${escapeHtml(p.nome)}" data-produtos='${JSON.stringify(p.produtosIds || [])}' style="width: 100%; padding: 10px; background: linear-gradient(135deg, #f59e0b, #d97706); border: none; border-radius: 10px; color: white; cursor: pointer; font-weight: 600; font-size: 0.75rem; transition: all 0.2s;"><i class="fa-solid fa-wand-magic"></i> Aplicar Desconto</button>
        </div>
    `).join('');
    document.querySelectorAll('.btn-aplicar-programa').forEach(btn => {
        btn.onclick = () => {
            const id = btn.dataset.id;
            const valor = parseFloat(btn.dataset.valor);
            const tipo = btn.dataset.tipo;
            const nome = btn.dataset.nome;
            const produtosIds = JSON.parse(btn.dataset.produtos || '[]');
            aplicarDescontoPrograma(id, valor, tipo, nome, produtosIds);
        };
    });
}

function aplicarDescontoPrograma(id, valor, tipo, nome, produtosIds) {
    if (!comandaEditando) {
        mostrarToast("Abra uma comanda para edição antes de aplicar o desconto", "erro");
        fecharModalProgramas();
        return;
    }
    descontoAplicado = { valor, tipo, programaId: id, nomePrograma: nome, produtosIds: produtosIds || [] };
    recalcularTotalComDesconto();
    atualizarInterfaceDesconto();
    fecharModalProgramas();
    mostrarToast(`Desconto "${nome}" aplicado com sucesso!`, "sucesso");
}

async function salvarProgramaDesconto() {
    const nome = document.getElementById("novoProgramaNome")?.value;
    const valor = parseFloat(document.getElementById("novoProgramaDesconto")?.value);
    const tipo = document.getElementById("novoProgramaTipo")?.value;
    const descricao = document.getElementById("novoProgramaDescricao")?.value || "";
    const dataInicio = document.getElementById("novoProgramaDataInicio")?.value;
    const dataFim = document.getElementById("novoProgramaDataFim")?.value;
    const horarioOpcao = document.getElementById("novoProgramaHorario")?.value;
    if (!nome || !valor || valor <= 0) {
        mostrarToast("Preencha nome e valor do desconto", "erro");
        return;
    }
    let horarioInicio = null, horarioFim = null;
    if (horarioOpcao === "manha") { horarioInicio = "08:00"; horarioFim = "12:00"; }
    else if (horarioOpcao === "tarde") { horarioInicio = "13:00"; horarioFim = "18:00"; }
    else if (horarioOpcao === "noite") { horarioInicio = "18:00"; horarioFim = "22:00"; }
    else if (horarioOpcao === "personalizado") { horarioInicio = document.getElementById("novoProgramaHoraInicio")?.value; horarioFim = document.getElementById("novoProgramaHoraFim")?.value; if (!horarioInicio || !horarioFim) { mostrarToast("Informe os horários personalizados", "erro"); return; } }
    const programaData = {
        nome, valor, tipo, descricao, dataInicio: dataInicio || null, dataFim: dataFim || null,
        horarioInicio, horarioFim, produtosIds: [], todosProdutos: true,
        createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    };
    try {
        await addDoc(collection(db, "programas_desconto"), programaData);
        mostrarToast("Programa de desconto criado com sucesso!");
        const inputs = ["novoProgramaNome", "novoProgramaDesconto", "novoProgramaDescricao", "novoProgramaDataInicio", "novoProgramaDataFim", "novoProgramaHoraInicio", "novoProgramaHoraFim"];
        inputs.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
        const tipoSelect = document.getElementById("novoProgramaTipo"); if (tipoSelect) tipoSelect.value = "percentual";
        const horarioSelect = document.getElementById("novoProgramaHorario"); if (horarioSelect) horarioSelect.value = "";
        const horarioPersonalizado = document.getElementById("horarioPersonalizado"); if (horarioPersonalizado) horarioPersonalizado.style.display = "none";
        const programasAtivos = await carregarProgramasAtivos();
        renderizarProgramasDesconto(programasAtivos);
    } catch (error) {
        console.error("Erro ao salvar programa:", error);
        mostrarToast("Erro ao salvar programa de desconto", "erro");
    }
}

function abrirModalProgramasDesconto() {
    const modal = document.getElementById("modalProgramasDesconto");
    if (!modal) { mostrarToast("Erro: Modal de programas não encontrado", "erro"); return; }
    modal.classList.add("active");
    const grid = document.getElementById("programasDescontoGrid");
    if (grid) grid.innerHTML = '<div class="loading-comandas" style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando programas...</div>';
    carregarProgramasAtivos().then(programas => renderizarProgramasDesconto(programas)).catch(err => { if (grid) grid.innerHTML = '<div class="empty-comandas" style="color:#ef4444;"><i class="fa-solid fa-exclamation-triangle"></i><p>Erro ao carregar programas</p></div>'; });
}

function configurarEventosDesconto() {
    const btnAplicarDescontoRapido = document.getElementById("btnAplicarDescontoRapido");
    const btnProgramasDesconto = document.getElementById("btnProgramasDesconto");
    const btnConfirmarDesconto = document.getElementById("btnConfirmarDesconto");
    const btnRemoverDesconto = document.getElementById("btnRemoverDesconto");
    const btnSalvarPrograma = document.getElementById("btnSalvarPrograma");
    const novoProgramaHorario = document.getElementById("novoProgramaHorario");
    if (btnProgramasDesconto) {
        const novoBtn = btnProgramasDesconto.cloneNode(true);
        btnProgramasDesconto.parentNode.replaceChild(novoBtn, btnProgramasDesconto);
        novoBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); abrirModalProgramasDesconto(); });
    }
    if (btnAplicarDescontoRapido) btnAplicarDescontoRapido.addEventListener("click", toggleDescontoForm);
    if (btnConfirmarDesconto) btnConfirmarDesconto.addEventListener("click", aplicarDescontoManual);
    if (btnRemoverDesconto) btnRemoverDesconto.addEventListener("click", removerDesconto);
    if (btnSalvarPrograma) btnSalvarPrograma.addEventListener("click", salvarProgramaDesconto);
    if (novoProgramaHorario) novoProgramaHorario.addEventListener("change", (e) => { const div = document.getElementById("horarioPersonalizado"); if (div) div.style.display = e.target.value === "personalizado" ? "block" : "none"; });
    document.querySelectorAll(".desconto-tipo-btn").forEach(btn => { btn.onclick = () => { document.querySelectorAll(".desconto-tipo-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active"); }; });
    document.querySelectorAll(".modal-close-comanda, .btn-cancel-comanda").forEach(btn => btn.addEventListener("click", fecharModalComanda));
    document.querySelectorAll(".modal-close-detalhes, .btn-cancel-detalhes").forEach(btn => btn.addEventListener("click", fecharModalDetalhes));
    document.querySelectorAll(".modal-close-editar, .btn-cancel-editar").forEach(btn => btn.addEventListener("click", fecharModalEditar));
    document.querySelectorAll(".modal-close-programas, .btn-cancel-programas").forEach(btn => btn.addEventListener("click", fecharModalProgramas));
    document.querySelectorAll(".modal-close-ausencia, .btn-cancel-ausencia").forEach(btn => { btn.addEventListener("click", fecharModalJustificarAusencia); });
    document.querySelectorAll(".modal-close-reativar, .btn-cancel-reativar").forEach(btn => { btn.addEventListener("click", fecharModalReativarComanda); });
    document.querySelectorAll(".modal-close-cancelamento, .btn-cancel-cancelamento").forEach(btn => { btn.addEventListener("click", fecharModalJustificarCancelamento); });
    document.querySelectorAll(".modal-close-reativar-cancelada, .btn-cancel-reativar-cancelada").forEach(btn => { btn.addEventListener("click", fecharModalReativarComandaCancelada); });
    const btnConfirmarAusencia = document.getElementById("btnConfirmarAusencia");
    if (btnConfirmarAusencia) btnConfirmarAusencia.addEventListener("click", marcarComoAusente);
    const btnConfirmarReativar = document.getElementById("btnConfirmarReativar");
    if (btnConfirmarReativar) btnConfirmarReativar.addEventListener("click", reativarComanda);
    const btnConfirmarCancelamento = document.getElementById("btnConfirmarCancelamento");
    if (btnConfirmarCancelamento) btnConfirmarCancelamento.addEventListener("click", marcarComoCancelado);
    const btnConfirmarReativarCancelada = document.getElementById("btnConfirmarReativarCancelada");
    if (btnConfirmarReativarCancelada) btnConfirmarReativarCancelada.addEventListener("click", reativarComandaCancelada);
    window.addEventListener("click", (e) => { 
        if (e.target === modalComanda) fecharModalComanda(); 
        if (e.target === modalDetalhes) fecharModalDetalhes(); 
        if (e.target === modalEditarComanda) fecharModalEditar(); 
        const modalProg = document.getElementById("modalProgramasDesconto"); 
        if (e.target === modalProg) fecharModalProgramas();
        const modalAusencia = document.getElementById("modalJustificarAusencia");
        if (e.target === modalAusencia) fecharModalJustificarAusencia();
        const modalReativar = document.getElementById("modalReativarComanda");
        if (e.target === modalReativar) fecharModalReativarComanda();
        const modalCancelamento = document.getElementById("modalJustificarCancelamento");
        if (e.target === modalCancelamento) fecharModalJustificarCancelamento();
        const modalReativarCancelada = document.getElementById("modalReativarComandaCancelada");
        if (e.target === modalReativarCancelada) fecharModalReativarComandaCancelada();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { fecharModalComanda(); fecharModalDetalhes(); fecharModalEditar(); fecharModalProgramas(); fecharModalJustificarAusencia(); fecharModalReativarComanda(); fecharModalJustificarCancelamento(); fecharModalReativarComandaCancelada(); } });
    const btnImprimirComanda = document.getElementById("btnImprimirComanda"); if (btnImprimirComanda) btnImprimirComanda.addEventListener("click", () => window.print());
}

function setupEventListeners() {
    const btnNovaComanda = document.getElementById("btnNovaComanda");
    if (btnNovaComanda) btnNovaComanda.addEventListener("click", abrirNovaComanda);
    if (btnSalvarComanda) btnSalvarComanda.addEventListener("click", () => salvarComanda(false));
    if (btnFinalizarComanda) btnFinalizarComanda.addEventListener("click", () => salvarComanda(true));
    if (btnAdicionarServico) btnAdicionarServico.addEventListener("click", () => adicionarServicoComanda());
    if (filterStatus) filterStatus.addEventListener("change", e => { currentFilter = e.target.value; console.log("📌 Filtro alterado para:", currentFilter); aplicarFiltros(); });
    if (filterBarbeiro) filterBarbeiro.addEventListener("change", e => { currentBarbeiroFilter = e.target.value; aplicarFiltros(); });
    if (searchInput) searchInput.addEventListener("input", e => { currentSearch = e.target.value; aplicarFiltros(); });
    if (filterPeriodo) {
        filterPeriodo.addEventListener("change", e => { currentPeriodo = e.target.value; if (periodoPersonalizadoDiv) periodoPersonalizadoDiv.style.display = currentPeriodo === "personalizado" ? "flex" : "none"; aplicarFiltros(); atualizarMetricas(); });
    }
    if (dataInicioPersonalizadaInput) dataInicioPersonalizadaInput.addEventListener("change", e => { dataInicioPersonalizada = e.target.value; if (currentPeriodo === "personalizado") aplicarFiltros(); });
    if (dataFimPersonalizadaInput) dataFimPersonalizadaInput.addEventListener("change", e => { dataFimPersonalizada = e.target.value; if (currentPeriodo === "personalizado") aplicarFiltros(); });
    if (btnLimparFiltros) {
        btnLimparFiltros.addEventListener("click", () => { if(filterStatus) filterStatus.value = "aberta"; if(filterBarbeiro) filterBarbeiro.value = ""; if(searchInput) searchInput.value = ""; if(filterPeriodo) filterPeriodo.value = "hoje"; if(periodoPersonalizadoDiv) periodoPersonalizadoDiv.style.display = "none"; currentFilter = "aberta"; currentBarbeiroFilter = ""; currentSearch = ""; currentPeriodo = "hoje"; aplicarFiltros(); atualizarMetricas(); });
    }
    const btnAdicionarItemComanda = document.getElementById("btnAdicionarItemComanda");
    const btnSalvarEdicaoComanda = document.getElementById("btnSalvarEdicaoComanda");
    const tipoItemSelect = document.getElementById("tipoItemSelect");
    if (btnAdicionarItemComanda) btnAdicionarItemComanda.addEventListener("click", adicionarItemNaComanda);
    if (btnSalvarEdicaoComanda) btnSalvarEdicaoComanda.addEventListener("click", salvarEdicaoComanda);
    if (tipoItemSelect) { tipoItemSelect.addEventListener("change", e => { const servicoSelectGroup = document.getElementById("servicoSelectGroup"); const produtoSelectGroup = document.getElementById("produtoSelectGroup"); if (servicoSelectGroup) servicoSelectGroup.style.display = e.target.value === "servico" ? "block" : "none"; if (produtoSelectGroup) produtoSelectGroup.style.display = e.target.value === "produto" ? "block" : "none"; }); }
    configurarEventosDesconto();
}

// ==================== FUNÇÃO PARA MIGRAR PRÉ-LANÇAMENTOS EXISTENTES ====================

window.migrarPreLancamentosExistentes = async function() {
    console.log("🔄 Migrando pré-lançamentos existentes para coleção lembretes_comanda...");
    mostrarToast("Iniciando migração de pré-lançamentos...", "sucesso");
    
    const comandasSnapshot = await getDocs(collection(db, "comandas"));
    let countMigrados = 0;
    let countIgnorados = 0;
    
    for (const comandaDoc of comandasSnapshot.docs) {
        const comanda = comandaDoc.data();
        const produtosPreLancamento = (comanda.produtos || []).filter(p => p.isPreLancamento === true);
        
        if (produtosPreLancamento.length === 0) continue;
        
        console.log(`📦 Comanda ${comandaDoc.id} tem ${produtosPreLancamento.length} pré-lançamentos`);
        
        for (const item of produtosPreLancamento) {
            const lembreteExistente = await getDocs(query(
                collection(db, "lembretes_comanda"),
                where("comandaOrigemId", "==", comandaDoc.id),
                where("produtoId", "==", item.produtoId),
                where("status", "==", "pendente")
            ));
            
            if (lembreteExistente.empty && comanda.clienteId) {
                await addDoc(collection(db, "lembretes_comanda"), {
                    comandaOrigemId: comandaDoc.id,
                    clienteId: comanda.clienteId,
                    produtoId: item.produtoId,
                    produtoNome: item.nome,
                    preco: item.preco,
                    quantidade: item.quantidade || 1,
                    observacao: item.observacaoPreLancamento || "",
                    status: "pendente",
                    dataCriacao: Timestamp.now()
                });
                countMigrados++;
                console.log(`✅ Migrado: ${item.nome} para o cliente ${comanda.clienteId}`);
            } else {
                countIgnorados++;
                console.log(`⏭️ Ignorado: ${item.nome} (já existe ou sem clienteId)`);
            }
        }
    }
    
    console.log(`✅ Migração concluída! ${countMigrados} pré-lançamentos migrados, ${countIgnorados} ignorados.`);
    mostrarToast(`Migração concluída! ${countMigrados} pré-lançamentos migrados.`, "sucesso");
    return { migrados: countMigrados, ignorados: countIgnorados };
};

// ==================== INICIALIZAÇÃO ====================

onAuthStateChanged(auth, user => { 
    if (!user) window.location.href = "login.html"; 
    else { 
        console.log("✅ Usuário autenticado:", user.email);
        setupEventListeners(); 
        carregarDados(); 
    } 
});

const logoutBtn = document.getElementById("logout");
if (logoutBtn) logoutBtn.addEventListener("click", async () => { await signOut(auth); window.location.href = "login.html"; });

window.diagnosticarComandas = function() {
    console.log("🔍 DIAGNÓSTICO DE COMANDAS");
    console.log("=================================");
    console.log(`📊 Total de comandas: ${comandas.length}`);
    console.log(`📊 Comandas por status:`);
    console.log(`   - Abertas: ${comandas.filter(c => c.status === "aberta").length}`);
    console.log(`   - Finalizadas: ${comandas.filter(c => c.status === "finalizada").length}`);
    console.log(`   - Ausentes: ${comandas.filter(c => c.status === "ausente").length}`);
    console.log(`   - Canceladas: ${comandas.filter(c => c.status === "cancelado").length}`);
    console.log(`📌 Filtro atual: ${currentFilter}`);
    console.log("=================================");
    return {
        total: comandas.length,
        abertas: comandas.filter(c => c.status === "aberta").length,
        finalizadas: comandas.filter(c => c.status === "finalizada").length,
        ausentes: comandas.filter(c => c.status === "ausente").length,
        canceladas: comandas.filter(c => c.status === "cancelado").length,
        filtroAtual: currentFilter
    };
};

window.forcarRecarregamento = function() {
    console.log("🔄 Forçando recarregamento dos dados...");
    if (unsubscribeComandas) unsubscribeComandas();
    iniciarListenerComandas();
    mostrarToast("Recarregando dados...", "sucesso");
};

window.sincronizarComandasAntigas = async function() {
    console.log("🔄 Sincronizando comandas antigas com o módulo financeiro...");
    mostrarToast("Sincronizando comandas antigas...", "sucesso");
    const comandasSnapshot = await getDocs(query(collection(db, "comandas"), where("status", "==", "finalizada")));
    let count = 0;
    for (const docSnap of comandasSnapshot.docs) {
        const comanda = { id: docSnap.id, ...docSnap.data() };
        if (!comanda.pagamentoSincronizado) {
            await sincronizarPagamentoComFinanceiro(comanda.id, comanda);
            count++;
            console.log(`✅ Sincronizada comanda #${comanda.numeroComanda || comanda.id}`);
        }
    }
    console.log(`✅ Sincronização concluída! ${count} comandas processadas.`);
    mostrarToast(`Sincronização concluída! ${count} comandas processadas.`, "sucesso");
    return count;
};

console.log("comanda.js carregado com sucesso!");

// Exportar função de correção para uso no console
window.corrigirNumerosComandas = corrigirNumerosComandasAutomatico;