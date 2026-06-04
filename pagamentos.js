// pagamentos.js - Versão DEFINITIVA (APENAS comandas, sem duplicação)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    onSnapshot, 
    query, 
    orderBy,
    doc,
    updateDoc,
    Timestamp
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

// Estado global - APENAS COMANDAS (fonte única)
let comandas = [];
let clientes = [];
let servicos = [];
let profissionais = [];
let produtos = [];
let pacotes = [];

let unsubscribeComandas = null;

// Elementos DOM
const pagamentosGrid = document.getElementById('pagamentosGrid');
const dataInicio = document.getElementById('dataInicio');
const dataFim = document.getElementById('dataFim');
const filterMetodo = document.getElementById('filterMetodo');
const filterStatus = document.getElementById('filterStatus');
const btnFiltrar = document.getElementById('btnFiltrar');
const btnLimparFiltros = document.getElementById('btnLimparFiltros');
const btnNovoPagamento = document.getElementById('btnNovoPagamento');
const modalPagamento = document.getElementById('modalPagamento');
const modalExcluir = document.getElementById('modalExcluir');
const formPagamento = document.getElementById('formPagamento');
const modalTitle = document.getElementById('modalTitle');
const pagamentoId = document.getElementById('pagamentoId');
const pagamentoCliente = document.getElementById('pagamentoCliente');
const pagamentoServico = document.getElementById('pagamentoServico');
const pagamentoProfissional = document.getElementById('pagamentoProfissional');
const btnConfirmarExcluir = document.getElementById('confirmarExcluir');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

let filtrosAtivos = {
    dataInicio: null,
    dataFim: null,
    metodo: null,
    status: null
};

let pagamentoParaExcluir = null;

// ==================== FUNÇÕES UTILITÁRIAS ====================

