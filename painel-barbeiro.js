// painel-barbeiro.js - Versão Completa com Autenticação Integrada

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth,
    onAuthStateChanged,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

let barbeiroId = null;
let barbeiroData = null;
let currentPage = 'dashboard';
let authReady = false;

// Elementos DOM
let conteudoDiv = null;
let barbeiroNomeSpan = null;
let barbeiroFotoImg = null;
let toast = null;
let toastMsg = null;

// ==================== FUNÇÕES AUXILIARES ====================

function mostrarToast(mensagem, tipo = 'sucesso') {
    if (!toastMsg || !toast) return;
    toastMsg.textContent = mensagem;
    toast.style.background = tipo === 'sucesso'
        ? 'linear-gradient(135deg, #2199EF, #1a7fcc)'
        : 'linear-gradient(135deg, #ef4444, #dc2626)';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function formatarData(data) {
    if (!data) return '-';
    
    try {
        let ano, mes, dia;
        
        if (data && typeof data.toDate === 'function') {
            const dateObj = data.toDate();
            ano = dateObj.getFullYear();
            mes = String(dateObj.getMonth() + 1).padStart(2, '0');
            dia = String(dateObj.getDate()).padStart(2, '0');
        }
        else if (data && data.seconds) {
            const dateObj = new Date(data.seconds * 1000);
            ano = dateObj.getFullYear();
            mes = String(dateObj.getMonth() + 1).padStart(2, '0');
            dia = String(dateObj.getDate()).padStart(2, '0');
        }
        else if (typeof data === 'string') {
            if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return data.split('-').reverse().join('/');
            }
            const dateObj = new Date(data);
            ano = dateObj.getFullYear();
            mes = String(dateObj.getMonth() + 1).padStart(2, '0');
            dia = String(dateObj.getDate()).padStart(2, '0');
        }
        else if (data instanceof Date) {
            ano = data.getFullYear();
            mes = String(data.getMonth() + 1).padStart(2, '0');
            dia = String(data.getDate()).padStart(2, '0');
        }
        else {
            return '-';
        }
        
        if (!ano || !mes || !dia) return '-';
        
        return `${dia}/${mes}/${ano}`;
        
    } catch (error) {
        console.error("Erro ao formatar data:", error);
        return '-';
    }
}

function getDateString(data) {
    if (!data) return '';
    
    try {
        let ano, mes, dia;
        
        if (data && typeof data.toDate === 'function') {
            const dateObj = data.toDate();
            ano = dateObj.getFullYear();
            mes = String(dateObj.getMonth() + 1).padStart(2, '0');
            dia = String(dateObj.getDate()).padStart(2, '0');
        } else if (data && data.seconds) {
            const dateObj = new Date(data.seconds * 1000);
            ano = dateObj.getFullYear();
            mes = String(dateObj.getMonth() + 1).padStart(2, '0');
            dia = String(dateObj.getDate()).padStart(2, '0');
        } else if (typeof data === 'string') {
            if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return data;
            }
            const dateObj = new Date(data);
            ano = dateObj.getFullYear();
            mes = String(dateObj.getMonth() + 1).padStart(2, '0');
            dia = String(dateObj.getDate()).padStart(2, '0');
        } else if (data instanceof Date) {
            ano = data.getFullYear();
            mes = String(data.getMonth() + 1).padStart(2, '0');
            dia = String(data.getDate()).padStart(2, '0');
        } else {
            return '';
        }
        
        if (!ano || !mes || !dia) return '';
        
        return `${ano}-${mes}-${dia}`;
        
    } catch (error) {
        console.error("Erro ao obter string da data:", error);
        return '';
    }
}

function getDataAtualString() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusInfo(status) {
    const statusMap = {
        'confirmado': { text: 'Confirmado', class: 'status-confirmado', icon: 'fa-check-circle' },
        'confirmado_sem_pagamento': { text: 'Confirmado', class: 'status-confirmado', icon: 'fa-check-circle' },
        'aguardando_pagamento': { text: 'Aguardando Pagamento', class: 'status-pendente', icon: 'fa-clock' },
        'concluido': { text: 'Concluído', class: 'status-concluido', icon: 'fa-check-double' },
        'finalizado': { text: 'Finalizado', class: 'status-concluido', icon: 'fa-check-double' },
        'cancelado': { text: 'Cancelado', class: 'status-cancelado', icon: 'fa-ban' },
        'ausente': { text: 'Ausente', class: 'status-ausente', icon: 'fa-clock' }
    };
    return statusMap[status] || { text: status || 'Desconhecido', class: 'status-pendente', icon: 'fa-question-circle' };
}

function getEspecialidadeIcon(especialidade) {
    const icons = {
        'Geral': '✂️',
        'Corte': '✂️',
        'Barba': '🪒',
        'Coloracao': '🎨',
        'Completo': '💈'
    };
    return icons[especialidade] || '✂️';
}

// ==================== FUNÇÕES DE SESSÃO ====================

function verificarSessao() {
    const sessaoStr = sessionStorage.getItem('barbeiro_sessao');
    
    if (!sessaoStr) {
        console.log("❌ Nenhuma sessão encontrada");
        window.location.href = 'login-barbeiro.html';
        return false;
    }
    
    try {
        const sessao = JSON.parse(sessaoStr);
        const agora = Date.now();
        
        if (agora > sessao.expiraEm) {
            console.log("❌ Sessão expirada");
            sessionStorage.clear();
            window.location.href = 'login-barbeiro.html';
            return false;
        }
        
        barbeiroId = sessao.barbeiroId;
        barbeiroData = sessao.barbeiroData;
        
        if (barbeiroNomeSpan) {
            barbeiroNomeSpan.textContent = barbeiroData?.nome || 'Barbeiro';
        }
        
        carregarFotoBarbeiro();
        
        console.log("✅ Sessão válida - Barbeiro:", barbeiroData?.nome);
        console.log("✅ Barbeiro ID:", barbeiroId);
        return true;
        
    } catch (error) {
        console.error("❌ Erro ao verificar sessão:", error);
        sessionStorage.clear();
        window.location.href = 'login-barbeiro.html';
        return false;
    }
}

