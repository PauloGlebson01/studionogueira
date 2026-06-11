// agenda.js - Versão Corrigida com suporte a PRÉ-LANÇAMENTOS E LEMBRETES WHATSAPP
// Com sincronização em tempo real com comandas e atualização de estoque ao concluir
// CORREÇÃO: URL de avaliação corrigida (sem duplicação)
// VERSÃO: Layout Horizontal em Tabela com Dia da Semana Corrigido

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    updateDoc,
    doc,
    Timestamp,
    onSnapshot,
    addDoc,
    getDoc,
    setDoc,
    orderBy,
    deleteDoc
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
const auth = getAuth(app);
const db = getFirestore(app);

// Elementos DOM
const confirmadosDiv = document.getElementById('confirmados');
const concluidosDiv = document.getElementById('concluidos');
const ausentesDiv = document.getElementById('ausentes');
const canceladosDiv = document.getElementById('cancelados');
const countConfirmado = document.getElementById('countConfirmado');
const countConcluido = document.getElementById('countConcluido');
const countAusente = document.getElementById('countAusente');
const countCancelado = document.getElementById('countCancelado');
const dataInicio = document.getElementById('dataInicio');
const dataFim = document.getElementById('dataFim');
const btnFiltrarPeriodo = document.getElementById('btnFiltrarPeriodo');
const btnLimparPeriodo = document.getElementById('btnLimparPeriodo');
const btnSincronizarComandas = document.getElementById('btnSincronizarComandas');

let unsubscribe = null;
let unsubscribeComandas = null;

// ==================== FUNÇÕES AUXILIARES DE FORMATAÇÃO ====================

function getDataAtual() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function formatarData(dataStr) {
    if (!dataStr) return 'Data não informada';
    if (dataStr.toDate) {
        const date = dataStr.toDate();
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    }
    if (typeof dataStr === 'string') {
        if (dataStr.includes('-')) {
            const [ano, mes, dia] = dataStr.split('-');
            return `${dia}/${mes}/${ano}`;
        }
        if (dataStr.includes('/')) {
            return dataStr;
        }
    }
    return 'Data inválida';
}

function obterDiaSemana(dataStr) {
    if (!dataStr) return '';
    
    try {
        let dia = null, mes = null, ano = null;
        let data;
        
        // Caso 1: Timestamp do Firestore
        if (dataStr.toDate) {
            data = dataStr.toDate();
        }
        // Caso 2: String no formato DD/MM/YYYY
        else if (typeof dataStr === 'string' && dataStr.includes('/')) {
            const partes = dataStr.split('/');
            if (partes.length >= 3) {
                dia = parseInt(partes[0], 10);
                mes = parseInt(partes[1], 10);
                ano = parseInt(partes[2], 10);
                // Criar data corretamente (mês em JS é 0-index)
                data = new Date(ano, mes - 1, dia);
            }
        }
        // Caso 3: String no formato YYYY-MM-DD
        else if (typeof dataStr === 'string' && dataStr.includes('-')) {
            const partes = dataStr.split('-');
            if (partes.length >= 3) {
                ano = parseInt(partes[0], 10);
                mes = parseInt(partes[1], 10);
                dia = parseInt(partes[2], 10);
                data = new Date(ano, mes - 1, dia);
            }
        }
        
        if (data && !isNaN(data.getTime())) {
            const diasSemana = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
            return diasSemana[data.getDay()];
        }
        
        return '';
    } catch (error) {
        console.error("Erro ao calcular dia da semana:", error);
        return '';
    }
}

function formatarHorario(horario) {
    return horario || '--:00';
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function mostrarToast(mensagem, tipo = 'sucesso') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        toast.innerHTML = '<i class="fa-solid fa-circle-check"></i><span id="toastMsg"></span>';
        document.body.appendChild(toast);
    }
    const toastMsg = document.getElementById('toastMsg');
    if (toastMsg) toastMsg.textContent = mensagem;
    toast.style.background = tipo === 'sucesso'
        ? 'linear-gradient(135deg, #2199EF, #1a7fcc)'
        : 'linear-gradient(135deg, #ef4444, #dc2626)';
    toast.style.display = 'flex';
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        toast.style.display = 'none';
    }, 3000);
}

// ==================== FUNÇÕES DE LEMBRETES WHATSAPP ====================

function limparTelefone(telefone) {
    if (!telefone) return null;
    let num = telefone.toString().replace(/\D/g, "");
    if (num.length < 10 || num.length > 11) return null;
    if (num.length === 10) {
        num = num.substring(0, 2) + '9' + num.substring(2);
    }
    if (!num.startsWith('55')) {
        num = '55' + num;
    }
    return num;
}

function gerarMensagemLembrete(nomeCliente, data, horario, profissional, servicos, valorTotal, tipo = 'dia') {
    const servicosTexto = servicos && servicos.length > 0 
        ? servicos.map(s => `✂️ ${s.nome || s}`).join('\n')
        : 'Atendimento na barbearia';
    
    if (tipo === 'vespera') {
        return `*🏢 STUDIO NOGUEIRA* - *LEMBRETE DE AGENDAMENTO* ⏰

Olá, *${nomeCliente}*! ✂️💈

Lembramos que você tem um agendamento marcado para amanhã:

📅 *Data:* ${data}
⏰ *Horário:* ${horario}
👨‍🦱 *Barbeiro:* ${profissional}

📋 *Serviços agendados:*
${servicosTexto}

💰 *Valor total:* ${formatarMoeda(valorTotal)}

✨ *IMPORTANTE:*
• Chegue com 10 minutos de antecedência
• Caso precise remarcar, entre em contato com antecedência

📞 *Dúvidas ou alterações?*
Entre em contato conosco: (83) 9 8661-7303

*Studio Nogueira* - Mais de 10 anos transformando estilos. ✂️💈

_Esta é uma mensagem automática. Por favor, não responda._`;
    } else {
        return `*🏢 STUDIO NOGUEIRA* - *LEMBRETE DO DIA!* 🔔

Olá, *${nomeCliente}*! ✂️💈

Seu agendamento é HOJE! Não se esqueça:

📅 *Data:* ${data}
⏰ *Horário:* ${horario}
👨‍🦱 *Barbeiro:* ${profissional}

📋 *Serviços agendados:*
${servicosTexto}

💰 *Valor total:* ${formatarMoeda(valorTotal)}

📍 *Endereço:* Rua Administrador Manoel Ângelo de Oliveira, 295, João Pessoa - PB

*Studio Nogueira* - Mais de 10 anos transformando estilos! ✂️💈

_Esta é uma mensagem automática. Por favor, não responda._`;
    }
}

function gerarMensagemConfirmacao(nomeCliente, data, horario, profissional) {
    return `*🏢 STUDIO NOGUEIRA* - *CONFIRMAÇÃO DE AGENDAMENTO* ✅

Olá, *${nomeCliente}*!

Seu agendamento foi confirmado com sucesso!

📅 *Data:* ${data}
⏰ *Horário:* ${horario}
👨‍🦱 *Barbeiro:* ${profissional}

📱 *Você receberá um lembrete um dia antes do seu horário.*

*Studio Nogueira* - Mais de 10 anos transformando estilos. ✂️💈

_Esta é uma mensagem automática._`;
}