function mostrarToast(mensagem, tipo = 'sucesso') {
    if (!toastMsg) return;
    toastMsg.textContent = mensagem;
    toast.style.background = tipo === 'sucesso' 
        ? 'linear-gradient(135deg, #2199EF, #1a7fcc)'
        : 'linear-gradient(135deg, #ef4444, #dc2626)';
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function formatarData(data) {
    if (!data) return '-';
    if (data.toDate) data = data.toDate();
    if (data.seconds) data = new Date(data.seconds * 1000);
    if (typeof data === 'string') data = new Date(data);
    if (isNaN(data.getTime())) return data;
    return data.toLocaleDateString('pt-BR');
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

function getStatusNome(status) {
    const nomes = {
        'pago': 'Pago',
        'pendente': 'Pendente',
        'cancelado': 'Cancelado'
    };
    return nomes[status] || status;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== CÁLCULO DE VALORES ====================

function calcularValorComanda(comanda) {
    let subtotal = 0;
    
    (comanda.servicos || []).forEach(s => {
        subtotal += (s.preco || 0) * (s.quantidade || 1);
    });
    
    (comanda.pacotes || []).forEach(p => {
        subtotal += (p.preco || 0);
    });
    
    (comanda.produtos || []).forEach(p => {
        if (!p.isPreLancamento) {
            subtotal += (p.preco || 0) * (p.quantidade || 1);
        }
    });
    
    let descontoValor = 0;
    if (comanda.desconto?.valor > 0) {
        if (comanda.desconto.tipo === "percentual") {
            descontoValor = (subtotal * comanda.desconto.valor) / 100;
        } else {
            descontoValor = comanda.desconto.valor;
        }
    }
    
    return Math.max(0, subtotal - descontoValor);
}

// ==================== CARREGAMENTO DE DADOS ====================

async function carregarDadosApoio() {
    console.log("🔄 Carregando dados de apoio...");
    
    try {
        const clientesSnap = await new Promise((resolve) => {
            const unsubscribe = onSnapshot(collection(db, "clientes"), (snapshot) => {
                clientes = [];
                snapshot.forEach(doc => {
                    clientes.push({ id: doc.id, ...doc.data() });
                });
                unsubscribe();
                resolve();
            });
        });
        
        await new Promise((resolve) => {
            const unsubscribe = onSnapshot(collection(db, "servicos"), (snapshot) => {
                servicos = [];
                snapshot.forEach(doc => {
                    servicos.push({ id: doc.id, ...doc.data() });
                });
                unsubscribe();
                resolve();
            });
        });
        
        await new Promise((resolve) => {
            const unsubscribe = onSnapshot(collection(db, "profissionais"), (snapshot) => {
                profissionais = [];
                snapshot.forEach(doc => {
                    profissionais.push({ id: doc.id, ...doc.data() });
                });
                unsubscribe();
                resolve();
            });
        });
        
        await new Promise((resolve) => {
            const unsubscribe = onSnapshot(collection(db, "produtos"), (snapshot) => {
                produtos = [];
                snapshot.forEach(doc => {
                    produtos.push({ id: doc.id, ...doc.data() });
                });
                unsubscribe();
                resolve();
            });
        });
        
        await new Promise((resolve) => {
            const unsubscribe = onSnapshot(collection(db, "pacotes"), (snapshot) => {
                pacotes = [];
                snapshot.forEach(doc => {
                    pacotes.push({ id: doc.id, ...doc.data() });
                });
                unsubscribe();
                resolve();
            });
        });
        
        popularSelects();
        
    } catch (error) {
        console.error("Erro ao carregar dados de apoio:", error);
    }
}

function popularSelects() {
    if (pagamentoCliente) {
        pagamentoCliente.innerHTML = '<option value="">Selecione um cliente</option>';
        clientes.forEach(cliente => {
            pagamentoCliente.innerHTML += `<option value="${cliente.id}">${escapeHtml(cliente.nome)}</option>`;
        });
    }
    
    if (pagamentoServico) {
        pagamentoServico.innerHTML = '<option value="">Selecione um serviço</option>';
        servicos.forEach(servico => {
            pagamentoServico.innerHTML += `<option value="${servico.id}" data-preco="${servico.preco}">${escapeHtml(servico.nome)} - ${formatarMoeda(servico.preco)}</option>`;
        });
    }
    
    if (pagamentoProfissional) {
        pagamentoProfissional.innerHTML = '<option value="">Selecione um profissional</option>';
        profissionais.forEach(prof => {
            pagamentoProfissional.innerHTML += `<option value="${prof.id}">${escapeHtml(prof.nome)}</option>`;
        });
    }
}

// ==================== LISTENER ÚNICO DE COMANDAS ====================

function carregarComandas() {
    console.log("🔄 Iniciando listener de comandas (fonte única)...");
    
    const comandasRef = collection(db, "comandas");
    const q = query(comandasRef, orderBy("dataCriacao", "desc"));
    
    if (unsubscribeComandas) unsubscribeComandas();
    
    unsubscribeComandas = onSnapshot(q, (snapshot) => {
        console.log(`📊 Snapshot recebido: ${snapshot.size} comandas`);
        
        const novasComandas = [];
        const idsVistos = new Set();
        
        snapshot.forEach(doc => {
            if (idsVistos.has(doc.id)) return;
            idsVistos.add(doc.id);
            
            const comanda = doc.data();
            const valor = calcularValorComanda(comanda);
            
            let pagamentoStatus = "pendente";
            let metodo = comanda.formaPagamento || "pendente";
            
            if (comanda.status === "finalizada") {
                pagamentoStatus = "pago";
                metodo = comanda.formaPagamento || "dinheiro";
            } else if (comanda.status === "cancelado") {
                pagamentoStatus = "cancelado";
            } else if (comanda.status === "ausente") {
                pagamentoStatus = "pendente";
            }
            
            let dataExibicao = comanda.dataCriacao;
            if (comanda.status === "finalizada" && comanda.dataFinalizacao) {
                dataExibicao = comanda.dataFinalizacao;
            }
            
            const dataStr = dataExibicao?.toDate ? 
                dataExibicao.toDate().toISOString().split('T')[0] : 
                new Date().toISOString().split('T')[0];
            
            let clienteNome = comanda.clienteNome;
            if (comanda.clienteId) {
                const cliente = clientes.find(c => c.id === comanda.clienteId);
                if (cliente) clienteNome = cliente.nome;
            }
            
            let profissionalNome = comanda.barbeiroNome;
            if (comanda.barbeiroId) {
                const profissional = profissionais.find(p => p.id === comanda.barbeiroId);
                if (profissional) profissionalNome = profissional.nome;
            }
            
            const parcelasTexto = comanda.parcelas && comanda.parcelas > 1 ? ` (${comanda.parcelas}x)` : '';
            const metodoNome = getMetodoNome(metodo);
            const metodoIcon = getMetodoIcon(metodo);
            
            // Buscar nomes dos serviços se necessário
            const servicosCompletos = (comanda.servicos || []).map(s => {
                if (!s.nome && s.servicoId) {
                    const servicoEncontrado = servicos.find(sv => sv.id === s.servicoId);
                    if (servicoEncontrado) {
                        return {
                            ...s,
                            nome: servicoEncontrado.nome,
                            preco: s.preco || servicoEncontrado.preco
                        };
                    }
                }
                return s;
            });
            
            // Buscar nomes dos produtos se necessário
            const produtosCompletos = (comanda.produtos || []).map(p => {
                if (!p.nome && p.produtoId) {
                    const produtoEncontrado = produtos.find(pr => pr.id === p.produtoId);
                    if (produtoEncontrado) {
                        return {
                            ...p,
                            nome: produtoEncontrado.nome,
                            preco: p.preco || produtoEncontrado.preco
                        };
                    }
                }
                return p;
            });
            
            novasComandas.push({
                id: doc.id,
                comandaId: doc.id,
                clienteId: comanda.clienteId,
                clienteNome: clienteNome || "Cliente",
                profissionalId: comanda.barbeiroId,
                profissionalNome: profissionalNome || "Não informado",
                valor: valor,
                metodo: metodo,
                metodoNome: `${metodoIcon} ${metodoNome}${parcelasTexto}`,
                data: dataStr,
                status: pagamentoStatus,
                statusComanda: comanda.status,
                observacao: comanda.observacoes || `Comanda #${comanda.numeroComanda || doc.id.slice(-6)}`,
                numeroComanda: comanda.numeroComanda,
                servicos: servicosCompletos,
                produtos: produtosCompletos,
                pacotes: comanda.pacotes || [],
                parcelas: comanda.parcelas || 1
            });
        });
        
        comandas = novasComandas;
        
        console.log(`✅ Comandas processadas: ${comandas.length}`);
        console.log(`   - Finalizadas (Pago): ${comandas.filter(c => c.status === "pago").length}`);
        console.log(`   - Abertas (Pendente): ${comandas.filter(c => c.status === "pendente" && c.statusComanda === "aberta").length}`);
        console.log(`   - Ausentes: ${comandas.filter(c => c.statusComanda === "ausente").length}`);
        
        renderizarPagamentos();
        atualizarEstatisticas();
        
    }, (error) => {
        console.error("❌ Erro no listener de comandas:", error);
        if (pagamentosGrid) {
            pagamentosGrid.innerHTML = `
                <div class="empty-pagamentos">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>Erro ao carregar dados: ${error.message}</p>
                    <button class="btn-primary" onclick="location.reload()">Tentar Novamente</button>
                </div>
            `;
        }
    });
}

// ==================== RENDERIZAÇÃO DE PAGAMENTOS ====================

function renderizarPagamentos() {
    if (!pagamentosGrid) return;
    
    let filtered = [...comandas];
    
    if (filtrosAtivos.dataInicio) {
        filtered = filtered.filter(p => p.data >= filtrosAtivos.dataInicio);
    }
    if (filtrosAtivos.dataFim) {
        filtered = filtered.filter(p => p.data <= filtrosAtivos.dataFim);
    }
    if (filtrosAtivos.metodo) {
        filtered = filtered.filter(p => p.metodo === filtrosAtivos.metodo);
    }
    if (filtrosAtivos.status) {
        filtered = filtered.filter(p => p.status === filtrosAtivos.status);
    }
    
    if (filtered.length === 0) {
        pagamentosGrid.innerHTML = `
            <div class="empty-pagamentos">
                <i class="fa-solid fa-credit-card"></i>
                <p>Nenhum pagamento encontrado</p>
                <button class="btn-primary" id="btnNovaComanda" onclick="window.location.href='comanda.html'">
                    <i class="fa-solid fa-plus"></i> Nova Comanda
                </button>
            </div>
        `;
        return;
    }
    
    pagamentosGrid.innerHTML = filtered.map(comanda => {
        const isAberta = comanda.statusComanda === "aberta";
        const isFinalizada = comanda.statusComanda === "finalizada";
        const isAusente = comanda.statusComanda === "ausente";
        
        let statusBadge = '';
        let statusColor = '';
        let statusBg = '';
        
        if (isFinalizada) {
            statusBadge = 'Pago';
            statusColor = '#10b981';
            statusBg = 'rgba(16, 185, 129, 0.2)';
        } else if (isAberta) {
            statusBadge = 'Pendente';
            statusColor = '#f59e0b';
            statusBg = 'rgba(245, 158, 11, 0.2)';
        } else if (isAusente) {
            statusBadge = 'Ausente';
            statusColor = '#ef4444';
            statusBg = 'rgba(239, 68, 68, 0.2)';
        } else {
            statusBadge = 'Cancelado';
            statusColor = '#6b7280';
            statusBg = 'rgba(107, 114, 128, 0.2)';
        }
        
        const numeroExibido = comanda.numeroComanda || comanda.id.slice(-6);
        const comandaBadge = `
            <span style="background: rgba(33, 153, 239, 0.15); padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 600;">
                <i class="fa-solid fa-receipt"></i> Comanda #${numeroExibido}
            </span>
        `;
        
        // ==================== CONSTRUIR LISTA COMPLETA DE ITENS ====================
        let itensHtml = '';
        
        // Adicionar SERVIÇOS
        if (comanda.servicos && comanda.servicos.length > 0) {
            itensHtml += '<div style="margin-top: 8px; margin-bottom: 8px;">';
            itensHtml += '<div style="font-size: 0.65rem; color: #2199EF; margin-bottom: 4px;"><i class="fa-solid fa-cut"></i> SERVIÇOS</div>';
            comanda.servicos.forEach(s => {
                const nome = s.nome || 'Serviço';
                const qtd = s.quantidade || 1;
                const preco = s.preco || 0;
                itensHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding: 4px 0;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 0.7rem;">✂️</span>
                            <span style="font-size: 0.7rem;">${escapeHtml(nome)}</span>
                            ${qtd > 1 ? `<span style="font-size: 0.6rem; color: #94a3b8;">x${qtd}</span>` : ''}
                        </div>
                        <span style="font-size: 0.7rem; color: #2199EF;">${formatarMoeda(preco * qtd)}</span>
                    </div>
                `;
            });
            itensHtml += '</div>';
        }
        
        // Adicionar PACOTES
        if (comanda.pacotes && comanda.pacotes.length > 0) {
            itensHtml += '<div style="margin-top: 8px; margin-bottom: 8px;">';
            itensHtml += '<div style="font-size: 0.65rem; color: #f59e0b; margin-bottom: 4px;"><i class="fa-solid fa-gift"></i> PACOTES</div>';
            comanda.pacotes.forEach(p => {
                const nome = p.nome || 'Pacote';
                const preco = p.preco || 0;
                itensHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding: 4px 0; background: rgba(245, 158, 11, 0.05); border-radius: 8px; padding: 4px 8px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 0.7rem;">🎁</span>
                            <span style="font-size: 0.7rem; color: #f59e0b;">${escapeHtml(nome)}</span>
                        </div>
                        <span style="font-size: 0.7rem; color: #f59e0b;">${formatarMoeda(preco)}</span>
                    </div>
                `;
            });
            itensHtml += '</div>';
        }
        
        // Adicionar PRODUTOS
        if (comanda.produtos && comanda.produtos.length > 0) {
            const produtosNormais = comanda.produtos.filter(p => !p.isPreLancamento);
            if (produtosNormais.length > 0) {
                itensHtml += '<div style="margin-top: 8px; margin-bottom: 8px;">';
                itensHtml += '<div style="font-size: 0.65rem; color: #10b981; margin-bottom: 4px;"><i class="fa-solid fa-box"></i> PRODUTOS</div>';
                produtosNormais.forEach(p => {
                    const nome = p.nome || 'Produto';
                    const qtd = p.quantidade || 1;
                    const preco = p.preco || 0;
                    itensHtml += `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding: 4px 0;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 0.7rem;">📦</span>
                                <span style="font-size: 0.7rem;">${escapeHtml(nome)}</span>
                                ${qtd > 1 ? `<span style="font-size: 0.6rem; color: #94a3b8;">x${qtd}</span>` : ''}
                            </div>
                            <span style="font-size: 0.7rem; color: #10b981;">${formatarMoeda(preco * qtd)}</span>
                        </div>
                    `;
                });
                itensHtml += '</div>';
            }
        }
        
        // Se não houver itens, mostrar mensagem
        if (!comanda.servicos?.length && !comanda.pacotes?.length && (!comanda.produtos?.length || comanda.produtos?.filter(p => !p.isPreLancamento).length === 0)) {
            itensHtml = '<div style="margin-top: 8px; text-align: center; padding: 12px; color: #94a3b8; font-size: 0.7rem;">Nenhum item adicionado</div>';
        }
        
        return `
            <div class="pagamento-card" data-id="${comanda.id}" data-comanda-id="${comanda.id}" style="background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-color); overflow: hidden; transition: all 0.3s ease; margin-bottom: 16px;">
                <div class="pagamento-header" style="padding: 14px 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 6px;">
                            <h3 style="font-size: 0.9rem; margin: 0; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-user"></i> ${escapeHtml(comanda.clienteNome)}
                            </h3>
                            ${comandaBadge}
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.7rem; color: var(--text-muted);">
                            <span><i class="fa-solid fa-user-md"></i> ${escapeHtml(comanda.profissionalNome)}</span>
                        </div>
                    </div>
                    <div class="pagamento-status" style="background: ${statusBg}; color: ${statusColor}; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 600;">
                        ${statusBadge}
                    </div>
                </div>
                <div class="pagamento-body" style="padding: 14px 16px;">
                    ${itensHtml}
                    <div class="pagamento-detalhe" style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-color);">
                        <span class="label" style="color: var(--text-muted); font-size: 0.7rem;"><i class="fa-regular fa-calendar"></i> Data</span>
                        <span class="value" style="font-size: 0.7rem;">${formatarData(comanda.data)}</span>
                    </div>
                    <div class="pagamento-detalhe" style="display: flex; justify-content: space-between; margin-top: 6px;">
                        <span class="label" style="color: var(--text-muted); font-size: 0.7rem;"><i class="fa-solid fa-credit-card"></i> Método</span>
                        <span class="value" style="font-size: 0.7rem;">${comanda.metodoNome}</span>
                    </div>
                    <div class="pagamento-valor" style="margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border-color); text-align: right;">
                        <span class="valor" style="font-size: 1.2rem; font-weight: 800; color: #2199EF;">${formatarMoeda(comanda.valor)}</span>
                    </div>
                    ${comanda.observacao ? `
                        <div class="pagamento-observacao" style="margin-top: 8px; padding: 8px; background: var(--bg-dark); border-radius: 8px; font-size: 0.7rem; color: var(--text-muted);">
                            <i class="fa-solid fa-comment"></i> ${escapeHtml(comanda.observacao)}
                        </div>
                    ` : ''}
                </div>
                <div class="pagamento-actions" style="display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border-color); background: rgba(0,0,0,0.2);">
                    <button class="btn-view-comanda" data-comanda-id="${comanda.id}" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #f59e0b, #d97706); border: none; border-radius: 8px; color: white; cursor: pointer; font-size: 0.7rem; font-weight: 600;">
                        <i class="fa-solid fa-receipt"></i> Acessar Comanda
                    </button>
                    ${!isFinalizada && comanda.statusComanda !== "cancelado" ? `
                        <button class="btn-finalizar-comanda" data-comanda-id="${comanda.id}" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #10b981, #059669); border: none; border-radius: 8px; color: white; cursor: pointer; font-size: 0.7rem; font-weight: 600;">
                            <i class="fa-solid fa-check-circle"></i> Finalizar
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.btn-view-comanda').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const comandaId = btn.getAttribute('data-comanda-id');
            if (comandaId) {
                window.open(`comanda.html?id=${comandaId}`, '_blank');
            }
        });
    });
    
    document.querySelectorAll('.btn-finalizar-comanda').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const comandaId = btn.getAttribute('data-comanda-id');
            if (comandaId && confirm('Deseja finalizar esta comanda?')) {
                window.open(`comanda.html?id=${comandaId}`, '_blank');
            }
        });
    });
}

