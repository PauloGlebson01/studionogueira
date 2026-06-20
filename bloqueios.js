// bloqueios.js - CORREÇÃO DE DATAS (TIMEZONE LOCAL) - VERSÃO COMPLETA
// CORREÇÃO: Agendamentos concluídos NUNCA mais ficam disponíveis na visualização
// CORREÇÃO: Visualização semanal com TODOS os horários de TODOS os dias
// CORREÇÃO: Exibição correta de agendamentos em Quinta e Sexta-feira (18/06 e 19/06)
// CORREÇÃO: Normalização robusta de datas para comparação

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    where,
    orderBy,
    Timestamp,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

//CONFIGURAÇÕES DE DADOS
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

let bloqueios = [];
let agendamentos = [];
let profissionais = [];
let unsubscribeBloqueios = null;
let unsubscribeAgendamentos = null;
let currentDate = new Date();
let currentView = 'semana';

const horariosSegundaQuarta = [
    "08:20", "09:00", "09:40", "10:20", "11:00", "11:40",
    "14:00", "14:40", "15:20", "16:00", "16:40", "17:20", "18:00", "18:40"
];

const horariosQuintaSabado = [
    "08:00", "08:40", "09:20", "10:00", "10:40", "11:20",
    "14:00", "14:40", "15:20", "16:00", "17:20", "18:00", "18:40"
];

// ========== CORREÇÃO: Status que são considerados ATIVOS (ocupam horário) ==========
const STATUS_ATIVOS = ["confirmado", "aguardando_pagamento", "pendente", "concluido"];

const elementosDOM = {
    bloqueiosList: document.getElementById('bloqueiosList'),
    searchBloqueio: document.getElementById('searchBloqueio'),
    filterBloqueioStatus: document.getElementById('filterBloqueioStatus'),
    btnNovoBloqueio: document.getElementById('btnNovoBloqueio'),
    modalBloqueio: document.getElementById('modalBloqueio'),
    formBloqueio: document.getElementById('formBloqueio'),
    modalTitle: document.getElementById('modalTitle'),
    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toastMsg'),
    agendaVisualizacao: document.getElementById('agendaVisualizacao'),
    periodoLabel: document.getElementById('periodoLabel'),
    btnHoje: document.getElementById('btnHoje'),
    btnSemanaAnterior: document.getElementById('btnSemanaAnterior'),
    btnProximaSemana: document.getElementById('btnProximaSemana'),
    tipoVisualizacao: document.getElementById('tipoVisualizacao')
};

let bloqueioParaExcluir = null;

function mostrarToast(mensagem, tipo = 'sucesso') {
    if (!elementosDOM.toast) return;
    elementosDOM.toastMsg.textContent = mensagem;
    elementosDOM.toast.style.background = tipo === 'sucesso'
        ? 'linear-gradient(135deg, #2199EF, #1a7fcc)'
        : 'linear-gradient(135deg, #ef4444, #dc2626)';
    elementosDOM.toast.classList.add('show');
    setTimeout(() => {
        elementosDOM.toast.classList.remove('show');
    }, 3000);
}

// ========== FUNÇÕES DE DATA CORRIGIDAS COM NORMALIZAÇÃO ROBUSTA ==========

/**
 * Converte qualquer formato de data para objeto Date no timezone local
 */
function converterParaDateLocal(data) {
    if (!data) return null;
    
    try {
        // Se for Timestamp do Firestore
        if (data.toDate && typeof data.toDate === 'function') {
            return data.toDate();
        }
        
        // Se for objeto com seconds (Timestamp Firestore)
        if (data.seconds !== undefined) {
            return new Date(data.seconds * 1000);
        }
        
        // Se já for Date
        if (data instanceof Date) {
            return data;
        }
        
        // Se for string
        if (typeof data === 'string') {
            // Tentar diferentes formatos
            let dateObj = null;
            
            // Formato ISO: 2026-06-18T00:00:00.000Z
            if (data.includes('T') && data.includes('Z')) {
                dateObj = new Date(data);
                if (!isNaN(dateObj.getTime())) return dateObj;
            }
            
            // Formato YYYY-MM-DD
            if (data.includes('-')) {
                const partes = data.split('-');
                if (partes.length === 3) {
                    // Verificar se tem timezone
                    if (partes[2].includes('T')) {
                        const [dia, resto] = partes[2].split('T');
                        dateObj = new Date(
                            parseInt(partes[0], 10),
                            parseInt(partes[1], 10) - 1,
                            parseInt(dia, 10),
                            12, 0, 0
                        );
                    } else {
                        dateObj = new Date(
                            parseInt(partes[0], 10),
                            parseInt(partes[1], 10) - 1,
                            parseInt(partes[2], 10),
                            12, 0, 0
                        );
                    }
                    if (!isNaN(dateObj.getTime())) return dateObj;
                }
            }
            
            // Formato DD/MM/YYYY
            if (data.includes('/')) {
                const partes = data.split('/');
                if (partes.length === 3) {
                    dateObj = new Date(
                        parseInt(partes[2], 10),
                        parseInt(partes[1], 10) - 1,
                        parseInt(partes[0], 10),
                        12, 0, 0
                    );
                    if (!isNaN(dateObj.getTime())) return dateObj;
                }
            }
        }
        
        return null;
    } catch (error) {
        console.warn("Erro ao converter data:", error);
        return null;
    }
}

/**
 * Formata data para exibição (DD/MM/YYYY)
 */