function carregarFotoBarbeiro() {
    if (!barbeiroFotoImg) return;
    
    const fotoSalva = sessionStorage.getItem('barbeiroFoto');
    
    if (fotoSalva && fotoSalva !== 'null' && fotoSalva !== 'undefined' && fotoSalva !== './assets/barber-icon.png') {
        barbeiroFotoImg.src = fotoSalva;
        console.log("✅ Foto carregada da sessão");
        return;
    }
    
    const fotoPadrao = barbeiroData?.fotoUrl || barbeiroData?.foto;
    
    if (fotoPadrao && fotoPadrao !== '' && fotoPadrao !== './assets/barber-icon.png') {
        barbeiroFotoImg.src = fotoPadrao;
        sessionStorage.setItem('barbeiroFoto', fotoPadrao);
    } else {
        const especialidade = barbeiroData?.especialidade || 'Geral';
        const iconesPorEspecialidade = {
            'Corte': '✂️',
            'Barba': '🪒',
            'Completo': '💈',
            'Coloracao': '🎨',
            'Geral': '💈'
        };
        const icone = iconesPorEspecialidade[especialidade] || '💈';
        
        const canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 80, 80);
        ctx.fillStyle = '#2199EF';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icone, 40, 40);
        
        barbeiroFotoImg.src = canvas.toDataURL();
        sessionStorage.setItem('barbeiroFoto', canvas.toDataURL());
    }
}

async function atualizarDadosFirestore() {
    if (!barbeiroId) return;
    
    try {
        const barbeiroRef = doc(db, "profissionais", barbeiroId);
        const barbeiroSnap = await getDoc(barbeiroRef);
        
        if (barbeiroSnap.exists()) {
            barbeiroData = barbeiroSnap.data();
            
            const sessaoStr = sessionStorage.getItem('barbeiro_sessao');
            if (sessaoStr) {
                const sessao = JSON.parse(sessaoStr);
                sessao.barbeiroData = barbeiroData;
                sessionStorage.setItem('barbeiro_sessao', JSON.stringify(sessao));
                sessionStorage.setItem('barbeiroNome', barbeiroData.nome);
                
                if (barbeiroData.fotoUrl || barbeiroData.foto) {
                    sessionStorage.setItem('barbeiroFoto', barbeiroData.fotoUrl || barbeiroData.foto);
                }
            }
            
            if (barbeiroNomeSpan) {
                barbeiroNomeSpan.textContent = barbeiroData.nome || 'Barbeiro';
            }
            
            carregarFotoBarbeiro();
        }
    } catch (error) {
        console.error("Erro ao atualizar dados:", error);
    }
}

// ==================== FUNÇÕES DE COMANDA ====================

async function buscarComandaPorAgendamentoId(agendamentoId) {
    if (!agendamentoId) return null;
    
    try {
        const comandasRef = collection(db, "comandas");
        const q = query(comandasRef, where("agendamentoId", "==", agendamentoId));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const comandaDoc = snapshot.docs[0];
            const comanda = { id: comandaDoc.id, ...comandaDoc.data() };
            console.log(`✅ Comanda encontrada para agendamento ${agendamentoId}`);
            return comanda;
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar comanda:", error);
        return null;
    }
}