function atualizarEstatisticas() {
    let totalRecebido = 0;
    let totalPendente = 0;
    
    comandas.forEach(c => {
        if (c.status === "pago") {
            totalRecebido += c.valor;
        } else if (c.status === "pendente") {
            totalPendente += c.valor;
        }
    });
    
    const totalRecebidoEl = document.getElementById('totalRecebido');
    const totalPendenteEl = document.getElementById('totalPendente');
    const totalTransacoesEl = document.getElementById('totalTransacoes');
    
    if (totalRecebidoEl) totalRecebidoEl.textContent = formatarMoeda(totalRecebido);
    if (totalPendenteEl) totalPendenteEl.textContent = formatarMoeda(totalPendente);
    if (totalTransacoesEl) totalTransacoesEl.textContent = comandas.length;
}

// ==================== PAGAMENTOS MANUAIS ====================

async function salvarPagamentoManual(dados) {
    try {
        const profissionalId = document.getElementById('pagamentoProfissional')?.value || null;
        
        const pagamentoData = {
            clienteId: dados.clienteId,
            servicoId: dados.servicoId,
            profissionalId: profissionalId,
            valor: Number(dados.valor),
            metodo: dados.metodo,
            data: dados.data,
            status: dados.status,
            observacao: dados.observacao || '',
            parcelas: dados.parcelas || 1,
            createdAt: Timestamp.now(),
            atualizadoEm: Timestamp.now(),
            isManual: true
        };
        
        await addDoc(collection(db, "pagamentos"), pagamentoData);
        mostrarToast("Pagamento manual registrado com sucesso!");
        fecharModalPagamento();
        
    } catch (error) {
        console.error("Erro ao salvar pagamento manual:", error);
        mostrarToast("Erro ao salvar pagamento.", "erro");
    }
}