async function enviarLembreteWhatsApp(agendamento, tipo = 'dia') {
    try {
        console.log(`📨 Enviando lembrete ${tipo} para agendamento:`, agendamento.id);
        
        let telefone = agendamento.telefone || agendamento.whatsapp || agendamento.celular;
        
        if (!telefone && agendamento.clienteId) {
            try {
                const clienteDoc = await getDoc(doc(db, "clientes", agendamento.clienteId));
                if (clienteDoc.exists()) {
                    telefone = clienteDoc.data().telefone || clienteDoc.data().whatsapp || null;
                }
            } catch (error) {
                console.error("Erro ao buscar telefone do cliente:", error);
            }
        }
        
        if (!telefone && (agendamento.cliente || agendamento.nome)) {
            try {
                const clientesQuery = query(collection(db, "clientes"), where("nome", "==", agendamento.cliente || agendamento.nome));
                const clientesSnap = await getDocs(clientesQuery);
                if (!clientesSnap.empty) {
                    telefone = clientesSnap.docs[0].data().telefone || null;
                }
            } catch (error) {
                console.error("Erro ao buscar telefone por nome:", error);
            }
        }
        
        if (!telefone) {
            console.log(`❌ Telefone não encontrado para agendamento ${agendamento.id}`);
            return { sucesso: false, motivo: "Telefone não encontrado" };
        }
        
        const telefoneLimpo = limparTelefone(telefone);
        if (!telefoneLimpo) {
            console.log(`❌ Telefone inválido para agendamento ${agendamento.id}: ${telefone}`);
            return { sucesso: false, motivo: "Telefone inválido" };
        }
        
        const nomeCliente = agendamento.cliente || agendamento.nome || agendamento.clienteNome || 'Cliente';
        const data = formatarData(agendamento.data);
        const horario = formatarHorario(agendamento.horario);
        const profissional = agendamento.profissional || agendamento.barbeiroNome || 'Barbeiro Studio Nogueira';
        
        let servicos = [];
        let valorTotal = agendamento.valor || agendamento.valorTotal || 0;
        
        if (agendamento.servicos && Array.isArray(agendamento.servicos)) {
            servicos = agendamento.servicos.map(s => ({ nome: s.nome || s.servicoNome }));
        } else if (agendamento.servico) {
            servicos = [{ nome: agendamento.servico }];
        } else if (agendamento.servicoNome) {
            servicos = [{ nome: agendamento.servicoNome }];
        }
        
        let mensagem = '';
        if (tipo === 'vespera') {
            mensagem = gerarMensagemLembrete(nomeCliente, data, horario, profissional, servicos, valorTotal, 'vespera');
        } else if (tipo === 'confirmacao') {
            mensagem = gerarMensagemConfirmacao(nomeCliente, data, horario, profissional);
        } else {
            mensagem = gerarMensagemLembrete(nomeCliente, data, horario, profissional, servicos, valorTotal, 'dia');
        }
        
        const url = `https://wa.me/${telefoneLimpo}?text=${encodeURIComponent(mensagem)}`;
        window.open(url, '_blank');
        
        await addDoc(collection(db, "historico_lembretes"), {
            agendamentoId: agendamento.id,
            clienteId: agendamento.clienteId,
            clienteNome: nomeCliente,
            tipo: tipo,
            telefone: telefone,
            dataAgendamento: agendamento.data,
            horarioAgendamento: agendamento.horario,
            enviadoEm: Timestamp.now(),
            status: "enviado"
        });
        
        const agendamentoRef = doc(db, "agendamentos", agendamento.id);
        const campoAtualizar = tipo === 'vespera' ? 'lembreteVesperaEnviado' : (tipo === 'confirmacao' ? 'lembreteConfirmacaoEnviado' : 'lembreteDiaEnviado');
        await updateDoc(agendamentoRef, {
            [campoAtualizar]: true,
            ultimoLembreteEnviado: Timestamp.now()
        });
        
        console.log(`✅ Lembrete ${tipo} enviado com sucesso para ${nomeCliente}`);
        return { sucesso: true, mensagem: "Lembrete enviado com sucesso!" };
        
    } catch (error) {
        console.error("❌ Erro ao enviar lembrete:", error);
        return { sucesso: false, motivo: error.message };
    }
}