function formatarData(data) {
    const dataObj = converterParaDateLocal(data);
    if (!dataObj || isNaN(dataObj.getTime())) return '';
    
    const dia = String(dataObj.getDate()).padStart(2, '0');
    const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
    const ano = dataObj.getFullYear();
    
    return `${dia}/${mes}/${ano}`;
}

/**
 * Formata data para comparação (YYYY-MM-DD) - USO LOCAL
 * CORREÇÃO: Normaliza qualquer formato de data para YYYY-MM-DD
 */
function formatarDataComparacao(data) {
    if (!data) return '';
    
    // Se for string, tentar normalizar diretamente
    if (typeof data === 'string') {
        // Já está no formato YYYY-MM-DD
        if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return data;
        }
        
        // Formato ISO com T
        if (data.includes('T')) {
            const parteData = data.split('T')[0];
            if (parteData.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return parteData;
            }
        }
        
        // Formato DD/MM/YYYY
        if (data.includes('/')) {
            const partes = data.split('/');
            if (partes.length === 3) {
                const dia = String(parseInt(partes[0], 10)).padStart(2, '0');
                const mes = String(parseInt(partes[1], 10)).padStart(2, '0');
                const ano = String(parseInt(partes[2], 10)).padStart(4, '0');
                return `${ano}-${mes}-${dia}`;
            }
        }
        
        // Tentar extrair data com regex
        const match = data.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            return `${match[1]}-${match[2]}-${match[3]}`;
        }
    }
    
    // Usar o conversor para Date
    const dataObj = converterParaDateLocal(data);
    if (!dataObj || isNaN(dataObj.getTime())) return '';
    
    const ano = dataObj.getFullYear();
    const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
    const dia = String(dataObj.getDate()).padStart(2, '0');
    
    return `${ano}-${mes}-${dia}`;
}

/**
 * Obtém dia da semana (0=Domingo, 1=Segunda...) a partir da string YYYY-MM-DD
 */
function getDiaSemana(dataStr) {
    if (!dataStr) return null;
    
    // Tentar extrair do formato YYYY-MM-DD
    const match = dataStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const data = new Date(
            parseInt(match[1], 10),
            parseInt(match[2], 10) - 1,
            parseInt(match[3], 10),
            12, 0, 0
        );
        return data.getDay();
    }
    
    // Tentar converter via Date
    const dataObj = converterParaDateLocal(dataStr);
    if (dataObj && !isNaN(dataObj.getTime())) {
        return dataObj.getDay();
    }
    
    return null;
}

function getNomeDiaSemanaCompleto(data) {
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return dias[data.getDay()];
}

function getNomeDiaSemanaAbreviado(data) {
    const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    return dias[data.getDay()];
}

/**
 * Obtém horários disponíveis baseado no dia da semana
 */
function getHorariosPorDia(dataStr) {
    const diaSemana = getDiaSemana(dataStr);
    
    if (diaSemana === null) {
        return { horarios: [], temAtendimento: false, descricao: "Data inválida" };
    }
    
    // Domingo - Fechado
    if (diaSemana === 0) {
        return { horarios: [], temAtendimento: false, descricao: "Domingo - Fechado" };
    }
    
    // Segunda a Quarta (1, 2, 3)
    if (diaSemana >= 1 && diaSemana <= 3) {
        return { horarios: [...horariosSegundaQuarta], temAtendimento: true, descricao: "Segunda à Quarta" };
    }
    // Quinta a Sábado (4, 5, 6)
    else if (diaSemana >= 4 && diaSemana <= 6) {
        return { horarios: [...horariosQuintaSabado], temAtendimento: true, descricao: "Quinta à Sábado" };
    }
    
    return { horarios: [], temAtendimento: false, descricao: "Sem atendimento" };
}