function abrirModalPagamentoManual() {
    modalTitle.innerHTML = '<i class="fa-solid fa-plus"></i> Novo Pagamento Manual';
    pagamentoId.value = '';
    if (formPagamento) formPagamento.reset();
    
    const dataInput = document.getElementById('pagamentoData');
    if (dataInput) dataInput.value = new Date().toISOString().split('T')[0];
    
    const statusInput = document.getElementById('pagamentoStatus');
    if (statusInput) statusInput.value = 'pago';
    
    const metodoInput = document.getElementById('pagamentoMetodo');
    if (metodoInput) metodoInput.value = 'dinheiro';
    
    if (modalPagamento) modalPagamento.classList.add('active');
}

function fecharModalPagamento() {
    if (modalPagamento) modalPagamento.classList.remove('active');
}

// ==================== FILTROS ====================

function aplicarFiltros() {
    filtrosAtivos.dataInicio = dataInicio?.value || null;
    filtrosAtivos.dataFim = dataFim?.value || null;
    filtrosAtivos.metodo = filterMetodo?.value || null;
    filtrosAtivos.status = filterStatus?.value || null;
    renderizarPagamentos();
}

function limparFiltros() {
    if (dataInicio) dataInicio.value = '';
    if (dataFim) dataFim.value = '';
    if (filterMetodo) filterMetodo.value = '';
    if (filterStatus) filterStatus.value = '';
    filtrosAtivos = { dataInicio: null, dataFim: null, metodo: null, status: null };
    renderizarPagamentos();
}