async function extrairItensDaComanda(comanda, agendamento) {
    let itens = [];
    let valorTotal = 0;
    let ehPacote = false;
    let nomePacote = '';
    let descontoPercentual = 0;
    let precoOriginal = 0;
    
    if (comanda) {
        console.log("📋 Extraindo itens da COMANDA");
        
        if (comanda.servicos && comanda.servicos.length > 0) {
            comanda.servicos.forEach(s => {
                const nome = s.nome || "Serviço";
                const qtd = s.quantidade || 1;
                const exibicao = qtd > 1 ? `${qtd}x ${nome}` : nome;
                itens.push(exibicao);
                valorTotal += (s.preco || 0) * qtd;
            });
        }
        
        if (comanda.pacotes && comanda.pacotes.length > 0) {
            ehPacote = true;
            const pacote = comanda.pacotes[0];
            nomePacote = pacote.nome || "Pacote";
            precoOriginal = pacote.precoOriginal || pacote.preco || 0;
            valorTotal = pacote.preco || 0;
            descontoPercentual = pacote.descontoPercentual || 0;
            
            if (descontoPercentual === 0 && precoOriginal > valorTotal) {
                descontoPercentual = Math.round((1 - valorTotal / precoOriginal) * 100);
            }
            
            if (pacote.servicos && pacote.servicos.length > 0) {
                itens = pacote.servicos.map(s => s.nome);
            } else if (pacote.servicosNomes && Array.isArray(pacote.servicosNomes)) {
                itens = pacote.servicosNomes;
            }
        }
        
        if (comanda.produtos && comanda.produtos.length > 0) {
            comanda.produtos.forEach(p => {
                if (!p.isPreLancamento) {
                    const nome = p.nome || "Produto";
                    const qtd = p.quantidade || 1;
                    itens.push(`${qtd > 1 ? `${qtd}x ` : ''}${nome} (📦)`);
                    valorTotal += (p.preco || 0) * qtd;
                }
            });
        }
        
        if (comanda.desconto && comanda.desconto.valor > 0) {
            if (comanda.desconto.tipo === "percentual") {
                descontoPercentual = comanda.desconto.valor;
                const descontoValor = (valorTotal * descontoPercentual) / 100;
                valorTotal = valorTotal - descontoValor;
            } else {
                valorTotal = Math.max(0, valorTotal - comanda.desconto.valor);
            }
        }
        
        if (itens.length > 0) {
            return {
                itens: itens,
                valorTotal: valorTotal,
                ehPacote: ehPacote,
                nomePacote: nomePacote,
                descontoPercentual: descontoPercentual,
                precoOriginal: precoOriginal,
                temComanda: true
            };
        }
    }
    
    // Fallback para dados do agendamento
    console.log("📋 Usando dados do AGENDAMENTO como fallback");
    
    if (agendamento.pacoteInfo) {
        ehPacote = true;
        nomePacote = agendamento.pacoteInfo.nome || "Pacote";
        precoOriginal = agendamento.pacoteInfo.precoOriginal || agendamento.pacoteInfo.preco || 0;
        valorTotal = agendamento.pacoteInfo.preco || 0;
        descontoPercentual = agendamento.pacoteInfo.descontoPercentual || 0;
        
        if (agendamento.pacoteInfo.servicos && agendamento.pacoteInfo.servicos.length > 0) {
            itens = agendamento.pacoteInfo.servicos.map(s => s.nome);
        } else if (agendamento.pacoteInfo.servicosNomes && agendamento.pacoteInfo.servicosNomes.length > 0) {
            itens = agendamento.pacoteInfo.servicosNomes;
        }
    }
    
    if (!ehPacote && agendamento.servicos && Array.isArray(agendamento.servicos) && agendamento.servicos.length > 0) {
        itens = agendamento.servicos.map(s => s.nome || s);
        valorTotal = agendamento.servicos.reduce((sum, s) => sum + (s.preco || 0), 0);
    }
    
    if (!ehPacote && itens.length === 0 && agendamento.servicoNome) {
        itens = [agendamento.servicoNome];
        valorTotal = agendamento.valor || 0;
    }
    
    if (valorTotal === 0 && agendamento.valor) {
        valorTotal = agendamento.valor;
    }
    
    return {
        itens: itens,
        valorTotal: valorTotal,
        ehPacote: ehPacote,
        nomePacote: nomePacote,
        descontoPercentual: descontoPercentual,
        precoOriginal: precoOriginal,
        temComanda: false
    };
}

function formatarItensParaExibicao(itensInfo) {
    const { itens, ehPacote, nomePacote, descontoPercentual, precoOriginal, valorTotal, temComanda } = itensInfo;
    
    let precoHtml = formatarMoeda(valorTotal);
    let precoOriginalHtml = '';
    let descontoBadgeHtml = '';
    
    if (descontoPercentual > 0 && precoOriginal > valorTotal) {
        precoOriginalHtml = `<span style="text-decoration: line-through; font-size: 0.7rem; color: #94a3b8;">${formatarMoeda(precoOriginal)}</span> `;
        descontoBadgeHtml = `<span style="background: #10b98120; padding: 2px 6px; border-radius: 12px; font-size: 0.65rem; margin-left: 8px;">-${descontoPercentual}% OFF</span>`;
        precoHtml = `${precoOriginalHtml}${formatarMoeda(valorTotal)}${descontoBadgeHtml}`;
    }
    
    const comandaBadge = temComanda ? 
        `<span style="background: #2199EF20; color: #2199EF; font-size: 0.6rem; padding: 2px 8px; border-radius: 20px; margin-left: 8px;"><i class="fa-solid fa-receipt"></i> Comanda</span>` : '';
    
    if (ehPacote) {
        const itensLista = itens.map(i => `<span class="badge-pacote">${escapeHtml(i)}</span>`).join('');
        
        return {
            html: `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <i class="fa-solid fa-gift" style="color: #f59e0b;"></i>
                        <strong style="color: #f59e0b;">${escapeHtml(nomePacote)}</strong>
                        <span class="badge-pacote-label">PACOTE</span>
                        ${comandaBadge}
                    </div>
                    <div style="font-size: 0.7rem; color: #9ca3af;">
                        <i class="fa-solid fa-list"></i> Inclui: ${itensLista}
                    </div>
                </div>
            `,
            valor: valorTotal,
            precoExibicao: precoHtml
        };
    } else {
        const itensLista = itens.map(i => `<span class="badge-servico"><i class="fa-solid fa-cut"></i> ${escapeHtml(i)}</span>`).join('');
        
        return {
            html: `
                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px;">
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                        ${itensLista}
                    </div>
                    ${comandaBadge}
                </div>
            `,
            valor: valorTotal,
            precoExibicao: precoHtml
        };
    }
}

// ==================== RENDERIZAÇÃO DO DASHBOARD ====================