function getProfissionalNome(profissionalId) {
    if (!profissionalId) return 'Não definido';
    const profissional = profissionais.find(p => p.id === profissionalId);
    return profissional?.nome || 'Profissional';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

// ========== FUNÇÕES DE CARREGAMENTO DE DADOS ==========

async function carregarProfissionais() {
    try {
        const snapshot = await getDocs(collection(db, "profissionais"));
        profissionais = [];
        snapshot.forEach(doc => {
            profissionais.push({ id: doc.id, ...doc.data() });
        });
        console.log(`✅ ${profissionais.length} profissionais carregados`);
    } catch (error) {
        console.error("Erro ao carregar profissionais:", error);
    }
}

function carregarBloqueios() {
    console.log("🔄 Carregando bloqueios...");
    const q = query(collection(db, "bloqueios"), orderBy("dataInicio", "desc"));
    
    unsubscribeBloqueios = onSnapshot(q, (snapshot) => {
        bloqueios = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            bloqueios.push({
                id: doc.id,
                ...data,
                dataInicio: converterParaDateLocal(data.dataInicio) || new Date(),
                dataFim: converterParaDateLocal(data.dataFim) || new Date()
            });
        });
        console.log(`✅ ${bloqueios.length} bloqueios processados`);
        renderizarBloqueios();
    }, (error) => {
        console.error("❌ Erro ao carregar bloqueios:", error);
        if (elementosDOM.bloqueiosList) {
            elementosDOM.bloqueiosList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Erro ao carregar bloqueios: ${error.message}</p></div>`;
        }
    });
}

// ========== FUNÇÃO CORRIGIDA: carregarAgendamentosEmTempoReal ==========
function carregarAgendamentosEmTempoReal() {
    console.log("🔄 Iniciando listener em tempo real para agendamentos...");
    
    try {
        const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
        
        unsubscribeAgendamentos = onSnapshot(q, (snapshot) => {
            agendamentos = [];
            
            snapshot.forEach(doc => {
                const firestoreData = doc.data();
                
                // EXTRAIR DATA DE QUALQUER FORMATO
                let dataAgendamento = null;
                let dataString = null;
                
                // Tentar diferentes campos de data
                const camposData = ['data', 'dataAgendamento', 'data_atendimento', 'date', 'agendamentoData'];
                for (const campo of camposData) {
                    if (firestoreData[campo]) {
                        const tempData = converterParaDateLocal(firestoreData[campo]);
                        if (tempData && !isNaN(tempData.getTime())) {
                            dataAgendamento = tempData;
                            break;
                        }
                    }
                }
                
                // Se não encontrou data, tentar string direta
                if (!dataAgendamento) {
                    for (const campo of camposData) {
                        if (typeof firestoreData[campo] === 'string') {
                            const tempData = converterParaDateLocal(firestoreData[campo]);
                            if (tempData && !isNaN(tempData.getTime())) {
                                dataAgendamento = tempData;
                                break;
                            }
                        }
                    }
                }
                
                // Gerar dataString no formato YYYY-MM-DD
                if (dataAgendamento && !isNaN(dataAgendamento.getTime())) {
                    dataString = formatarDataComparacao(dataAgendamento);
                } else if (typeof firestoreData.data === 'string') {
                    dataString = formatarDataComparacao(firestoreData.data);
                } else if (typeof firestoreData.dataAgendamento === 'string') {
                    dataString = formatarDataComparacao(firestoreData.dataAgendamento);
                }
                
                // Verificar se o status está na lista de ATIVOS
                const statusAtivo = STATUS_ATIVOS.includes(firestoreData.status);
                
                let clienteNome = firestoreData.clienteNome || firestoreData.nome || firestoreData.cliente || 'Cliente';
                let servicoNome = firestoreData.servicoNome || firestoreData.servico || firestoreData.servicosNomes || 'Serviço';
                if (Array.isArray(servicoNome)) {
                    servicoNome = servicoNome.join(', ');
                }
                
                agendamentos.push({
                    id: doc.id,
                    ...firestoreData,
                    clienteNome: clienteNome,
                    servicoNome: servicoNome,
                    horario: firestoreData.horario,
                    data: dataAgendamento,
                    dataString: dataString,
                    profissionalId: firestoreData.profissionalId || firestoreData.profissional_id,
                    profissionalNome: firestoreData.profissional,
                    valor: firestoreData.valor || firestoreData.valorTotal || 0,
                    observacoes: firestoreData.observacaoGeral || firestoreData.observacoes || '',
                    status: firestoreData.status || 'confirmado',
                    statusAtivo: statusAtivo
                });
            });
            
            console.log(`📊 Total de agendamentos carregados: ${agendamentos.length}`);
            console.log(`📋 Status considerados ATIVOS: ${STATUS_ATIVOS.join(', ')}`);
            console.log(`📊 Agendamentos ativos: ${agendamentos.filter(a => a.statusAtivo).length}`);
            
            const tabAgenda = document.getElementById('tab-agenda-visualizacao');
            if (tabAgenda && tabAgenda.classList.contains('active')) {
                renderizarAgenda();
            }
        }, (error) => {
            console.error("❌ Erro no listener de agendamentos:", error);
        });
    } catch (error) {
        console.error("❌ Erro ao configurar listener:", error);
    }
}

function carregarProfissionaisEmTempoReal() {
    const q = query(collection(db, "profissionais"), orderBy("nome", "asc"));
    
    onSnapshot(q, (snapshot) => {
        profissionais = [];
        snapshot.forEach(doc => {
            profissionais.push({ id: doc.id, ...doc.data() });
        });
        console.log(`👥 Profissionais atualizados: ${profissionais.length}`);
        
        const tabAgenda = document.getElementById('tab-agenda-visualizacao');
        if (tabAgenda && tabAgenda.classList.contains('active')) {
            renderizarAgenda();
        }
    });
}

// ========== FUNÇÃO PARA ABREVIAR STATUS ==========
function abreviarStatus(status) {
    if (!status) return '⏳ Pend.';
    
    const statusMap = {
        'aguardando_pagamento': '⚠️ Pagto',
        'aguardendo_pagamento': '⚠️ Pagto',
        'confirmado': '✅ Conf.',
        'concluido': '✓ Concl.',
        'pendente': '⏳ Pend.',
        'cancelado': '✖ Cancel.'
    };
    
    return statusMap[status] || status;
}

// ========== RENDERIZAÇÃO DOS BLOQUEIOS ==========

function renderizarBloqueios() {
    if (!elementosDOM.bloqueiosList) return;
    
    let filtered = [...bloqueios];
    const searchTerm = elementosDOM.searchBloqueio?.value.toLowerCase() || '';
    const statusFilter = elementosDOM.filterBloqueioStatus?.value || 'todos';
    
    if (searchTerm) {
        filtered = filtered.filter(b => 
            b.titulo?.toLowerCase().includes(searchTerm) ||
            b.motivo?.toLowerCase().includes(searchTerm)
        );
    }
    
    const agora = new Date();
    if (statusFilter === 'ativo') {
        filtered = filtered.filter(b => b.dataFim && b.dataFim > agora);
    } else if (statusFilter === 'expirado') {
        filtered = filtered.filter(b => b.dataFim && b.dataFim <= agora);
    }
    
    if (filtered.length === 0) {
        elementosDOM.bloqueiosList.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-calendar-xmark"></i>
                <p>Nenhum bloqueio encontrado</p>
                <button class="btn-bloqueio" id="emptyBtnNovoBloqueio"><i class="fa-solid fa-plus"></i> Criar Bloqueio</button>
            </div>
        `;
        const emptyBtn = document.getElementById('emptyBtnNovoBloqueio');
        if (emptyBtn) emptyBtn.addEventListener('click', abrirModalNovoBloqueio);
        return;
    }
    
    elementosDOM.bloqueiosList.innerHTML = filtered.map(bloqueio => {
        const status = bloqueio.dataFim && bloqueio.dataFim > new Date() ? 'ativo' : 'expirado';
        return `
            <div class="bloqueio-card">
                <div class="bloqueio-info">
                    <h4><i class="fa-solid fa-ban"></i> ${escapeHtml(bloqueio.titulo)} <span class="badge">${status === 'ativo' ? 'Ativo' : 'Expirado'}</span></h4>
                    <p><i class="fa-regular fa-calendar"></i> ${formatarData(bloqueio.dataInicio)} até ${formatarData(bloqueio.dataFim)}</p>
                    ${bloqueio.horarios && bloqueio.horarios.length > 0 ? `<p><i class="fa-regular fa-clock"></i> Horários: ${bloqueio.horarios.join(', ')}</p>` : '<p><i class="fa-regular fa-clock"></i> Dia inteiro bloqueado</p>'}
                    <p class="motivo"><i class="fa-solid fa-circle-info"></i> ${escapeHtml(bloqueio.motivo || 'Sem motivo informado')}</p>
                </div>
                <div class="bloqueio-actions">
                    <button class="btn-icon btn-delete" data-id="${bloqueio.id}" data-titulo="${escapeHtml(bloqueio.titulo)}"><i class="fa-regular fa-trash-can"></i> Excluir</button>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const titulo = btn.getAttribute('data-titulo');
            abrirModalExcluirBloqueio(id, titulo);
        });
    });
}

// ========== RENDERIZAÇÃO DA AGENDA CORRIGIDA ==========

function obterInicioSemana(data) {
    const dataLocal = new Date(data);
    const diaSemana = dataLocal.getDay();
    const inicio = new Date(dataLocal);
    inicio.setDate(dataLocal.getDate() - diaSemana);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
}

function renderizarAgenda() {
    if (!elementosDOM.agendaVisualizacao) return;
    
    if (currentView === 'semana') {
        renderizarSemana();
    } else if (currentView === 'mes') {
        renderizarMes();
    } else if (currentView === 'dia') {
        renderizarDia();
    }
}

// ========== FUNÇÃO CORRIGIDA: renderizarSemana com TODOS os horários ==========
function renderizarSemana() {
    const inicioSemana = obterInicioSemana(currentDate);
    
    const dias = [];
    for (let i = 0; i < 7; i++) {
        const dia = new Date(inicioSemana);
        dia.setDate(inicioSemana.getDate() + i);
        dias.push(dia);
    }
    
    elementosDOM.periodoLabel.textContent = `${formatarData(dias[0])} - ${formatarData(dias[6])}`;
    
    const diasString = dias.map(dia => formatarDataComparacao(dia));
    console.log("📅 Dias da semana:", diasString);
    
    // Filtrar apenas agendamentos ATIVOS (incluindo concluídos)
    const agendamentosAtivos = agendamentos.filter(a => a.statusAtivo === true);
    console.log(`📊 Agendamentos ativos (ocupam horário): ${agendamentosAtivos.length}`);
    
    // Filtrar agendamentos da semana
    const agendamentosSemana = agendamentosAtivos.filter(a => {
        const dataAgendamentoStr = a.dataString;
        if (!dataAgendamentoStr) return false;
        return diasString.includes(dataAgendamentoStr);
    });
    
    console.log(`📊 Agendamentos na semana: ${agendamentosSemana.length}`);
    
    // LOG DETALHADO para depuração
    diasString.forEach(diaStr => {
        const count = agendamentosSemana.filter(a => a.dataString === diaStr).length;
        const diaSemana = getDiaSemana(diaStr);
        const nomeDia = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][diaSemana] || 'Inválido';
        console.log(`   📌 ${diaStr} (${nomeDia}): ${count} agendamentos`);
        
        agendamentosSemana.filter(a => a.dataString === diaStr).forEach(a => {
            console.log(`      - ${a.clienteNome}: ${a.horario} (${a.status})`);
        });
    });
    
    const agendamentosPorDia = {};
    diasString.forEach(diaStr => {
        agendamentosPorDia[diaStr] = agendamentosSemana.filter(a => a.dataString === diaStr);
    });
    
    // ========== CORREÇÃO PRINCIPAL: Coletar TODOS os horários únicos da semana ==========
    const todosHorariosSet = new Set();
    
    for (let idx = 0; idx < dias.length; idx++) {
        const diaStr = diasString[idx];
        const horariosInfo = getHorariosPorDia(diaStr);
        if (horariosInfo.temAtendimento) {
            horariosInfo.horarios.forEach(h => todosHorariosSet.add(h));
        }
    }
    
    // Converter para array e ordenar
    let horariosParaExibir = Array.from(todosHorariosSet);
    horariosParaExibir.sort((a, b) => {
        const [hA, mA] = a.split(':').map(Number);
        const [hB, mB] = b.split(':').map(Number);
        return hA !== hB ? hA - hB : mA - mB;
    });
    
    // Se não houver horários, usar os padrões
    if (horariosParaExibir.length === 0) {
        horariosParaExibir = [...horariosSegundaQuarta, ...horariosQuintaSabado];
        horariosParaExibir = [...new Set(horariosParaExibir)];
        horariosParaExibir.sort((a, b) => {
            const [hA, mA] = a.split(':').map(Number);
            const [hB, mB] = b.split(':').map(Number);
            return hA !== hB ? hA - hB : mA - mB;
        });
    }
    
    console.log(`📋 TODOS os horários a serem exibidos (${horariosParaExibir.length}):`);
    console.log(`   ${horariosParaExibir.join(', ')}`);
    
    let html = '<div class="agenda-wrapper"><div class="agenda-semana">';
    html += '<div class="agenda-cabecalho">';
    html += '<div class="agenda-hora-coluna">Horário</div>';
    
    for (let idx = 0; idx < dias.length; idx++) {
        const dia = dias[idx];
        const diaStr = diasString[idx];
        const horariosInfo = getHorariosPorDia(diaStr);
        const temAtendimento = horariosInfo.temAtendimento;
        
        const hojeStr = formatarDataComparacao(new Date());
        const isHoje = diaStr === hojeStr;
        
        html += `
            <div class="agenda-dia-coluna ${!temAtendimento ? 'dia-fechado' : ''} ${isHoje ? 'hoje' : ''}">
                <div class="dia-nome">${getNomeDiaSemanaAbreviado(dia)}</div>
                <div class="dia-data">${formatarData(dia)}</div>
                ${!temAtendimento ? '<div class="dia-fechado-label">🔒 FECHADO</div>' : ''}
                ${isHoje ? '<div class="dia-hoje-label">📌 HOJE</div>' : ''}
            </div>
        `;
    }
    html += '</div><div class="agenda-corpo">';
    
    for (const horario of horariosParaExibir) {
        html += `<div class="agenda-linha"><div class="agenda-hora">${horario}</div>`;
        
        for (let idx = 0; idx < dias.length; idx++) {
            const diaStr = diasString[idx];
            const horariosInfo = getHorariosPorDia(diaStr);
            const temAtendimento = horariosInfo.temAtendimento;
            
            if (!temAtendimento) {
                html += `<div class="agenda-celula dia-fechado-celula"><div class="sem-atendimento">❌</div></div>`;
                continue;
            }
            
            // Verificar se este horário existe neste dia
            const horariosDia = horariosInfo.horarios;
            if (!horariosDia.includes(horario)) {
                html += `<div class="agenda-celula dia-fechado-celula"><div class="sem-atendimento">⏭️</div></div>`;
                continue;
            }
            
            // Verificar bloqueios
            const bloqueiosDia = bloqueios.filter(b => {
                const dataInicio = formatarDataComparacao(b.dataInicio);
                const dataFim = formatarDataComparacao(b.dataFim);
                return dataInicio <= diaStr && dataFim >= diaStr;
            });
            
            const temBloqueioDiaInteiro = bloqueiosDia.some(b => !b.horarios || b.horarios.length === 0);
            const horariosBloqueados = new Set();
            bloqueiosDia.forEach(b => {
                if (b.horarios && b.horarios.length > 0) {
                    b.horarios.forEach(h => horariosBloqueados.add(h));
                }
            });
            
            const estaBloqueado = temBloqueioDiaInteiro || horariosBloqueados.has(horario);
            
            if (estaBloqueado) {
                html += `<div class="agenda-celula dia-fechado-celula"><div class="sem-atendimento">🔒</div></div>`;
                continue;
            }
            
            const agendamentosHora = agendamentosPorDia[diaStr]?.filter(a => a.horario === horario) || [];
            
            html += `<div class="agenda-celula">`;
            if (agendamentosHora.length > 0) {
                for (const a of agendamentosHora) {
                    const clienteDisplay = a.clienteNome.length > 15 ? a.clienteNome.substring(0, 15) + '...' : a.clienteNome;
                    const servicoDisplay = a.servicoNome.length > 12 ? a.servicoNome.substring(0, 12) + '...' : a.servicoNome;
                    const profissionalDisplay = (a.profissionalNome || getProfissionalNome(a.profissionalId)).length > 10 ? 
                        (a.profissionalNome || getProfissionalNome(a.profissionalId)).substring(0, 10) + '...' : 
                        (a.profissionalNome || getProfissionalNome(a.profissionalId));
                    const statusAbreviado = abreviarStatus(a.status);
                    const tooltipText = `${a.clienteNome} - ${a.horario} - ${a.servicoNome} - ${a.status}`;
                    
                    html += `
                        <div class="agendamento-card" onclick="verDetalhesAgendamento('${a.id}')" title="${escapeHtml(tooltipText)}">
                            <div class="agendamento-cliente" title="${escapeHtml(a.clienteNome)}">${escapeHtml(clienteDisplay)}</div>
                            <div class="agendamento-servico" title="${escapeHtml(a.servicoNome)}">${escapeHtml(servicoDisplay)}</div>
                            <div class="agendamento-profissional" title="${escapeHtml(a.profissionalNome || getProfissionalNome(a.profissionalId))}">${escapeHtml(profissionalDisplay)}</div>
                            <div class="agendamento-status-tag" data-status="${escapeHtml(a.status || 'confirmado')}">
                                ${escapeHtml(statusAbreviado)}
                            </div>
                        </div>
                    `;
                }
            } else {
                html += `<div class="agendamento-vazio"></div>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }
    
    html += '</div></div></div>';
    elementosDOM.agendaVisualizacao.innerHTML = html;
    
    // Adicionar estilo para dia "hoje"
    const styleExists = document.getElementById('agenda-hoje-style');
    if (!styleExists) {
        const style = document.createElement('style');
        style.id = 'agenda-hoje-style';
        style.textContent = `
            .dia-hoje-label {
                font-size: 0.5rem;
                color: #10b981;
                font-weight: 700;
                margin-top: 2px;
                background: rgba(16, 185, 129, 0.15);
                padding: 1px 6px;
                border-radius: 10px;
                display: inline-block;
            }
            .agenda-dia-coluna.hoje {
                background: rgba(33, 153, 239, 0.08);
                border-radius: 8px;
            }
        `;
        document.head.appendChild(style);
    }
}

function renderizarMes() {
    const ano = currentDate.getFullYear();
    const mes = currentDate.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const primeiroDiaSemana = primeiroDia.getDay();
    
    elementosDOM.periodoLabel.textContent = `${formatarData(primeiroDia)} - ${formatarData(ultimoDia)}`;
    
    // Filtrar apenas agendamentos ATIVOS (incluindo concluídos)
    const agendamentosAtivos = agendamentos.filter(a => a.statusAtivo === true);
    
    const agendamentosPorData = {};
    agendamentosAtivos.forEach(a => {
        const dataStr = a.dataString;
        if (dataStr) {
            if (!agendamentosPorData[dataStr]) agendamentosPorData[dataStr] = [];
            agendamentosPorData[dataStr].push(a);
        }
    });
    
    let gridHTML = '<div class="agenda-wrapper"><div class="agenda-mes">';
    gridHTML += '<div class="mes-cabecalho">';
    const diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    diasSemana.forEach(dia => {
        gridHTML += `<div class="mes-dia-semana">${dia}</div>`;
    });
    gridHTML += '</div><div class="mes-grid">';
    
    let diaAtual = 1;
    
    for (let i = 0; i < 42; i++) {
        const isDiaValido = i >= primeiroDiaSemana && diaAtual <= diasNoMes;
        
        if (isDiaValido) {
            const dataAtual = new Date(ano, mes, diaAtual);
            const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(diaAtual).padStart(2, '0')}`;
            const horariosInfo = getHorariosPorDia(dataStr);
            const temAtendimento = horariosInfo.temAtendimento;
            const agendamentosDia = agendamentosPorData[dataStr] || [];
            const isHoje = formatarDataComparacao(new Date()) === dataStr;
            
            let classes = 'mes-dia';
            if (isHoje) classes += ' hoje';
            if (!temAtendimento) classes += ' dia-fechado';
            
            gridHTML += `<div class="${classes}" onclick="${temAtendimento ? `selecionarDia('${dataStr}')` : ''}">
                <div class="mes-dia-numero">${diaAtual}</div>`;
            
            if (!temAtendimento) {
                gridHTML += `<div class="mes-fechado">🔒 FECHADO</div>`;
            } else {
                gridHTML += `<div class="mes-agendamentos">`;
                for (const a of agendamentosDia.slice(0, 3)) {
                    const statusAbreviado = abreviarStatus(a.status);
                    gridHTML += `<div class="mes-agendamento-item" onclick="event.stopPropagation(); verDetalhesAgendamento('${a.id}')" title="${escapeHtml(a.clienteNome)} - ${escapeHtml(a.horario)} (${a.status})">
                        ${escapeHtml(a.horario)} - ${escapeHtml(a.clienteNome.length > 15 ? a.clienteNome.substring(0, 15) + '...' : a.clienteNome)} ${escapeHtml(statusAbreviado)}
                    </div>`;
                }
                if (agendamentosDia.length > 3) {
                    gridHTML += `<div class="mes-agendamento-mais">+${agendamentosDia.length - 3} mais</div>`;
                }
                gridHTML += `</div>`;
            }
            gridHTML += `</div>`;
            diaAtual++;
        } else {
            gridHTML += `<div class="mes-dia vazio"></div>`;
        }
    }
    
    gridHTML += '</div></div></div>';
    elementosDOM.agendaVisualizacao.innerHTML = gridHTML;
}

function renderizarDia() {
    const dataSelecionada = currentDate;
    const dataStr = formatarDataComparacao(dataSelecionada);
    const horariosInfo = getHorariosPorDia(dataStr);
    const temAtendimento = horariosInfo.temAtendimento;
    
    elementosDOM.periodoLabel.textContent = `${getNomeDiaSemanaCompleto(dataSelecionada)}, ${formatarData(dataSelecionada)}`;
    
    if (!temAtendimento) {
        elementosDOM.agendaVisualizacao.innerHTML = `<div class="empty-state"><i class="fa-solid fa-store-slash"></i><p>${getNomeDiaSemanaCompleto(dataSelecionada)} - Estabelecimento Fechado</p></div>`;
        return;
    }
    
    const agendamentosAtivos = agendamentos.filter(a => a.statusAtivo === true);
    const agendamentosDia = agendamentosAtivos.filter(a => a.dataString === dataStr);
    agendamentosDia.sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));
    
    if (agendamentosDia.length === 0) {
        elementosDOM.agendaVisualizacao.innerHTML = `<div class="empty-state"><i class="fa-regular fa-calendar"></i><p>Nenhum agendamento para ${formatarData(dataSelecionada)}</p></div>`;
        return;
    }
    
    elementosDOM.agendaVisualizacao.innerHTML = `
        <div class="agenda-dia">
            <div class="dia-resumo"><div class="resumo-info"><i class="fa-solid fa-calendar-check"></i><span>${agendamentosDia.length} agendamento(s)</span></div></div>
            <div class="dia-agendamentos">
                ${agendamentosDia.map(a => {
                    const statusAbreviado = abreviarStatus(a.status);
                    return `
                        <div class="agendamento-detalhado" onclick="verDetalhesAgendamento('${a.id}')">
                            <div class="agendamento-hora"><i class="fa-regular fa-clock"></i> ${escapeHtml(a.horario || 'Horário não definido')}</div>
                            <div class="agendamento-conteudo">
                                <div class="agendamento-cliente-nome"><strong>${escapeHtml(a.clienteNome)}</strong></div>
                                <div class="agendamento-info">
                                    <span class="agendamento-servico-tag">✂️ ${escapeHtml(a.servicoNome)}</span>
                                    <span class="agendamento-profissional-tag"><i class="fa-solid fa-user-md"></i> ${escapeHtml(a.profissionalNome || getProfissionalNome(a.profissionalId))}</span>
                                    <span class="agendamento-status-tag" data-status="${escapeHtml(a.status || 'confirmado')}">${escapeHtml(statusAbreviado)}</span>
                                </div>
                            </div>
                            <div class="agendamento-valor">${a.valor ? formatarMoeda(a.valor) : ''}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

window.verDetalhesAgendamento = function(id) {
    const agendamento = agendamentos.find(a => a.id === id);
    if (agendamento) {
        mostrarToast(`📋 ${agendamento.clienteNome} - ${agendamento.horario} (${agendamento.status})`, 'sucesso');
    }
};

window.selecionarDia = function(dataStr) {
    const [ano, mes, dia] = dataStr.split('-');
    currentDate = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    currentView = 'dia';
    if (elementosDOM.tipoVisualizacao) elementosDOM.tipoVisualizacao.value = 'dia';
    renderizarAgenda();
};

function navegarSemana(direcao) {
    if (currentView === 'semana') {
        currentDate.setDate(currentDate.getDate() + (direcao * 7));
    } else if (currentView === 'mes') {
        currentDate.setMonth(currentDate.getMonth() + direcao);
    } else if (currentView === 'dia') {
        currentDate.setDate(currentDate.getDate() + direcao);
    }
    renderizarAgenda();
}

function irParaHoje() {
    currentDate = new Date();
    renderizarAgenda();
}

function mudarVisualizacao() {
    currentView = elementosDOM.tipoVisualizacao.value;
    renderizarAgenda();
}

// ========== FUNÇÕES DE BLOQUEIO (MODAL) - CORRIGIDAS ==========

function abrirModalNovoBloqueio() {
    if (elementosDOM.modalTitle) elementosDOM.modalTitle.innerHTML = '<i class="fa-solid fa-plus"></i> Novo Bloqueio';
    if (elementosDOM.formBloqueio) elementosDOM.formBloqueio.reset();
    
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const hojeStr = `${ano}-${mes}-${dia}`;
    
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const amanhaAno = amanha.getFullYear();
    const amanhaMes = String(amanha.getMonth() + 1).padStart(2, '0');
    const amanhaDia = String(amanha.getDate()).padStart(2, '0');
    const amanhaStr = `${amanhaAno}-${amanhaMes}-${amanhaDia}`;
    
    const dataInicio = document.getElementById('bloqueioDataInicio');
    const dataFim = document.getElementById('bloqueioDataFim');
    if (dataInicio) dataInicio.value = hojeStr;
    if (dataFim) dataFim.value = amanhaStr;
    
    if (elementosDOM.modalBloqueio) elementosDOM.modalBloqueio.classList.add('active');
}

async function salvarBloqueio(event) {
    event.preventDefault();
    
    const titulo = document.getElementById('bloqueioTitulo')?.value.trim();
    const motivo = document.getElementById('bloqueioMotivo')?.value;
    const dataInicioStr = document.getElementById('bloqueioDataInicio')?.value;
    const dataFimStr = document.getElementById('bloqueioDataFim')?.value;
    const horariosSelecionados = Array.from(document.querySelectorAll('#bloqueioHorarios input[name="horarios"]:checked')).map(cb => cb.value);
    
    if (!titulo || !dataInicioStr || !dataFimStr) {
        mostrarToast("Preencha todos os campos obrigatórios", "erro");
        return;
    }
    
    const [anoInicio, mesInicio, diaInicio] = dataInicioStr.split('-').map(Number);
    const [anoFim, mesFim, diaFim] = dataFimStr.split('-').map(Number);
    
    const dataInicio = new Date(anoInicio, mesInicio - 1, diaInicio, 12, 0, 0);
    const dataFim = new Date(anoFim, mesFim - 1, diaFim, 23, 59, 59);
    
    if (dataInicio > dataFim) {
        mostrarToast("Data de início não pode ser maior que data de fim", "erro");
        return;
    }
    
    try {
        await addDoc(collection(db, "bloqueios"), {
            titulo: titulo,
            motivo: motivo || '',
            dataInicio: Timestamp.fromDate(dataInicio),
            dataFim: Timestamp.fromDate(dataFim),
            horarios: horariosSelecionados,
            tipo: horariosSelecionados.length > 0 ? "horario" : "periodo",
            ativo: true,
            createdAt: Timestamp.now()
        });
        mostrarToast("Bloqueio criado com sucesso!");
        fecharModalBloqueio();
    } catch (error) {
        console.error("Erro ao salvar bloqueio:", error);
        mostrarToast("Erro ao salvar bloqueio", "erro");
    }
}

function abrirModalExcluirBloqueio(id, titulo) {
    bloqueioParaExcluir = id;
    const excluirTitulo = document.getElementById('excluirBloqueioTitulo');
    if (excluirTitulo) excluirTitulo.textContent = titulo;
    const modalExcluirBloqueio = document.getElementById('modalExcluirBloqueio');
    if (modalExcluirBloqueio) modalExcluirBloqueio.classList.add('active');
}

async function deletarBloqueio() {
    if (!bloqueioParaExcluir) return;
    try {
        await deleteDoc(doc(db, "bloqueios", bloqueioParaExcluir));
        mostrarToast("Bloqueio excluído com sucesso!");
        fecharModalExcluirBloqueio();
    } catch (error) {
        console.error("Erro ao excluir:", error);
        mostrarToast("Erro ao excluir bloqueio", "erro");
    }
}

function fecharModalBloqueio() {
    if (elementosDOM.modalBloqueio) elementosDOM.modalBloqueio.classList.remove('active');
}

function fecharModalExcluirBloqueio() {
    const modalExcluirBloqueio = document.getElementById('modalExcluirBloqueio');
    if (modalExcluirBloqueio) modalExcluirBloqueio.classList.remove('active');
    bloqueioParaExcluir = null;
}

function gerarHorariosCheckboxes() {
    const container = document.getElementById('bloqueioHorarios');
    if (!container) return;
    
    const todosHorarios = [...horariosSegundaQuarta, ...horariosQuintaSabado];
    const horariosUnicos = [...new Set(todosHorarios)];
    horariosUnicos.sort((a, b) => {
        const [hA, mA] = a.split(':').map(Number);
        const [hB, mB] = b.split(':').map(Number);
        return hA !== hB ? hA - hB : mA - mB;
    });
    
    container.innerHTML = horariosUnicos.map(horario => `
        <label class="horario-check">
            <input type="checkbox" name="horarios" value="${horario}">
            <span>${horario}</span>
        </label>
    `).join('');
}

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            
            if (tabId === 'bloqueios') {
                document.getElementById('tab-bloqueios')?.classList.add('active');
            } else if (tabId === 'agenda-visualizacao') {
                document.getElementById('tab-agenda-visualizacao')?.classList.add('active');
                renderizarAgenda();
            }
        });
    });
}

// ========== EVENT LISTENERS ==========

if (elementosDOM.btnNovoBloqueio) elementosDOM.btnNovoBloqueio.addEventListener('click', abrirModalNovoBloqueio);
if (elementosDOM.formBloqueio) elementosDOM.formBloqueio.addEventListener('submit', salvarBloqueio);
if (elementosDOM.searchBloqueio) elementosDOM.searchBloqueio.addEventListener('input', renderizarBloqueios);
if (elementosDOM.filterBloqueioStatus) elementosDOM.filterBloqueioStatus.addEventListener('change', renderizarBloqueios);
if (elementosDOM.btnSemanaAnterior) elementosDOM.btnSemanaAnterior.addEventListener('click', () => navegarSemana(-1));
if (elementosDOM.btnProximaSemana) elementosDOM.btnProximaSemana.addEventListener('click', () => navegarSemana(1));
if (elementosDOM.btnHoje) elementosDOM.btnHoje.addEventListener('click', irParaHoje);
if (elementosDOM.tipoVisualizacao) elementosDOM.tipoVisualizacao.addEventListener('change', mudarVisualizacao);

document.querySelectorAll('.modal-close-bloqueio, .btn-cancel-bloqueio').forEach(btn => {
    btn.addEventListener('click', fecharModalBloqueio);
});

document.querySelectorAll('.modal-close-excluir-bloqueio, .btn-cancel-excluir-bloqueio').forEach(btn => {
    btn.addEventListener('click', fecharModalExcluirBloqueio);
});

const confirmarExcluir = document.getElementById('confirmarExcluirBloqueio');
if (confirmarExcluir) confirmarExcluir.addEventListener('click', deletarBloqueio);

window.addEventListener('click', (e) => {
    if (e.target === elementosDOM.modalBloqueio) fecharModalBloqueio();
    const modalExcluir = document.getElementById('modalExcluirBloqueio');
    if (e.target === modalExcluir) fecharModalExcluirBloqueio();
});

// ========== INICIALIZAÇÃO ==========

async function inicializar() {
    console.log("🔄 Inicializando sistema de bloqueios...");
    console.log(`📋 Status considerados ATIVOS (ocupam horário): ${STATUS_ATIVOS.join(', ')}`);
    gerarHorariosCheckboxes();
    await carregarProfissionais();
    carregarBloqueios();
    carregarProfissionaisEmTempoReal();
    carregarAgendamentosEmTempoReal();
    initTabs();
    
    // Forçar renderização após 2 segundos para garantir que os dados foram carregados
    setTimeout(() => {
        const tabAgenda = document.getElementById('tab-agenda-visualizacao');
        if (tabAgenda && tabAgenda.classList.contains('active')) {
            renderizarAgenda();
        }
    }, 2000);
}

inicializar();

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = 'login.html';
});

const logoutBtn = document.getElementById('logout');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        await signOut(auth);
        window.location.href = 'login.html';
    };
}