// ==================== EVENTOS ====================

function setupEventListeners() {
    if (btnNovoPagamento) {
        const novoBtn = btnNovoPagamento.cloneNode(true);
        btnNovoPagamento.parentNode.replaceChild(novoBtn, btnNovoPagamento);
        novoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            abrirModalPagamentoManual();
        });
    }
    
    if (formPagamento) {
        formPagamento.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const clienteId = document.getElementById('pagamentoCliente')?.value;
            const servicoId = document.getElementById('pagamentoServico')?.value;
            const valor = document.getElementById('pagamentoValor')?.value;
            const metodo = document.getElementById('pagamentoMetodo')?.value;
            const parcelas = document.getElementById('pagamentoParcelas')?.value;
            
            if (!clienteId) {
                mostrarToast("Selecione um cliente.", "erro");
                return;
            }
            if (!servicoId) {
                mostrarToast("Selecione um serviço.", "erro");
                return;
            }
            if (!valor || valor <= 0) {
                mostrarToast("Informe um valor válido.", "erro");
                return;
            }
            if (!metodo) {
                mostrarToast("Selecione um método de pagamento.", "erro");
                return;
            }
            
            const dados = {
                clienteId: clienteId,
                servicoId: servicoId,
                valor: valor,
                metodo: metodo,
                data: document.getElementById('pagamentoData')?.value,
                status: document.getElementById('pagamentoStatus')?.value,
                observacao: document.getElementById('pagamentoObservacao')?.value,
                parcelas: metodo === 'cartao_credito' ? (parcelas || 1) : 1
            };
            
            salvarPagamentoManual(dados);
        });
    }
    
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', aplicarFiltros);
    }
    
    if (btnLimparFiltros) {
        btnLimparFiltros.addEventListener('click', limparFiltros);
    }
    
    document.querySelectorAll('.modal-close, .btn-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
            fecharModalPagamento();
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modalPagamento) fecharModalPagamento();
    });
    
    const metodoPagamentoSelect = document.getElementById('pagamentoMetodo');
    const parcelasGroup = document.getElementById('pagamentoParcelasGroup');
    if (metodoPagamentoSelect && parcelasGroup) {
        metodoPagamentoSelect.addEventListener('change', () => {
            parcelasGroup.style.display = metodoPagamentoSelect.value === 'cartao_credito' ? 'flex' : 'none';
        });
    }
    
    window.addEventListener('pagamentoAtualizado', (event) => {
        console.log("🔄 Pagamento atualizado recebido:", event.detail);
    });
}