async function renderizarDashboard() {
    if (!conteudoDiv) return;
    
    conteudoDiv.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando dados...</div>';
    
    try {
        const dataAtualStr = getDataAtualString();
        
        const agendamentosRef = collection(db, "agendamentos");
        const q = query(agendamentosRef, where("profissionalId", "==", barbeiroId));
        const snapshot = await getDocs(q);
        
        let totalAgendamentos = 0;
        let totalConcluidos = 0;
        let totalConfirmados = 0;
        let totalAusentes = 0;
        let totalCancelados = 0;
        let faturamentoTotal = 0;
        let proximosAgendamentos = [];
        
        for (const docSnap of snapshot.docs) {
            const agendamento = docSnap.data();
            const agendamentoId = docSnap.id;
            const status = agendamento.status;
            totalAgendamentos++;
            
            const dataAgendamentoStr = getDateString(agendamento.data);
            const comanda = await buscarComandaPorAgendamentoId(agendamentoId);
            const itensInfo = await extrairItensDaComanda(comanda, agendamento);
            const valorAgendamento = itensInfo.valorTotal;
            
            if (status === 'concluido' || status === 'finalizado') {
                totalConcluidos++;
                faturamentoTotal += valorAgendamento;
            } else if (status === 'confirmado' || status === 'confirmado_sem_pagamento') {
                totalConfirmados++;
            } else if (status === 'ausente') {
                totalAusentes++;
            } else if (status === 'cancelado') {
                totalCancelados++;
            }
            
            if (dataAgendamentoStr && dataAgendamentoStr >= dataAtualStr && 
                status !== 'cancelado' && status !== 'concluido' && status !== 'finalizado' && status !== 'ausente') {
                proximosAgendamentos.push({ 
                    id: agendamentoId, 
                    ...agendamento, 
                    dataString: dataAgendamentoStr,
                    comanda: comanda,
                    itensInfo: itensInfo
                });
            }
        }
        
        proximosAgendamentos.sort((a, b) => {
            if (a.dataString !== b.dataString) {
                return a.dataString.localeCompare(b.dataString);
            }
            return (a.horario || '').localeCompare(b.horario || '');
        });
        
        const proximosHtml = [];
        for (const ag of proximosAgendamentos.slice(0, 6)) {
            const statusInfo = getStatusInfo(ag.status);
            const dataExibicao = formatarData(ag.data);
            const itensFormatados = formatarItensParaExibicao(ag.itensInfo);
            
            proximosHtml.push(`
                <div class="agenda-card">
                    <div class="agenda-horario"><i class="fa-regular fa-calendar"></i> ${dataExibicao} às ${ag.horario || '--:--'}</div>
                    <div class="agenda-cliente"><i class="fa-solid fa-user"></i> ${escapeHtml(ag.cliente || ag.nome || 'Cliente')}</div>
                    <div class="agenda-servico">${itensFormatados.html}</div>
                    <div class="agenda-valor" style="margin-top: 8px; font-weight: 600; color: #2199EF;">${itensFormatados.precoExibicao}</div>
                    <div class="agenda-status ${statusInfo.class}" style="margin-top: 8px;"><i class="fa-solid ${statusInfo.icon}"></i> ${statusInfo.text}</div>
                </div>
            `);
        }
        
        const html = `
            <style>
                .badge-servico {
                    display: inline-block;
                    background: rgba(33, 153, 239, 0.1);
                    padding: 4px 8px;
                    border-radius: 16px;
                    font-size: 0.7rem;
                    margin: 2px 4px 2px 0;
                }
                .badge-pacote {
                    display: inline-block;
                    background: rgba(245, 158, 11, 0.15);
                    padding: 2px 8px;
                    border-radius: 16px;
                    margin: 2px 4px 2px 0;
                    font-size: 0.7rem;
                }
                .badge-pacote-label {
                    background: #f59e0b20;
                    color: #f59e0b;
                    font-size: 0.6rem;
                    padding: 2px 8px;
                    border-radius: 20px;
                }
            </style>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-calendar-check"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${totalAgendamentos}</span>
                        <span class="stat-label">Total de Atendimentos</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-check-circle"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${totalConfirmados}</span>
                        <span class="stat-label">Confirmados</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-check-double"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${totalConcluidos}</span>
                        <span class="stat-label">Concluídos</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-coins"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${formatarMoeda(faturamentoTotal)}</span>
                        <span class="stat-label">Faturamento Total</span>
                    </div>
                </div>
            </div>
            
            <div class="agenda-header">
                <h3><i class="fa-solid fa-calendar-week"></i> Próximos Atendimentos</h3>
            </div>
            
            <div class="agenda-grid">
                ${proximosHtml.length === 0 ? '<div class="loading">Nenhum agendamento futuro encontrado</div>' : proximosHtml.join('')}
            </div>
        `;
        
        conteudoDiv.innerHTML = html;
        
    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        conteudoDiv.innerHTML = '<div class="loading">Erro ao carregar dados. Tente novamente.</div>';
    }
}

// ==================== RENDERIZAÇÃO DA AGENDA ====================