async function verificarLembretesAutomaticos() {
    const dataHoje = getDataAtual();
    const dataAmanha = (() => {
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        const ano = amanha.getFullYear();
        const mes = String(amanha.getMonth() + 1).padStart(2, '0');
        const dia = String(amanha.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    })();
    
    console.log(`🔍 Verificando lembretes para hoje (${dataHoje}) e amanhã (${dataAmanha})...`);
    
    try {
        const agora = new Date();
        const horaAtual = agora.getHours();
        
        const agendamentosRef = collection(db, "agendamentos");
        const statusAceitos = ["confirmado", "aguardando_pagamento"];
        
        if (horaAtual >= 8 && horaAtual <= 11) {
            const qDia = query(agendamentosRef, where("data", "==", dataHoje), where("status", "in", statusAceitos));
            const snapshotDia = await getDocs(qDia);
            
            for (const doc of snapshotDia.docs) {
                const agendamento = { id: doc.id, ...doc.data() };
                if (!agendamento.lembreteDiaEnviado) {
                    console.log(`📨 Enviando lembrete do dia para: ${agendamento.cliente || agendamento.nome}`);
                    await enviarLembreteWhatsApp(agendamento, 'dia');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
        if (horaAtual >= 20 && horaAtual <= 23) {
            const qVespera = query(agendamentosRef, where("data", "==", dataAmanha), where("status", "in", statusAceitos));
            const snapshotVespera = await getDocs(qVespera);
            
            for (const doc of snapshotVespera.docs) {
                const agendamento = { id: doc.id, ...doc.data() };
                if (!agendamento.lembreteVesperaEnviado) {
                    console.log(`📨 Enviando lembrete de véspera para: ${agendamento.cliente || agendamento.nome}`);
                    await enviarLembreteWhatsApp(agendamento, 'vespera');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
    } catch (error) {
        console.error("❌ Erro ao verificar lembretes automáticos:", error);
    }
}

// ==================== FUNÇÕES AUXILIARES PARA BUSCAR TELEFONE ====================

async function buscarTelefoneCliente(clienteId) {
    if (!clienteId) return null;
    try {
        const clienteDoc = await getDoc(doc(db, "clientes", clienteId));
        if (clienteDoc.exists()) {
            const dados = clienteDoc.data();
            return dados.telefone || dados.whatsapp || dados.celular || null;
        }
    } catch (error) {
        console.error("Erro ao buscar telefone do cliente:", error);
    }
    return null;
}

async function buscarTelefonePorNome(nomeCliente) {
    if (!nomeCliente) return null;
    try {
        const clientesQuery = query(collection(db, "clientes"), where("nome", "==", nomeCliente));
        const clientesSnap = await getDocs(clientesQuery);
        if (!clientesSnap.empty) {
            const dados = clientesSnap.docs[0].data();
            return dados.telefone || dados.whatsapp || dados.celular || null;
        }
    } catch (error) {
        console.error("Erro ao buscar telefone por nome:", error);
    }
    return null;
}

// ==================== FUNÇÕES DE FIDELIDADE ====================

async function getConfigFidelidade() {
    try {
        const configDoc = await getDoc(doc(db, "configuracoes", "fidelidade"));
        if (configDoc.exists()) {
            return configDoc.data();
        }
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
        return {
            pontosPorRealServico: 1,
            pontosPorRealProduto: 0.5,
            niveis: { bronze: 0, prata: 500, ouro: 1500, diamante: 5000 }
        };
    }
}

async function adicionarPontosFidelidade(clienteId, clienteNome, valorTotal, tipo = "servico") {
    try {
        if (!clienteId) {
            console.log("❌ Cliente ID não fornecido, não é possível adicionar pontos");
            return false;
        }

        const config = await getConfigFidelidade();

        let pontos = 0;
        if (tipo === "servico") {
            pontos = Math.floor(valorTotal * (config.pontosPorRealServico || 1));
        } else {
            pontos = Math.floor(valorTotal * (config.pontosPorRealProduto || 0.5));
        }

        if (pontos === 0) return false;

        console.log(`🎯 Adicionando ${pontos} pontos para ${clienteNome} (${tipo})`);

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
            console.log(`✅ Pontos atualizados: ${pontosAtuais} → ${pontosAtuais + pontos}`);
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
            console.log(`✅ Novo cliente criado no fidelidade com ${pontos} pontos`);
        }

        await addDoc(collection(db, "historico_pontos"), {
            clienteId: clienteId,
            clienteNome: clienteNome,
            quantidade: pontos,
            motivo: `Atendimento concluído - ${tipo === "servico" ? "Serviço" : "Produto"} no valor de ${formatarMoeda(valorTotal)}`,
            data: Timestamp.now()
        });

        mostrarToast(`🎉 +${pontos} pontos no programa de fidelidade!`, "sucesso");
        return true;

    } catch (error) {
        console.error("Erro ao adicionar pontos de fidelidade:", error);
        return false;
    }
}

// ==================== FUNÇÃO PARA IDENTIFICAR SE É PACOTE PELO NOME ====================

function isPacotePeloNome(nome) {
    if (!nome) return false;
    const nomeLower = nome.toLowerCase();
    const termosPacote = ['combo', 'pacote', 'kit', 'promoção', 'promocao', 'especial', 'premium pack', 'bundle'];
    return termosPacote.some(termo => nomeLower.includes(termo));
}

// ==================== FUNÇÃO PARA EXTRAIR ITENS E AGRUPAR PACOTES ====================

function extrairItensDoAgendamento(agendamento) {
    let itens = [];
    let valorTotal = 0;

    if (agendamento.pacoteInfo || agendamento.pacote) {
        const pacote = agendamento.pacoteInfo || agendamento.pacote;

        let precoOriginal = pacote.precoOriginal || pacote.precoTotalOriginal || pacote.preco || 0;
        let precoFinal = pacote.precoComDesconto || pacote.preco || 0;
        let descontoPercentual = pacote.descontoPercentual || 0;

        if (descontoPercentual === 0 && precoOriginal > precoFinal) {
            descontoPercentual = Math.round((1 - precoFinal / precoOriginal) * 100);
        }

        const servicosPacote = pacote.servicos || [];
        valorTotal = precoFinal;

        itens.push({
            id: pacote.id || pacote.pacoteId,
            nome: pacote.nome || "Pacote",
            quantidade: 1,
            precoOriginal: precoOriginal,
            precoFinal: precoFinal,
            descontoPercentual: descontoPercentual,
            descontoValor: precoOriginal - precoFinal,
            ehPacote: true,
            servicos: servicosPacote
        });

        return { itens, valorTotal };
    }

    if (agendamento.servicos && Array.isArray(agendamento.servicos) && agendamento.servicos.length > 0) {
        const primeiroItem = agendamento.servicos[0];

        if (agendamento.pacoteId || agendamento.pacote_nome || agendamento.pacoteNome) {
            const nomePacote = agendamento.pacote_nome || agendamento.pacoteNome || "Pacote";
            const precoOriginal = agendamento.valorOriginal || (agendamento.servicos.reduce((sum, s) => sum + (s.preco || 0), 0));
            const precoFinal = agendamento.valor || agendamento.precoTotal || precoOriginal;
            const descontoPercentual = agendamento.descontoPercentual || (precoOriginal > precoFinal ? Math.round((1 - precoFinal / precoOriginal) * 100) : 0);

            if (precoOriginal > precoFinal || descontoPercentual > 0) {
                itens.push({
                    id: agendamento.pacoteId,
                    nome: nomePacote,
                    quantidade: 1,
                    precoOriginal: precoOriginal,
                    precoFinal: precoFinal,
                    descontoPercentual: descontoPercentual,
                    descontoValor: precoOriginal - precoFinal,
                    ehPacote: true,
                    servicos: agendamento.servicos.map(s => ({ nome: s.nome, preco: s.preco }))
                });
                valorTotal = precoFinal;
                return { itens, valorTotal };
            }
        }

        if (primeiroItem && isPacotePeloNome(primeiroItem.nome)) {
            const precoOriginal = agendamento.servicos.reduce((sum, s) => sum + (s.precoOriginal || s.preco || 0), 0);
            const precoFinal = primeiroItem.preco || agendamento.valor || precoOriginal;
            const descontoPercentual = primeiroItem.descontoPercentual || (precoOriginal > precoFinal ? Math.round((1 - precoFinal / precoOriginal) * 100) : 0);

            itens.push({
                id: primeiroItem.id || primeiroItem.pacoteId,
                nome: primeiroItem.nome,
                quantidade: 1,
                precoOriginal: precoOriginal,
                precoFinal: precoFinal,
                descontoPercentual: descontoPercentual,
                descontoValor: precoOriginal - precoFinal,
                ehPacote: true,
                servicos: agendamento.servicos.map(s => ({ nome: s.nome, preco: s.precoOriginal || s.preco }))
            });
            valorTotal = precoFinal;
            return { itens, valorTotal };
        }

        const temDescontoGlobal = agendamento.servicos.some(s => (s.precoOriginal || 0) > (s.preco || 0));
        if (temDescontoGlobal && agendamento.servicos.length > 1) {
            const nomePacote = agendamento.pacoteNome || "Pacote Promocional";
            const precoOriginal = agendamento.servicos.reduce((sum, s) => sum + (s.precoOriginal || s.preco || 0), 0);
            const precoFinal = agendamento.servicos.reduce((sum, s) => sum + (s.preco || 0), 0);
            const descontoPercentual = Math.round((1 - precoFinal / precoOriginal) * 100);

            if (descontoPercentual > 0) {
                itens.push({
                    id: null,
                    nome: nomePacote,
                    quantidade: 1,
                    precoOriginal: precoOriginal,
                    precoFinal: precoFinal,
                    descontoPercentual: descontoPercentual,
                    descontoValor: precoOriginal - precoFinal,
                    ehPacote: true,
                    servicos: agendamento.servicos.map(s => ({ nome: s.nome, preco: s.precoOriginal || s.preco }))
                });
                valorTotal = precoFinal;
                return { itens, valorTotal };
            }
        }

        agendamento.servicos.forEach(item => {
            let precoOriginal = item.precoOriginal || item.preco || 0;
            let precoFinal = item.precoComDesconto || item.preco || 0;
            let descontoPercentual = item.descontoAplicado || item.descontoPercentual || 0;

            if (descontoPercentual === 0 && precoOriginal > precoFinal) {
                descontoPercentual = Math.round((1 - precoFinal / precoOriginal) * 100);
            }

            let quantidade = item.quantidade || 1;
            const valorItem = precoFinal * quantidade;
            valorTotal += valorItem;

            itens.push({
                id: item.id || item.servicoId,
                nome: item.nome || item.descricao || "Serviço",
                quantidade: quantidade,
                precoOriginal: precoOriginal,
                precoFinal: precoFinal,
                descontoPercentual: descontoPercentual,
                descontoValor: precoOriginal - precoFinal,
                ehPacote: false,
                servicos: []
            });
        });
    }

    if (itens.length === 0 && agendamento.valor) {
        itens.push({
            id: null,
            nome: agendamento.servicoNome || agendamento.servico || 'Atendimento',
            quantidade: 1,
            precoOriginal: agendamento.valor,
            precoFinal: agendamento.valor,
            descontoPercentual: 0,
            descontoValor: 0,
            ehPacote: false,
            servicos: []
        });
        valorTotal = agendamento.valor;
    }

    return { itens, valorTotal };
}

// ==================== SINCRONIZAR COMANDA COM AGENDAMENTO ====================

async function sincronizarComandaComAgendamento(comandaId, comandaData) {
    if (!comandaData.agendamentoId) return;

    try {
        const agendamentoRef = doc(db, "agendamentos", comandaData.agendamentoId);
        const agendamentoDoc = await getDoc(agendamentoRef);

        if (agendamentoDoc.exists()) {
            const agendamentoAtual = agendamentoDoc.data();

            const precisaAtualizar = JSON.stringify(agendamentoAtual.servicos) !== JSON.stringify(comandaData.servicos) ||
                JSON.stringify(agendamentoAtual.pacotes) !== JSON.stringify(comandaData.pacotes) ||
                agendamentoAtual.total !== comandaData.total;

            if (precisaAtualizar) {
                await updateDoc(agendamentoRef, {
                    servicos: comandaData.servicos || [],
                    pacotes: comandaData.pacotes || [],
                    valor: comandaData.total,
                    total: comandaData.total,
                    atualizadoEm: Timestamp.now()
                });
                console.log(`✅ Agendamento ${comandaData.agendamentoId} atualizado via comanda`);
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error("Erro ao sincronizar comanda com agendamento:", error);
        return false;
    }
}

// ==================== LISTENER DE COMANDAS ====================

function iniciarListenerComandas() {
    if (unsubscribeComandas) unsubscribeComandas();

    unsubscribeComandas = onSnapshot(collection(db, "comandas"), async (snapshot) => {
        let precisaAtualizar = false;

        for (const change of snapshot.docChanges()) {
            const comandaData = { id: change.doc.id, ...change.doc.data() };

            if (change.type === "modified") {
                const atualizado = await sincronizarComandaComAgendamento(change.doc.id, comandaData);
                if (atualizado) precisaAtualizar = true;
            }
        }

        if (precisaAtualizar && typeof aplicarFiltro === 'function') {
            console.log("🔄 Atualizando agenda devido a mudanças na comanda...");
            aplicarFiltro();
        }
    }, (error) => {
        console.error("Erro no listener de comandas:", error);
    });
}

// ==================== FUNÇÃO PARA CRIAR COMANDA COM PRÉ-LANÇAMENTOS ====================

async function criarComandaDoAgendamento(agendamento) {
    try {
        console.log("🚀 Criando comanda para agendamento:", agendamento.id);

        const comandaExistenteQuery = query(
            collection(db, "comandas"),
            where("agendamentoId", "==", agendamento.id)
        );
        const comandaExistente = await getDocs(comandaExistenteQuery);

        if (!comandaExistente.empty) {
            console.log("📝 Comanda já existe, retornando ID:", comandaExistente.docs[0].id);
            return comandaExistente.docs[0].id;
        }

        let clienteId = agendamento.clienteId;
        let clienteNome = agendamento.cliente || agendamento.nome || 'Cliente';

        if (!clienteId && (agendamento.cliente || agendamento.nome)) {
            const clientesQuery = query(collection(db, "clientes"), where("nome", "==", clienteNome));
            const clientesSnap = await getDocs(clientesQuery);
            if (!clientesSnap.empty) {
                clienteId = clientesSnap.docs[0].id;
                console.log(`🔍 Cliente encontrado pelo nome: ${clienteId}`);
            }
        }

        let profissionalId = agendamento.profissionalId || agendamento.profissional_id;
        let profissionalNome = agendamento.profissional || 'Barbeiro';

        if (!profissionalId && profissionalNome) {
            const profQuery = query(collection(db, "profissionais"), where("nome", "==", profissionalNome));
            const profSnap = await getDocs(profQuery);
            if (!profSnap.empty) {
                profissionalId = profSnap.docs[0].id;
            }
        }

        const { itens, valorTotal } = extrairItensDoAgendamento(agendamento);

        let servicosComanda = itens.filter(i => !i.ehPacote).map(i => ({
            servicoId: i.id,
            nome: i.nome,
            preco: i.precoFinal,
            quantidade: i.quantidade,
            tipo: "servico"
        }));

        let pacotesComanda = itens.filter(i => i.ehPacote).map(i => ({
            pacoteId: i.id,
            nome: i.nome,
            quantidade: i.quantidade,
            precoOriginal: i.precoOriginal,
            preco: i.precoFinal,
            descontoPercentual: i.descontoPercentual,
            descontoValor: i.descontoValor,
            tipo: "pacote",
            servicos: i.servicos
        }));

        let produtosPreLancamento = [];
        let lembretesIds = [];
        
        if (clienteId) {
            console.log(`🔍 Buscando pré-lançamentos pendentes para o cliente: ${clienteId}`);
            
            try {
                const lembretesQuery = query(
                    collection(db, "lembretes_comanda"), 
                    where("clienteId", "==", clienteId),
                    where("status", "==", "pendente")
                );
                const lembretesSnapshot = await getDocs(lembretesQuery);
                
                console.log(`📦 Encontrados ${lembretesSnapshot.size} pré-lançamentos pendentes para o cliente ${clienteId}`);
                
                for (const lembreteDoc of lembretesSnapshot.docs) {
                    const pre = lembreteDoc.data();
                    produtosPreLancamento.push({
                        produtoId: pre.produtoId,
                        nome: pre.produtoNome,
                        preco: pre.preco || 0,
                        quantidade: pre.quantidade || 1,
                        isPreLancamento: true,
                        afetaEstoque: false,
                        observacaoPreLancamento: pre.observacao || "",
                        lembreteId: lembreteDoc.id,
                        comandaOrigemId: pre.comandaOrigemId
                    });
                    lembretesIds.push(lembreteDoc.id);
                    console.log(`📦 Adicionado pré-lançamento pendente à nova comanda: ${pre.produtoNome} (x${pre.quantidade || 1})`);
                }
                
                if (produtosPreLancamento.length > 0) {
                    mostrarToast(`📦 ${produtosPreLancamento.length} produto(s) em pré-lançamento serão incluídos na comanda!`, "sucesso");
                }
            } catch (error) {
                console.error("Erro ao buscar pré-lançamentos do cliente:", error);
            }
        } else {
            console.log("⚠️ Cliente sem ID, não é possível buscar pré-lançamentos");
        }

        let statusComanda = "aberta";
        if (agendamento.status === 'concluido') statusComanda = "finalizada";
        else if (agendamento.status === 'cancelado') statusComanda = "cancelada";
        else if (agendamento.status === 'ausente') statusComanda = "cancelada";

        const dataAgendamento = agendamento.data || new Date().toISOString().split('T')[0];

        const comandaData = {
            agendamentoId: agendamento.id,
            clienteId: clienteId,
            clienteNome: clienteNome,
            barbeiroId: profissionalId,
            barbeiroNome: profissionalNome,
            servicos: servicosComanda,
            pacotes: pacotesComanda,
            produtos: produtosPreLancamento,
            total: valorTotal,
            status: statusComanda,
            observacoes: agendamento.observacaoGeral || `Agendamento para ${formatarData(agendamento.data)} às ${agendamento.horario}`,
            formaPagamento: "pendente",
            dataAgendamento: dataAgendamento,
            horarioAgendamento: agendamento.horario,
            dataCriacao: Timestamp.now(),
            updatedAt: Timestamp.now(),
            origem: "agendamento"
        };

        const comandaRef = await addDoc(collection(db, "comandas"), comandaData);
        console.log(`✅ Comanda criada com ID: ${comandaRef.id} - ${produtosPreLancamento.length} produtos em pré-lançamento incluídos`);

        await updateDoc(doc(db, "agendamentos", agendamento.id), {
            comandaId: comandaRef.id,
            atualizadoEm: Timestamp.now()
        });

        return comandaRef.id;

    } catch (error) {
        console.error("❌ Erro ao criar comanda:", error);
        return null;
    }
}

// ==================== FUNÇÃO PARA ABRIR COMANDA ====================

async function abrirComandaDoAgendamento(agendamentoId) {
    try {
        mostrarToast("Abrindo comanda...", "sucesso");

        const comandaQuery = query(collection(db, "comandas"), where("agendamentoId", "==", agendamentoId));
        let comandaSnap = await getDocs(comandaQuery);

        if (comandaSnap.empty) {
            mostrarToast("Criando comanda com pré-lançamentos...", "sucesso");
            const agendamentoDoc = await getDoc(doc(db, "agendamentos", agendamentoId));
            if (agendamentoDoc.exists()) {
                const comandaId = await criarComandaDoAgendamento({ id: agendamentoId, ...agendamentoDoc.data() });
                if (comandaId) {
                    window.location.href = `comanda.html?id=${comandaId}`;
                    return;
                }
            }
            mostrarToast("Erro ao criar comanda", "erro");
            return;
        }

        window.location.href = `comanda.html?id=${comandaSnap.docs[0].id}`;

    } catch (error) {
        console.error("Erro ao abrir comanda:", error);
        mostrarToast("Erro ao abrir comanda", "erro");
    }
}

// ==================== FUNÇÃO MARCAR COMO AUSENTE ====================

async function marcarComoAusente(id, agendamento) {
    try {
        await updateDoc(doc(db, "agendamentos", id), {
            status: "ausente",
            dataAusencia: Timestamp.now(),
            motivoAusencia: "Cliente não compareceu",
            atualizadoEm: Timestamp.now()
        });

        const comandaQuery = query(collection(db, "comandas"), where("agendamentoId", "==", id));
        const comandaSnap = await getDocs(comandaQuery);

        for (const docSnap of comandaSnap.docs) {
            await updateDoc(doc(db, "comandas", docSnap.id), {
                status: "ausente",
                justificativaAusencia: "Cliente não compareceu",
                dataAusencia: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            console.log(`✅ Comanda ${docSnap.id} atualizada para status "ausente"`);
        }

        let telefone = agendamento.telefone ||
            agendamento.whatsapp ||
            agendamento.celular ||
            agendamento.contato ||
            (agendamento.clienteId ? await buscarTelefoneCliente(agendamento.clienteId) : null);

        if (!telefone && (agendamento.cliente || agendamento.nome)) {
            telefone = await buscarTelefonePorNome(agendamento.cliente || agendamento.nome);
        }

        const nomeCliente = agendamento.cliente || agendamento.nome || 'cliente';
        const dataFormatada = formatarData(agendamento.data);
        const horario = agendamento.horario || '--:00';

        if (telefone) {
            const telefoneLimpo = telefone.toString().replace(/\D/g, "");
            if (telefoneLimpo.length >= 10 && telefoneLimpo.length <= 11) {
                const mensagem = `*🏢 STUDIO NOGUEIRA* - *AVISO DE AUSÊNCIA*\n\nOlá, *${nomeCliente}*!\n\nFicamos tristes em termos que informar pela sua ausência em nossa barbearia:\n\n📅 *Data:* ${dataFormatada}\n⏰ *Horário:* ${horario}\n\n✨ *Para remarcar seu horário*, entre em contato conosco:\n📞 (83) 9 8661-7303\n\nEstamos à disposição para atendê-lo(a)!\n\n*Studio Nogueira* - Mais de 10 anos transformando estilos. ✂️💈`;

                window.open(`https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
                mostrarToast(`Cliente marcado como ausente e notificado por WhatsApp!`, "sucesso");
            } else {
                mostrarToast(`Cliente marcado como ausente (telefone inválido: ${telefoneLimpo})`, "sucesso");
            }
        } else {
            mostrarToast(`Cliente marcado como ausente! (sem telefone cadastrado para enviar mensagem)`, "sucesso");
        }

        setTimeout(() => aplicarFiltro(), 500);

    } catch (error) {
        console.error("Erro ao marcar como ausente:", error);
        mostrarToast("Erro ao marcar ausência", "erro");
    }
}

// ==================== FUNÇÃO CONCLUIR AGENDAMENTO ====================

async function concluirAgendamento(id, agendamento) {
    try {
        console.log("🔵 ========== INICIANDO CONCLUSÃO DO AGENDAMENTO ==========");
        console.log("📋 Agendamento ID:", id);
        console.log("👤 Cliente:", agendamento.cliente || agendamento.nome);
        console.log("🆔 Cliente ID:", agendamento.clienteId);
        
        const comandaQuery = query(collection(db, "comandas"), where("agendamentoId", "==", id));
        const comandaSnap = await getDocs(comandaQuery);
        
        let comandaData = null;
        let comandaId = null;
        
        if (!comandaSnap.empty) {
            comandaId = comandaSnap.docs[0].id;
            comandaData = { id: comandaId, ...comandaSnap.docs[0].data() };
            console.log("📦 Comanda encontrada:", comandaId);
            console.log("📦 Produtos na comanda:", comandaData.produtos?.length || 0);
            
            if (comandaData.produtos && comandaData.produtos.length > 0) {
                console.log("📦 Processando produtos da comanda:", comandaData.produtos.length);
                
                for (const item of comandaData.produtos) {
                    if (item.isPreLancamento) {
                        console.log(`⏭️ Produto ${item.nome} é pré-lançamento - estoque não afetado agora`);
                        continue;
                    }
                    
                    if (!item.produtoId) {
                        console.log(`⚠️ Produto ${item.nome} não tem produtoId, pulando...`);
                        continue;
                    }
                    
                    try {
                        const produtoRef = doc(db, "produtos", item.produtoId);
                        const produtoDoc = await getDoc(produtoRef);
                        
                        if (produtoDoc.exists()) {
                            const produtoData = produtoDoc.data();
                            const quantidadeSolicitada = item.quantidade || 1;
                            const quantidadeAtual = produtoData.quantidade || 0;
                            
                            if (quantidadeAtual >= quantidadeSolicitada) {
                                const novaQuantidade = quantidadeAtual - quantidadeSolicitada;
                                
                                await updateDoc(produtoRef, {
                                    quantidade: novaQuantidade,
                                    updatedAt: Timestamp.now()
                                });
                                
                                console.log(`✅ Estoque atualizado: ${item.nome} - ${quantidadeAtual} → ${novaQuantidade}`);
                                
                                await addDoc(collection(db, "movimentacoes"), {
                                    produtoId: item.produtoId,
                                    produtoNome: item.nome,
                                    tipo: "saida",
                                    quantidade: quantidadeSolicitada,
                                    quantidadeAnterior: quantidadeAtual,
                                    quantidadeNova: novaQuantidade,
                                    observacao: `Venda via comanda #${comandaData.numeroComanda || comandaId.slice(-6)} - Agendamento concluído`,
                                    data: Timestamp.now(),
                                    usuario: "Sistema (Agenda)"
                                });
                            } else {
                                console.warn(`⚠️ Estoque insuficiente para ${item.nome}: tem ${quantidadeAtual}, precisa ${quantidadeSolicitada}`);
                                mostrarToast(`⚠️ Estoque insuficiente para ${item.nome}!`, "erro");
                            }
                        }
                    } catch (err) {
                        console.error(`❌ Erro ao processar produto ${item.nome}:`, err);
                    }
                }
            }
            
            const produtosPreLancamento = (comandaData.produtos || []).filter(p => p.isPreLancamento === true);
            console.log(`📦 Encontrados ${produtosPreLancamento.length} produtos de pré-lançamento na comanda para salvar como lembretes`);
            
            for (const item of produtosPreLancamento) {
                console.log(`📦 Processando pré-lançamento: ${item.nome}`, item);
                
                const clienteIdParaLembrete = comandaData.clienteId || agendamento.clienteId;
                
                if (!clienteIdParaLembrete) {
                    console.error(`❌ Não é possível salvar pré-lançamento - Cliente ID não encontrado para: ${item.nome}`);
                    continue;
                }
                
                const lembretesExistentesQuery = query(
                    collection(db, "lembretes_comanda"),
                    where("clienteId", "==", clienteIdParaLembrete),
                    where("produtoId", "==", item.produtoId),
                    where("status", "==", "pendente")
                );
                const lembretesExistentes = await getDocs(lembretesExistentesQuery);
                
                if (lembretesExistentes.empty) {
                    const lembreteData = {
                        comandaOrigemId: comandaId,
                        clienteId: clienteIdParaLembrete,
                        produtoId: item.produtoId,
                        produtoNome: item.nome,
                        preco: item.preco || 0,
                        quantidade: item.quantidade || 1,
                        observacao: item.observacaoPreLancamento || `Pré-lançamento adicionado em ${new Date().toLocaleDateString('pt-BR')}`,
                        status: "pendente",
                        dataCriacao: Timestamp.now()
                    };
                    
                    const lembreteRef = await addDoc(collection(db, "lembretes_comanda"), lembreteData);
                    console.log(`✅ PRÉ-LANÇAMENTO SALVO! ID: ${lembreteRef.id} - Produto: ${item.nome} - Cliente: ${clienteIdParaLembrete}`);
                } else {
                    console.log(`⏭️ Pré-lançamento já existe: ${item.nome}`);
                }
            }
            
            await updateDoc(doc(db, "comandas", comandaId), {
                status: "finalizada",
                dataFinalizacao: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            console.log(`✅ Comanda ${comandaId} atualizada para status "finalizada"`);
        } else {
            console.log("⚠️ Nenhuma comanda encontrada para este agendamento");
        }
        
        await updateDoc(doc(db, "agendamentos", id), {
            status: "concluido",
            dataConclusao: Timestamp.now(),
            atualizadoEm: Timestamp.now()
        });
        
        if (agendamento.clienteId || agendamento.cliente) {
            let clienteId = agendamento.clienteId;
            let clienteNome = agendamento.cliente || agendamento.nome;
            
            if (!clienteId && clienteNome) {
                const clientesQuery = query(collection(db, "clientes"), where("nome", "==", clienteNome));
                const clientesSnap = await getDocs(clientesQuery);
                if (!clientesSnap.empty) {
                    clienteId = clientesSnap.docs[0].id;
                }
            }
            
            if (clienteId) {
                const { valorTotal } = extrairItensDoAgendamento(agendamento);
                if (valorTotal > 0) {
                    await adicionarPontosFidelidade(clienteId, clienteNome, valorTotal, "servico");
                }
            }
        }
        
        const nomeCliente = agendamento.cliente || agendamento.nome || 'Cliente';
        const profissionalNome = agendamento.profissional || 'Barbeiro';
        
        let servicoNome = 'Atendimento';
        if (agendamento.servicos && Array.isArray(agendamento.servicos) && agendamento.servicos.length > 0) {
            servicoNome = agendamento.servicos[0].nome || agendamento.servicos[0].servicoNome || 'Atendimento';
        } else if (agendamento.servico) {
            servicoNome = agendamento.servico;
        } else if (agendamento.servicoNome) {
            servicoNome = agendamento.servicoNome;
        }
        
        try {
            const avaliacoesRef = collection(db, "avaliacoes");
            const existingQuery = query(avaliacoesRef, where("agendamentoId", "==", id));
            const existingSnapshot = await getDocs(existingQuery);
            
            if (existingSnapshot.empty) {
                const novaAvaliacao = {
                    agendamentoId: id,
                    clienteNome: nomeCliente,
                    servicoNome: servicoNome,
                    profissionalId: agendamento.profissionalId || null,
                    profissionalNome: profissionalNome,
                    nota: 0,
                    comentario: '',
                    status: "pendente",
                    dataCriacao: Timestamp.now()
                };
                await addDoc(avaliacoesRef, novaAvaliacao);
                console.log("✅ Nova avaliação criada!");
            }
        } catch (error) {
            console.error("❌ Erro ao criar avaliação:", error);
        }
        
        const baseUrl = "https://studionogueira.vercel.app";
        const clienteEncoded = encodeURIComponent(nomeCliente);
        const servicoEncoded = encodeURIComponent(servicoNome);
        const avaliacaoUrl = `${baseUrl}/avaliacao.html?agendamentoId=${id}&cliente=${clienteEncoded}&servico=${servicoEncoded}`;
        
        console.log("🔗 Link de avaliação gerado:", avaliacaoUrl);
        
        let telefone = agendamento.telefone ||
            agendamento.whatsapp ||
            agendamento.celular ||
            agendamento.contato ||
            (agendamento.clienteId ? await buscarTelefoneCliente(agendamento.clienteId) : null);
        
        if (!telefone && (agendamento.cliente || agendamento.nome)) {
            telefone = await buscarTelefonePorNome(agendamento.cliente || agendamento.nome);
        }
        
        const { valorTotal } = extrairItensDoAgendamento(agendamento);
        
        if (telefone) {
            const telefoneLimpo = telefone.toString().replace(/\D/g, "");
            if (telefoneLimpo.length >= 10 && telefoneLimpo.length <= 11) {
                const mensagem = `*🏢 STUDIO NOGUEIRA* - *ATENDIMENTO REALIZADO!* ✅\n\nOlá, *${nomeCliente}*!\n\nSeu atendimento foi *REALIZADO COM SUCESSO*! ✂️💈\n\n👨‍🦱 *Barbeiro:* ${profissionalNome}\n✂️ *Serviço:* ${servicoNome}\n💰 *Valor:* ${formatarMoeda(valorTotal)}\n\n⭐ *AVALIE NOSSO ATENDIMENTO!* ⭐\nSua opinião é muito importante para nós!\n🔗 ${avaliacaoUrl}\n\n💝 *Programa Fidelidade:* Acumule pontos e ganhe recompensas!\n\n*Studio Nogueira* - Mais de 10 anos transformando estilos. ✂️💈`;
                
                window.open(`https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
                mostrarToast(`🎉 Atendimento concluído! Link de avaliação enviado para o cliente.`, "sucesso");
            } else {
                mostrarToast(`🎉 Atendimento concluído! Link: ${avaliacaoUrl}`, "sucesso");
            }
        } else {
            mostrarToast(`🎉 Atendimento concluído! Link de avaliação: ${avaliacaoUrl}`, "sucesso");
        }
        
        if (comandaId) {
            window.dispatchEvent(new CustomEvent('pagamentoAtualizado', { 
                detail: { 
                    comandaId: comandaId, 
                    action: 'agendamento_concluido',
                    timestamp: Date.now(),
                    source: 'agenda.js'
                }
            }));
        }
        
        setTimeout(() => aplicarFiltro(), 1000);
        console.log("🔵 ========== CONCLUSÃO DO AGENDAMENTO FINALIZADA ==========");
        
    } catch (error) {
        console.error("❌ Erro ao concluir agendamento:", error);
        mostrarToast("Erro ao concluir agendamento: " + error.message, "erro");
    }
}

// ==================== FUNÇÃO CANCELAR AGENDAMENTO ====================

async function cancelarAgendamento(id, agendamento) {
    try {
        await updateDoc(doc(db, "agendamentos", id), {
            status: "cancelado",
            motivoCancelamento: agendamento.motivoCancelamento || "Cancelado pelo barbeiro",
            dataCancelamento: Timestamp.now(),
            atualizadoEm: Timestamp.now()
        });

        const comandaQuery = query(collection(db, "comandas"), where("agendamentoId", "==", id));
        const comandaSnap = await getDocs(comandaQuery);

        for (const docSnap of comandaSnap.docs) {
            await updateDoc(doc(db, "comandas", docSnap.id), {
                status: "cancelado",
                justificativaCancelamento: agendamento.motivoCancelamento || "Cancelado via agenda",
                dataCancelamento: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            console.log(`✅ Comanda ${docSnap.id} atualizada para status "cancelado"`);
        }

        let telefone = agendamento.telefone ||
            agendamento.whatsapp ||
            agendamento.celular ||
            agendamento.contato ||
            (agendamento.clienteId ? await buscarTelefoneCliente(agendamento.clienteId) : null);

        if (!telefone && (agendamento.cliente || agendamento.nome)) {
            telefone = await buscarTelefonePorNome(agendamento.cliente || agendamento.nome);
        }

        const nomeCliente = agendamento.cliente || agendamento.nome || 'cliente';
        const dataFormatada = formatarData(agendamento.data);
        const horario = agendamento.horario || '--:00';
        const profissional = agendamento.profissional || 'barbeiro';

        if (telefone) {
            const telefoneLimpo = telefone.toString().replace(/\D/g, "");
            if (telefoneLimpo.length >= 10 && telefoneLimpo.length <= 11) {
                const mensagem = `*🏢 STUDIO NOGUEIRA* - *CANCELAMENTO DE AGENDAMENTO*\n\nOlá, *${nomeCliente}*!\n\nInformamos que seu agendamento foi *CANCELADO* conforme solicitado.\n\n📅 *Data original:* ${dataFormatada}\n⏰ *Horário:* ${horario}\n👨‍🦱 *Barbeiro:* ${profissional}\n\n✨ *Para remarcar seu horário*, acesse nosso link:\n🔗 https://studionogueira.vercel.app/agendamento.html\n\nOu entre em contato conosco:\n📞 (83) 9 8661-7303\n\nAgradecemos a compreensão e estamos à disposição!\n\n*Studio Nogueira* - Mais de 10 anos transformando estilos. ✂️💈`;

                window.open(`https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
                mostrarToast(`❌ Agendamento cancelado! Mensagem enviada para o cliente.`, "sucesso");
            } else {
                mostrarToast(`❌ Agendamento cancelado! (telefone inválido)`, "sucesso");
            }
        } else {
            mostrarToast(`❌ Agendamento cancelado! (sem telefone para notificar)`, "sucesso");
        }

        setTimeout(() => aplicarFiltro(), 500);

    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        mostrarToast("Erro ao cancelar agendamento", "erro");
    }
}

// ==================== CRIAR LINHA DA TABELA (FORMATO HORIZONTAL COM DIA DA SEMANA CORRIGIDO) ====================

function criarLinhaAgendamento(agendamento) {
    const tr = document.createElement('tr');
    tr.className = 'appointment-row';
    tr.setAttribute('data-id', agendamento.id);
    tr.setAttribute('data-status', agendamento.status || '');

    const dataFormatada = formatarData(agendamento.data);
    const diaSemana = obterDiaSemana(agendamento.data);
    const horario = agendamento.horario || '--:00';
    const cliente = agendamento.cliente || agendamento.nome || 'Cliente';
    const telefone = agendamento.telefone || agendamento.whatsapp || '';
    const profissional = agendamento.profissional || 'Barbeiro';
    const profissionalInicial = profissional.charAt(0).toUpperCase();

    const { itens, valorTotal } = extrairItensDoAgendamento(agendamento);
    const temPacote = itens.some(i => i.ehPacote);
    const totalEconomia = itens.reduce((sum, i) => sum + (i.descontoValor || 0), 0);

    let servicosHtml = '';
    let servicosDetalheHtml = '';

    if (itens.length > 0) {
        const servicosPrincipais = itens.slice(0, 2);
        const servicosRestantes = itens.length - 2;
        
        servicosHtml = `
            <div class="servicos-list">
                ${servicosPrincipais.map(item => {
                    if (item.ehPacote) {
                        return `<span class="pacote-tag"><i class="fa-solid fa-gift"></i> ${escapeHtml(item.nome)}</span>`;
                    }
                    return `<span class="servico-tag"><i class="fa-solid fa-cut"></i> ${escapeHtml(item.nome)}</span>`;
                }).join('')}
                ${servicosRestantes > 0 ? `<span class="servico-tag">+${servicosRestantes} outro(s)</span>` : ''}
            </div>
        `;
        
        if (itens.length > 2 || temPacote) {
            servicosDetalheHtml = `
                <div class="servicos-detalhe">
                    ${itens.map(item => {
                        if (item.ehPacote) {
                            const qtdServicos = item.servicos?.length || 0;
                            return `<span><i class="fa-solid fa-box"></i> ${escapeHtml(item.nome)} (${qtdServicos} serviços)</span>`;
                        }
                        return `<span><i class="fa-solid fa-cut"></i> ${escapeHtml(item.nome)}</span>`;
                    }).join(' · ')}
                </div>
            `;
        }
    } else {
        servicosHtml = '<span class="servico-tag">Atendimento</span>';
    }

    let valorHtml = '';
    if (temPacote && totalEconomia > 0) {
        valorHtml = `
            <div class="valor-info">
                <span class="valor-total">${formatarMoeda(valorTotal)}</span>
                <span class="valor-desconto"><i class="fa-solid fa-tag"></i> Economia: ${formatarMoeda(totalEconomia)}</span>
                ${itens.some(i => i.precoOriginal > i.precoFinal) ? 
                    `<span class="valor-original">De: ${formatarMoeda(itens.reduce((s,i) => s + i.precoOriginal, 0))}</span>` : ''}
            </div>
        `;
    } else {
        valorHtml = `<div class="valor-info"><span class="valor-total">${formatarMoeda(valorTotal)}</span></div>`;
    }

    let botoesAcao = '';
    if (agendamento.status === 'confirmado') {
        botoesAcao = `
            <div class="appointment-actions">
                <button class="btn-status concluir" data-id="${agendamento.id}">
                    <i class="fa-regular fa-circle-check"></i> Concluir
                </button>
                <button class="btn-status ausentar" data-id="${agendamento.id}">
                    <i class="fa-regular fa-clock"></i> Ausente
                </button>
                <button class="btn-status cancelar" data-id="${agendamento.id}">
                    <i class="fa-regular fa-circle-xmark"></i> Cancelar
                </button>
                <button class="btn-status lembrete-dia" data-id="${agendamento.id}" data-tipo="dia">
                    <i class="fa-regular fa-bell"></i> Hoje
                </button>
                <button class="btn-status lembrete-vespera" data-id="${agendamento.id}" data-tipo="vespera">
                    <i class="fa-regular fa-clock"></i> Véspera
                </button>
                <button class="btn-status ver-comanda" data-id="${agendamento.id}">
                    <i class="fa-solid fa-receipt"></i> Comanda
                </button>
            </div>
        `;
    } else {
        botoesAcao = `
            <div class="appointment-actions">
                <button class="btn-status ver-comanda" data-id="${agendamento.id}">
                    <i class="fa-solid fa-receipt"></i> Ver Comanda
                </button>
            </div>
        `;
    }

    tr.innerHTML = `
        <td class="col-cliente">
            <div class="cliente-info">
                <span class="cliente-nome">${escapeHtml(cliente)}</span>
                ${telefone ? `<span class="cliente-telefone"><i class="fa-brands fa-whatsapp"></i> ${escapeHtml(telefone)}</span>` : ''}
            </div>
        </td>
        <td class="col-data-hora">
            <div class="data-info">
                <span class="data">${dataFormatada}</span>
                ${diaSemana ? `<span class="dia-semana"><i class="fa-regular fa-calendar-alt"></i> ${diaSemana}</span>` : ''}
                <span class="hora"><i class="fa-regular fa-clock"></i> ${escapeHtml(horario)}</span>
            </div>
        </td>
        <td class="col-profissional">
            <div class="profissional-info">
                <div class="profissional-avatar">${escapeHtml(profissionalInicial)}</div>
                <span class="profissional-nome">${escapeHtml(profissional)}</span>
            </div>
        </td>
        <td class="col-servicos">
            ${servicosHtml}
            ${servicosDetalheHtml}
        </td>
        <td class="col-valor">
            ${valorHtml}
        </td>
        <td class="col-acoes">
            ${botoesAcao}
        </td>
    `;

    tr.querySelector('.concluir')?.addEventListener('click', (e) => {
        e.stopPropagation();
        concluirAgendamento(agendamento.id, agendamento);
    });
    tr.querySelector('.ausentar')?.addEventListener('click', (e) => {
        e.stopPropagation();
        marcarComoAusente(agendamento.id, agendamento);
    });
    tr.querySelector('.cancelar')?.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelarAgendamento(agendamento.id, agendamento);
    });
    tr.querySelector('.lembrete-dia')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const resultado = await enviarLembreteWhatsApp(agendamento, 'dia');
        if (resultado.sucesso) {
            mostrarToast(resultado.mensagem, 'sucesso');
        } else {
            mostrarToast(`Erro: ${resultado.motivo}`, 'erro');
        }
    });
    tr.querySelector('.lembrete-vespera')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const resultado = await enviarLembreteWhatsApp(agendamento, 'vespera');
        if (resultado.sucesso) {
            mostrarToast(resultado.mensagem, 'sucesso');
        } else {
            mostrarToast(`Erro: ${resultado.motivo}`, 'erro');
        }
    });
    tr.querySelector('.ver-comanda')?.addEventListener('click', (e) => {
        e.stopPropagation();
        abrirComandaDoAgendamento(agendamento.id);
    });

    return tr;
}

// ==================== FUNÇÕES AUXILIARES ====================

function isDataNoPeriodo(dataAgendamento, inicio, fim) {
    if (!dataAgendamento) return false;
    
    let dataStr;
    if (typeof dataAgendamento === 'string') {
        dataStr = dataAgendamento;
    } else if (dataAgendamento.toDate) {
        dataStr = dataAgendamento.toDate().toISOString().split('T')[0];
    } else {
        return false;
    }
    
    if (dataStr.includes('/')) {
        const [dia, mes, ano] = dataStr.split('/');
        dataStr = `${ano}-${mes}-${dia}`;
    }
    
    return dataStr >= inicio && dataStr <= fim;
}

// ==================== FUNÇÃO PARA APLICAR FILTRO (VERSÃO TABELA) ====================

function aplicarFiltro() {
    if (unsubscribe) unsubscribe();

    let dInicio = dataInicio ? dataInicio.value : '';
    let dFim = dataFim ? dataFim.value : '';

    const filtroPersonalizado = (dInicio && dInicio !== '') || (dFim && dFim !== '');
    
    if (!filtroPersonalizado) {
        const dataAtual = getDataAtual();
        dInicio = dataAtual;
        dFim = dataAtual;
        console.log(`📅 Exibindo apenas agendamentos do dia atual: ${dataAtual}`);
    } else {
        if (dInicio && !dFim) dFim = dInicio;
        if (!dInicio && dFim) dInicio = dFim;
        console.log(`📅 Aplicando filtro personalizado: ${dInicio} até ${dFim}`);
    }

    const q = query(collection(db, "agendamentos"));

    unsubscribe = onSnapshot(q, (snapshot) => {
        const containers = {
            confirmado: { div: confirmadosDiv, rows: [], count: 0 },
            concluido: { div: concluidosDiv, rows: [], count: 0 },
            ausente: { div: ausentesDiv, rows: [], count: 0 },
            cancelado: { div: canceladosDiv, rows: [], count: 0 }
        };

        const agendamentosList = [];

        snapshot.forEach(docSnap => {
            const data = { id: docSnap.id, ...docSnap.data() };
            const dataAgendamento = data.data;
            
            let dataValida = false;
            if (dInicio && dFim && dataAgendamento) {
                dataValida = isDataNoPeriodo(dataAgendamento, dInicio, dFim);
            }

            if (dataValida) {
                agendamentosList.push(data);
            }
        });

        agendamentosList.sort((a, b) => {
            const dateA = a.data ? (typeof a.data === 'string' ? a.data : (a.data.toDate ? a.data.toDate().toISOString().split('T')[0] : '')) : '';
            const dateB = b.data ? (typeof b.data === 'string' ? b.data : (b.data.toDate ? b.data.toDate().toISOString().split('T')[0] : '')) : '';
            if (dateA !== dateB) {
                return dateA.localeCompare(dateB);
            }
            const horarioA = a.horario || '00:00';
            const horarioB = b.horario || '00:00';
            return horarioA.localeCompare(horarioB);
        });

        console.log(`📊 Agendamentos carregados - Total no período: ${agendamentosList.length}`);

        for (const [statusKey, container] of Object.entries(containers)) {
            if (container.div) {
                const table = document.createElement('table');
                table.className = 'appointments-table';
                
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th class="col-cliente">Cliente</th>
                            <th class="col-data-hora">Data/Horário</th>
                            <th class="col-profissional">Profissional</th>
                            <th class="col-servicos">Serviços</th>
                            <th class="col-valor">Valor</th>
                            <th class="col-acoes">Ações</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                `;
                
                const tbody = table.querySelector('tbody');
                
                for (const data of agendamentosList) {
                    let statusMatch = false;
                    
                    if (statusKey === 'confirmado' && (data.status === 'confirmado' || !data.status)) statusMatch = true;
                    else if (statusKey === 'concluido' && data.status === 'concluido') statusMatch = true;
                    else if (statusKey === 'ausente' && data.status === 'ausente') statusMatch = true;
                    else if (statusKey === 'cancelado' && data.status === 'cancelado') statusMatch = true;
                    
                    if (statusMatch) {
                        const row = criarLinhaAgendamento(data);
                        tbody.appendChild(row);
                        container.count++;
                    }
                }
                
                container.div.innerHTML = '';
                if (container.count > 0) {
                    container.div.appendChild(table);
                } else {
                    const emptyMessage = document.createElement('div');
                    emptyMessage.className = 'empty-agenda';
                    let mensagemVazio = '';
                    const dataInicioFormatada = formatarData(dInicio);
                    const dataFimFormatada = formatarData(dFim);
                    if (filtroPersonalizado && dInicio !== dFim) {
                        mensagemVazio = `<i class="fa-regular fa-calendar"></i><p>Nenhum agendamento encontrado no período de ${dataInicioFormatada} até ${dataFimFormatada}</p>`;
                    } else if (filtroPersonalizado) {
                        mensagemVazio = `<i class="fa-regular fa-calendar"></i><p>Nenhum agendamento encontrado para ${dataInicioFormatada}</p>`;
                    } else {
                        mensagemVazio = `<i class="fa-regular fa-calendar"></i><p>Nenhum agendamento para hoje (${dataInicioFormatada})</p>`;
                    }
                    emptyMessage.innerHTML = mensagemVazio;
                    container.div.appendChild(emptyMessage);
                }
            }
        }

        if (countConfirmado) countConfirmado.textContent = containers.confirmado.count;
        if (countConcluido) countConcluido.textContent = containers.concluido.count;
        if (countAusente) countAusente.textContent = containers.ausente.count;
        if (countCancelado) countCancelado.textContent = containers.cancelado.count;
    });
}

// ==================== FUNÇÃO PARA FORÇAR ATUALIZAÇÃO DA AGENDA ====================

window.atualizarAgenda = function () {
    console.log("🔄 Forçando atualização da agenda...");
    aplicarFiltro();
};

// ==================== FUNÇÃO PARA ENVIAR LEMBRETE MANUALMENTE ====================

window.enviarLembreteManual = async function(agendamentoId, tipo = 'dia') {
    try {
        const agendamentoDoc = await getDoc(doc(db, "agendamentos", agendamentoId));
        if (!agendamentoDoc.exists()) {
            return { sucesso: false, motivo: "Agendamento não encontrado" };
        }
        const agendamento = { id: agendamentoId, ...agendamentoDoc.data() };
        return await enviarLembreteWhatsApp(agendamento, tipo);
    } catch (error) {
        console.error("Erro ao enviar lembrete manual:", error);
        return { sucesso: false, motivo: error.message };
    }
};

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

// ==================== FUNÇÃO PARA VERIFICAR LEMBRETES AUTOMATICAMENTE ====================

let intervaloLembretes = null;

function iniciarVerificacaoLembretes() {
    if (intervaloLembretes) clearInterval(intervaloLembretes);
    
    intervaloLembretes = setInterval(() => {
        verificarLembretesAutomaticos();
    }, 30 * 60 * 1000);
    
    setTimeout(() => {
        verificarLembretesAutomaticos();
    }, 60000);
    
    console.log("🕐 Sistema de verificação de lembretes iniciado (a cada 30 minutos)");
}

function pararVerificacaoLembretes() {
    if (intervaloLembretes) clearInterval(intervaloLembretes);
    console.log("🛑 Sistema de verificação de lembretes parado");
}

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log("📅 Agenda.js iniciado - Versão com LEMBRETES WHATSAPP, LAYOUT HORIZONTAL E DIA DA SEMANA CORRIGIDO");
    
    if (dataInicio) dataInicio.value = '';
    if (dataFim) dataFim.value = '';
    
    aplicarFiltro();
    iniciarListenerComandas();
    iniciarVerificacaoLembretes();
});

if (btnFiltrarPeriodo) btnFiltrarPeriodo.onclick = () => aplicarFiltro();
if (btnLimparPeriodo) btnLimparPeriodo.onclick = () => {
    if (dataInicio) dataInicio.value = '';
    if (dataFim) dataFim.value = '';
    aplicarFiltro();
};

if (btnSincronizarComandas) {
    btnSincronizarComandas.onclick = async () => {
        mostrarToast("Sincronizando comandas com pré-lançamentos...", "sucesso");
        const agendamentosQuery = query(collection(db, "agendamentos"), where("status", "==", "confirmado"));
        const snapshot = await getDocs(agendamentosQuery);
        let count = 0;
        for (const doc of snapshot.docs) {
            const agendamento = { id: doc.id, ...doc.data() };
            const comandaId = await criarComandaDoAgendamento(agendamento);
            if (comandaId) count++;
        }
        mostrarToast(`Sincronização concluída! ${count} comandas criadas.`, "sucesso");
    };
}

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = 'login.html';
    else console.log("👤 Usuário autenticado:", user.email);
});

const logoutBtn = document.getElementById('logout');
if (logoutBtn) logoutBtn.onclick = async () => { await signOut(auth); window.location.href = 'login.html'; };

console.log("✅ Agenda.js carregado - Layout horizontal em tabela com dia da semana corrigido!");