// ==================== INICIALIZAÇÃO ====================

async function inicializar() {
    console.log("🚀 Inicializando sistema de pagamentos (fonte única: comandas)...");
    
    if (pagamentosGrid) {
        pagamentosGrid.innerHTML = `
            <div class="loading-pagamentos">
                <i class="fa-solid fa-spinner fa-spin"></i> Carregando pagamentos...
            </div>
        `;
    }
    
    await carregarDadosApoio();
    carregarComandas();
    setupEventListeners();
    
    console.log("✅ Sistema de pagamentos inicializado!");
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        inicializar();
    }
});

const logoutBtnElement = document.getElementById('logout');
if (logoutBtnElement) {
    logoutBtnElement.onclick = async () => {
        await signOut(auth);
        window.location.href = 'login.html';
    };
}

window.debugPagamentos = () => {
    console.log("=== DEBUG PAGAMENTOS ===");
    console.log("Comandas (fonte única):", comandas.length);
    console.log("Clientes:", clientes.length);
    console.log("Serviços:", servicos.length);
    console.log("Profissionais:", profissionais.length);
    console.log("Produtos:", produtos.length);
    console.log("Pacotes:", pacotes.length);
    console.log("Comandas por status:");
    console.log("  - Finalizadas (Pago):", comandas.filter(c => c.status === "pago").length);
    console.log("  - Abertas (Pendente):", comandas.filter(c => c.status === "pendente" && c.statusComanda === "aberta").length);
    console.log("  - Ausentes:", comandas.filter(c => c.statusComanda === "ausente").length);
    return comandas;
};