async function renderizarAgenda() {
    if (!conteudoDiv) return;
    
    let dataAtual = getDataAtualString();
    
    async function carregarAgenda(data) {
        conteudoDiv.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando agenda...</div>';
        
        try {
            const agendamentosRef = collection(db, "agendamentos");
            const qAll = query(agendamentosRef, where("profissionalId", "==", barbeiroId));
            const snapshotAll = await getDocs(qAll);
            
            const agendamentos = [];
            for (const docSnap of snapshotAll.docs) {
                const ag = docSnap.data();
                const dataAgendaStr = getDateString(ag.data);
                
                if (dataAgendaStr === data) {
                    const comanda = await buscarComandaPorAgendamentoId(docSnap.id);
                    const itensInfo = await extrairItensDaComanda(comanda, ag);
                    agendamentos.push({ id: docSnap.id, ...ag, comanda: comanda, itensInfo: itensInfo });
                }
            }
            
            agendamentos.sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));
            
            const dataExibicao = formatarData(data);
            const agendaCards = [];
            
            for (const ag of agendamentos) {
                const statusInfo = getStatusInfo(ag.status);
                const itensFormatados = formatarItensParaExibicao(ag.itensInfo);
                
                agendaCards.push(`
                    <div class="agenda-card">
                        <div class="agenda-horario"><i class="fa-regular fa-clock"></i> ${ag.horario || '--:--'}</div>
                        <div class="agenda-cliente"><i class="fa-solid fa-user"></i> ${escapeHtml(ag.cliente || ag.nome || 'Cliente')}</div>
                        <div class="agenda-servico">${itensFormatados.html}</div>
                        <div class="agenda-valor" style="margin-top: 8px; font-weight: 600; color: #2199EF;">${itensFormatados.precoExibicao}</div>
                        <div class="agenda-status ${statusInfo.class}" style="margin-top: 8px;"><i class="fa-solid ${statusInfo.icon}"></i> ${statusInfo.text}</div>
                    </div>
                `);
            }
            
            const agendaHtml = agendamentos.length === 0 ? 
                '<div class="loading">Nenhum agendamento para este dia</div>' :
                agendaCards.join('');
            
            const html = `
                <style>
                    .badge-servico {
                        display: inline-block;
                        background: rgba(33, 153, 239, 0.1);
                        padding: 4px 8px;
                        border-radius: 16px;
                        font-size: 0.7rem;
                        margin: 2px 4px 2px 0;
                    }
                    .badge-pacote {
                        display: inline-block;
                        background: rgba(245, 158, 11, 0.15);
                        padding: 2px 8px;
                        border-radius: 16px;
                        margin: 2px 4px 2px 0;
                        font-size: 0.7rem;
                    }
                </style>
                <div class="agenda-header">
                    <h3><i class="fa-solid fa-calendar-day"></i> Agenda - ${dataExibicao}</h3>
                    <div class="date-nav">
                        <button id="btnDiaAnterior" class="btn-nav"><i class="fa-solid fa-chevron-left"></i> Dia Anterior</button>
                        <button id="btnHoje" class="btn-nav">Hoje</button>
                        <button id="btnProximoDia" class="btn-nav">Próximo Dia <i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                </div>
                <div class="agenda-grid">
                    ${agendaHtml}
                </div>
            `;
            
            conteudoDiv.innerHTML = html;
            
            document.getElementById('btnDiaAnterior')?.addEventListener('click', () => {
                const [ano, mes, dia] = data.split('-').map(Number);
                const novaData = new Date(ano, mes - 1, dia - 1);
                const novoAno = novaData.getFullYear();
                const novoMes = String(novaData.getMonth() + 1).padStart(2, '0');
                const novoDia = String(novaData.getDate()).padStart(2, '0');
                dataAtual = `${novoAno}-${novoMes}-${novoDia}`;
                carregarAgenda(dataAtual);
            });
            
            document.getElementById('btnHoje')?.addEventListener('click', () => {
                dataAtual = getDataAtualString();
                carregarAgenda(dataAtual);
            });
            
            document.getElementById('btnProximoDia')?.addEventListener('click', () => {
                const [ano, mes, dia] = data.split('-').map(Number);
                const novaData = new Date(ano, mes - 1, dia + 1);
                const novoAno = novaData.getFullYear();
                const novoMes = String(novaData.getMonth() + 1).padStart(2, '0');
                const novoDia = String(novaData.getDate()).padStart(2, '0');
                dataAtual = `${novoAno}-${novoMes}-${novoDia}`;
                carregarAgenda(dataAtual);
            });
            
        } catch (error) {
            console.error("Erro ao carregar agenda:", error);
            conteudoDiv.innerHTML = '<div class="loading">Erro ao carregar agenda</div>';
        }
    }
    
    await carregarAgenda(dataAtual);
}

// ==================== RENDERIZAÇÃO DE SERVIÇOS ====================

async function renderizarServicos() {
    if (!conteudoDiv) return;
    
    conteudoDiv.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando serviços...</div>';
    
    try {
        const servicosRef = collection(db, "servicos");
        const snapshot = await getDocs(servicosRef);
        
        const servicos = [];
        snapshot.forEach(doc => {
            servicos.push({ id: doc.id, ...doc.data() });
        });
        
        const html = `
            <div class="agenda-header">
                <h3><i class="fa-solid fa-cut"></i> Serviços Disponíveis</h3>
            </div>
            <div class="agenda-grid">
                ${servicos.length === 0 ? '<div class="loading">Nenhum serviço cadastrado</div>' :
                    servicos.map(servico => {
                        return `
                            <div class="agenda-card">
                                <div class="agenda-horario">${servico.categoria || 'Geral'}</div>
                                <div class="agenda-cliente">${servico.nome || 'Sem nome'}</div>
                                <div class="agenda-servico">Duração: ${servico.duracao || 60} min</div>
                                <div class="agenda-status status-confirmado">${formatarMoeda(servico.preco || 0)}</div>
                            </div>
                        `;
                    }).join('')
                }
            </div>
        `;
        
        conteudoDiv.innerHTML = html;
        
    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
        conteudoDiv.innerHTML = '<div class="loading">Erro ao carregar serviços</div>';
    }
}

// ==================== RENDERIZAÇÃO DE COMISSÕES ====================

async function renderizarComissoes() {
    if (!conteudoDiv) return;
    
    conteudoDiv.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando comissões...</div>';
    
    try {
        const agendamentosRef = collection(db, "agendamentos");
        const q = query(
            agendamentosRef,
            where("profissionalId", "==", barbeiroId),
            where("status", "in", ["concluido", "finalizado"])
        );
        
        const snapshot = await getDocs(q);
        
        let totalComissoes = 0;
        let totalAtendimentos = 0;
        const comissaoPercentual = barbeiroData?.comissao || 30;
        const atendimentos = [];
        
        for (const docSnap of snapshot.docs) {
            const ag = docSnap.data();
            const agId = docSnap.id;
            totalAtendimentos++;
            
            const comanda = await buscarComandaPorAgendamentoId(agId);
            const itensInfo = await extrairItensDaComanda(comanda, ag);
            const valor = itensInfo.valorTotal;
            const comissao = valor * comissaoPercentual / 100;
            totalComissoes += comissao;
            atendimentos.push({ id: agId, ...ag, comanda, itensInfo, comissao });
        }
        
        atendimentos.sort((a, b) => {
            const dateA = a.data?.toDate ? a.data.toDate() : new Date(0);
            const dateB = b.data?.toDate ? b.data.toDate() : new Date(0);
            return dateB - dateA;
        });
        
        const atendimentosHtml = [];
        for (const ag of atendimentos.slice(0, 20)) {
            const itensFormatados = formatarItensParaExibicao(ag.itensInfo);
            atendimentosHtml.push(`
                <div class="agenda-card">
                    <div class="agenda-horario">${formatarData(ag.data)} às ${ag.horario || '-'}</div>
                    <div class="agenda-cliente">${escapeHtml(ag.cliente || ag.nome || 'Cliente')}</div>
                    <div class="agenda-servico">${itensFormatados.html}</div>
                    <div class="agenda-status status-concluido" style="margin-top: 8px;">
                        <i class="fa-solid fa-check-double"></i> Valor: ${itensFormatados.precoExibicao} | Comissão: ${formatarMoeda(ag.comissao)}
                    </div>
                </div>
            `);
        }
        
        const html = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-coins"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${formatarMoeda(totalComissoes)}</span>
                        <span class="stat-label">Total de Comissões (${comissaoPercentual}%)</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-cut"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${totalAtendimentos}</span>
                        <span class="stat-label">Atendimentos Realizados</span>
                    </div>
                </div>
            </div>
            <div class="agenda-header">
                <h3><i class="fa-solid fa-list"></i> Histórico de Atendimentos</h3>
            </div>
            <div class="agenda-grid">
                ${atendimentosHtml.length === 0 ? '<div class="loading">Nenhum atendimento concluído</div>' : atendimentosHtml.join('')}
            </div>
        `;
        
        conteudoDiv.innerHTML = html;
        
    } catch (error) {
        console.error("Erro ao carregar comissões:", error);
        conteudoDiv.innerHTML = '<div class="loading">Erro ao carregar comissões</div>';
    }
}

// ==================== RENDERIZAÇÃO DE METAS ====================

async function renderizarMetas() {
    if (!conteudoDiv) return;
    
    conteudoDiv.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando metas...</div>';
    
    try {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        
        const inicioStr = `${inicioMes.getFullYear()}-${String(inicioMes.getMonth() + 1).padStart(2, '0')}-${String(inicioMes.getDate()).padStart(2, '0')}`;
        const fimStr = `${fimMes.getFullYear()}-${String(fimMes.getMonth() + 1).padStart(2, '0')}-${String(fimMes.getDate()).padStart(2, '0')}`;
        
        const agendamentosRef = collection(db, "agendamentos");
        const q = query(
            agendamentosRef,
            where("profissionalId", "==", barbeiroId),
            where("status", "in", ["concluido", "finalizado"])
        );
        
        const snapshot = await getDocs(q);
        
        let realizado = 0;
        let atendimentosMes = 0;
        let comissaoTotal = 0;
        const comissaoPercentual = barbeiroData?.comissao || 30;
        
        for (const docSnap of snapshot.docs) {
            const ag = docSnap.data();
            const agId = docSnap.id;
            const dataAg = getDateString(ag.data);
            if (dataAg && dataAg >= inicioStr && dataAg <= fimStr) {
                const comanda = await buscarComandaPorAgendamentoId(agId);
                const itensInfo = await extrairItensDaComanda(comanda, ag);
                const valor = itensInfo.valorTotal;
                realizado += valor;
                comissaoTotal += (valor * comissaoPercentual) / 100;
                atendimentosMes++;
            }
        }
        
        const metaValor = barbeiroData?.metaMensal || 5000;
        const percentual = metaValor > 0 ? (realizado / metaValor) * 100 : 0;
        const diasRestantes = Math.ceil((fimMes - hoje) / (1000 * 60 * 60 * 24));
        const mediaNecessaria = diasRestantes > 0 ? (metaValor - realizado) / diasRestantes : 0;
        
        const html = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-bullseye"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${formatarMoeda(metaValor)}</span>
                        <span class="stat-label">Meta do Mês</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-chart-line"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${formatarMoeda(realizado)}</span>
                        <span class="stat-label">Realizado</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-percent"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${percentual.toFixed(1)}%</span>
                        <span class="stat-label">Atingido</span>
                    </div>
                </div>
            </div>
            <div class="stats-grid" style="margin-top: 0;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-calendar"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${atendimentosMes}</span>
                        <span class="stat-label">Atendimentos no Mês</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-coins"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${formatarMoeda(comissaoTotal)}</span>
                        <span class="stat-label">Comissão (${comissaoPercentual}%)</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-ticket"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${atendimentosMes > 0 ? formatarMoeda(realizado / atendimentosMes) : formatarMoeda(0)}</span>
                        <span class="stat-label">Ticket Médio</span>
                    </div>
                </div>
            </div>
            <div class="progresso-meta">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(percentual, 100)}%"></div>
                </div>
                <p style="text-align: center; margin-top: 12px; color: #9ca3af;">
                    ${percentual >= 100 ? '🎉 Parabéns! Meta atingida!' : `Faltam ${formatarMoeda(Math.max(0, metaValor - realizado))} para atingir sua meta`}
                </p>
                ${percentual < 100 && diasRestantes > 0 ? `
                    <div style="margin-top: 16px; padding: 12px; background: rgba(33,153,239,0.1); border-radius: 12px;">
                        <p style="font-size: 0.8rem; color: #2199EF; text-align: center;">
                            <i class="fa-solid fa-chart-simple"></i> Faltam ${diasRestantes} dia(s). Para bater a meta, você precisa de uma média de ${formatarMoeda(mediaNecessaria)} por dia
                        </p>
                    </div>
                ` : ''}
            </div>
            <style>
                .progresso-meta {
                    background: #151823;
                    border-radius: 16px;
                    padding: 24px;
                    margin-top: 20px;
                }
                .progress-bar {
                    background: #2a2d3a;
                    border-radius: 10px;
                    height: 12px;
                    overflow: hidden;
                }
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #2199EF, #1a7fcc);
                    border-radius: 10px;
                    transition: width 0.5s ease;
                }
            </style>
        `;
        
        conteudoDiv.innerHTML = html;
        
    } catch (error) {
        console.error("Erro ao carregar metas:", error);
        conteudoDiv.innerHTML = '<div class="loading">Erro ao carregar metas</div>';
    }
}

// ==================== RENDERIZAÇÃO DO PERFIL ====================

async function renderizarPerfil() {
    if (!conteudoDiv) return;
    
    conteudoDiv.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando perfil...</div>';
    
    try {
        await atualizarDadosFirestore();
        
        const diasTrabalho = barbeiroData?.diasTrabalho || [];
        const diasSemana = {
            'segunda': 'Segunda-feira',
            'terca': 'Terça-feira',
            'quarta': 'Quarta-feira',
            'quinta': 'Quinta-feira',
            'sexta': 'Sexta-feira',
            'sabado': 'Sábado',
            'domingo': 'Domingo'
        };
        
        const diasFormatados = diasTrabalho.map(d => diasSemana[d] || d).join(', ');
        const fotoUrl = barbeiroData?.fotoUrl || barbeiroData?.foto || (barbeiroFotoImg ? barbeiroFotoImg.src : './assets/barber-icon.png');
        
        const html = `
            <div class="agenda-header">
                <h3><i class="fa-solid fa-user"></i> Meu Perfil</h3>
                <small style="color: #9ca3af;">Dados fornecidos pela administração</small>
            </div>
            <div class="perfil-card">
                <div class="perfil-avatar">
                    <img id="perfilFoto" src="${fotoUrl}" alt="Foto do Barbeiro" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                </div>
                <div class="perfil-info">
                    <div class="info-row">
                        <span class="label"><i class="fa-solid fa-user"></i> Nome:</span>
                        <span class="value">${barbeiroData?.nome || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label"><i class="fa-solid fa-envelope"></i> E-mail:</span>
                        <span class="value">${barbeiroData?.email || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label"><i class="fa-solid fa-phone"></i> Telefone:</span>
                        <span class="value">${barbeiroData?.telefone || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label"><i class="fa-solid fa-tag"></i> Especialidade:</span>
                        <span class="value">${getEspecialidadeIcon(barbeiroData?.especialidade)} ${barbeiroData?.especialidade || 'Geral'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label"><i class="fa-solid fa-bullseye"></i> Meta Mensal:</span>
                        <span class="value">${formatarMoeda(barbeiroData?.metaMensal || 5000)}</span>
                    </div>
                    <div class="info-row">
                        <span class="label"><i class="fa-solid fa-coins"></i> Comissão:</span>
                        <span class="value">${barbeiroData?.comissao || 30}%</span>
                    </div>
                    <div class="info-row">
                        <span class="label"><i class="fa-solid fa-calendar"></i> Dias de Trabalho:</span>
                        <span class="value">${diasFormatados || 'Não definido'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label"><i class="fa-solid fa-clock"></i> Horário:</span>
                        <span class="value">${barbeiroData?.horarioInicio || '09:00'} - ${barbeiroData?.horarioFim || '18:00'}</span>
                    </div>
                </div>
            </div>
            <div class="perfil-observacao">
                <i class="fa-solid fa-info-circle"></i>
                <span>Para alterar seus dados, entre em contato com a administração.</span>
            </div>
            <style>
                .perfil-card {
                    background: #151823;
                    border-radius: 20px;
                    padding: 30px;
                    display: flex;
                    gap: 30px;
                    align-items: center;
                    flex-wrap: wrap;
                }
                .perfil-avatar {
                    width: 120px;
                    height: 120px;
                    background: linear-gradient(135deg, rgba(33,153,239,0.15), transparent);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 3rem;
                    color: #2199EF;
                    border: 2px solid #2199EF;
                    overflow: hidden;
                }
                .perfil-info { flex: 1; }
                .info-row {
                    display: flex;
                    padding: 10px 0;
                    border-bottom: 1px solid #2a2d3a;
                }
                .info-row .label {
                    width: 140px;
                    color: #9ca3af;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .info-row .label i { width: 20px; color: #2199EF; }
                .info-row .value { flex: 1; color: #fff; font-weight: 500; }
                .perfil-observacao {
                    margin-top: 20px;
                    padding: 12px 16px;
                    background: rgba(33,153,239,0.1);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 0.8rem;
                    color: #2199EF;
                }
                @media (max-width: 768px) {
                    .perfil-card { flex-direction: column; text-align: center; }
                    .info-row { flex-direction: column; gap: 4px; }
                    .info-row .label { width: 100%; }
                }
            </style>
        `;
        
        conteudoDiv.innerHTML = html;
        
        const perfilFoto = document.getElementById('perfilFoto');
        if (perfilFoto && barbeiroFotoImg) {
            perfilFoto.src = barbeiroFotoImg.src;
        }
        
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        conteudoDiv.innerHTML = '<div class="loading">Erro ao carregar perfil</div>';
    }
}

// ==================== NAVEGAÇÃO ====================

function carregarPagina(pagina) {
    console.log("🔄 Carregando página:", pagina);
    currentPage = pagina;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        const itemPage = item.getAttribute('data-page');
        if (itemPage === pagina) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    switch(pagina) {
        case 'dashboard':
            renderizarDashboard();
            break;
        case 'agenda':
            renderizarAgenda();
            break;
        case 'servicos':
            renderizarServicos();
            break;
        case 'comissoes':
            renderizarComissoes();
            break;
        case 'metas':
            renderizarMetas();
            break;
        case 'perfil':
            renderizarPerfil();
            break;
        default:
            renderizarDashboard();
    }
}

// ==================== INICIALIZAÇÃO ====================

function inicializarElementos() {
    conteudoDiv = document.getElementById('conteudoDinamico');
    barbeiroNomeSpan = document.getElementById('barbeiroNome');
    barbeiroFotoImg = document.getElementById('barbeiroFoto');
    toast = document.getElementById('toast');
    toastMsg = document.getElementById('toastMsg');
    
    console.log("📋 Elementos DOM inicializados");
}

function inicializarMenu() {
    console.log("🎯 Inicializando menu lateral...");
    
    const navItems = document.querySelectorAll('.nav-item');
    console.log(`📋 Encontrados ${navItems.length} itens de menu`);
    
    navItems.forEach((item) => {
        const page = item.getAttribute('data-page');
        
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);
        
        newItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`🖱️ Menu clicado: ${page}`);
            
            if (page) {
                carregarPagina(page);
                
                const sidebar = document.querySelector('.sidebar-barbeiro');
                if (window.innerWidth <= 768 && sidebar) {
                    sidebar.classList.remove('mobile-open');
                }
            }
        });
        
        newItem.style.cursor = 'pointer';
    });
    
    console.log("✅ Menu inicializado com sucesso!");
}

function inicializarLogout() {
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        const newBtn = btnLogout.cloneNode(true);
        btnLogout.parentNode.replaceChild(newBtn, btnLogout);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("🚪 Realizando logout...");
            sessionStorage.clear();
            mostrarToast("Logout realizado com sucesso!", "sucesso");
            setTimeout(() => {
                window.location.href = 'login-barbeiro.html';
            }, 1000);
        });
    }
}

function inicializarMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.querySelector('.sidebar-barbeiro');
    
    if (mobileMenuBtn && sidebar) {
        const newBtn = mobileMenuBtn.cloneNode(true);
        mobileMenuBtn.parentNode.replaceChild(newBtn, mobileMenuBtn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            sidebar.classList.toggle('mobile-open');
            console.log("📱 Menu mobile toggled");
        });
    }
}

function atualizarDataHora() {
    const dataAtualSpan = document.getElementById('dataAtual');
    const horaAtualSpan = document.getElementById('horaAtual');
    
    if (dataAtualSpan && horaAtualSpan) {
        const agora = new Date();
        dataAtualSpan.textContent = agora.toLocaleDateString('pt-BR');
        horaAtualSpan.textContent = agora.toLocaleTimeString('pt-BR');
    }
}

// ==================== INÍCIO DA APLICAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 DOM completamente carregado, inicializando aplicação...");
    
    inicializarElementos();
    
    if (!verificarSessao()) {
        return;
    }
    
    // Aguarda autenticação do Firebase antes de carregar os dados
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("✅ Usuário autenticado no Firebase:", user.uid);
            authReady = true;
            
            inicializarMenu();
            inicializarLogout();
            inicializarMobileMenu();
            
            atualizarDataHora();
            setInterval(atualizarDataHora, 1000);
            
            carregarPagina('dashboard');
            
            console.log("✅ Aplicação inicializada com sucesso!");
        } else {
            console.log("⚠️ Nenhum usuário autenticado. Realizando login anônimo...");
            
            signInAnonymously(auth)
                .then((userCredential) => {
                    console.log("✅ Login anônimo realizado com sucesso!");
                    authReady = true;
                    
                    inicializarMenu();
                    inicializarLogout();
                    inicializarMobileMenu();
                    
                    atualizarDataHora();
                    setInterval(atualizarDataHora, 1000);
                    
                    carregarPagina('dashboard');
                })
                .catch((error) => {
                    console.error("❌ Erro no login anônimo:", error);
                    if (conteudoDiv) {
                        conteudoDiv.innerHTML = `
                            <div class="loading">
                                <i class="fa-solid fa-lock"></i>
                                <p>Erro de autenticação: ${error.message}</p>
                                <p style="font-size: 0.8rem; margin-top: 10px;">Verifique as regras de segurança do Firebase</p>
                                <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 20px; background: #2199EF; border: none; border-radius: 8px; color: white; cursor: pointer;">
                                    Tentar novamente
                                </button>
                            </div>
                        `;
                    }
                });
        }
    });
});

console.log("✅ painel-barbeiro.js carregado (versão completa com autenticação integrada)");