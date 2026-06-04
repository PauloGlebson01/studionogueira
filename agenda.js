// agenda.js - Versão Corrigida com suporte a PRÉ-LANÇAMENTOS E LEMBRETES WHATSAPP
// Com sincronização em tempo real com comandas e atualização de estoque ao concluir

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
        
        // Lembretes do dia (manhã - entre 8h e 11h)
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
        
        // Lembretes de véspera (noite - entre 20h e 23h)
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
        
        const baseUrl = "https://barbearia-softclick.vercel.app";
        const clienteEncoded = encodeURIComponent(nomeCliente);
        const servicoEncoded = encodeURIComponent(servicoNome);
        const avaliacaoUrl = `${baseUrl}/avaliacao.html?agendamentoId=${id}&cliente=${clienteEncoded}&servico=${servicoEncoded}`;
        
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
                const mensagem = `*🏢 STUDIO NOGUEIRA* - *CANCELAMENTO DE AGENDAMENTO*\n\nOlá, *${nomeCliente}*!\n\nInformamos que seu agendamento foi *CANCELADO* conforme solicitado.\n\n📅 *Data original:* ${dataFormatada}\n⏰ *Horário:* ${horario}\n👨‍🦱 *Barbeiro:* ${profissional}\n\n✨ *Para remarcar seu horário*, acesse nosso link:\n🔗 https://barbeariasoftclick.vercel.app/agendar\n\nOu entre em contato conosco:\n📞 (83) 9 8661-7303\n\nAgradecemos a compreensão e estamos à disposição!\n\n*Studio Nogueira* - Mais de 10 anos transformando estilos. ✂️💈`;

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

// ==================== FUNÇÃO PARA RENDERIZAR SERVIÇOS DO PACOTE ====================

function renderizarServicosPacote(servicos) {
    if (!servicos || servicos.length === 0) return '';

    return `
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(245, 158, 11, 0.3);">
            <div style="font-size: 0.65rem; color: #f59e0b; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
                <i class="fa-solid fa-list-ul"></i> Serviços inclusos neste pacote:
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${servicos.map(s => `
                    <span style="background: rgba(245, 158, 11, 0.12); color: #f59e0b; padding: 3px 10px; border-radius: 20px; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fa-solid fa-cut" style="font-size: 0.55rem;"></i> ${escapeHtml(s.nome)}
                        ${s.preco ? `<span style="color: #94a3b8; margin-left: 4px;">${formatarMoeda(s.preco)}</span>` : ''}
                    </span>
                `).join('')}
            </div>
        </div>
    `;
}

// ==================== CRIAR CARD AGENDAMENTO ====================

function criarCardAgendamento(agendamento) {
    const card = document.createElement('div');
    card.className = 'appointment-card';
    card.setAttribute('data-id', agendamento.id);
    card.setAttribute('data-status', agendamento.status || '');

    const dataFormatada = formatarData(agendamento.data);
    const horario = agendamento.horario || '--:00';
    const cliente = agendamento.cliente || agendamento.nome || 'Cliente';
    const telefone = agendamento.telefone || agendamento.whatsapp || '';
    const profissional = agendamento.profissional || 'Barbeiro';
    const clienteId = agendamento.clienteId || '';

    const { itens, valorTotal } = extrairItensDoAgendamento(agendamento);

    let itensHtml = '';
    let totalEconomia = 0;

    itens.forEach(item => {
        totalEconomia += (item.descontoValor || 0);

        if (item.ehPacote) {
            itensHtml += `
                <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.02)); border-radius: 12px; padding: 12px; margin-top: 8px; border: 1px solid rgba(245, 158, 11, 0.2);">
                    <div style="display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                        <div style="background: rgba(245, 158, 11, 0.15); border-radius: 10px; padding: 6px 10px;">
                            <i class="fa-solid fa-gift" style="color: #f59e0b; font-size: 1rem;"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                                <strong style="color: #f59e0b; font-size: 0.9rem;">${escapeHtml(item.nome)}</strong>
                                <span style="font-size: 0.6rem; background: #f59e0b; color: #fff; padding: 2px 10px; border-radius: 20px; font-weight: 600;">
                                    <i class="fa-solid fa-tag"></i> PACOTE
                                </span>
                                ${item.descontoPercentual > 0 ? `<span style="font-size: 0.65rem; background: #10b98120; padding: 3px 10px; border-radius: 20px; color: #10b981; font-weight: 600;">🎯 ${item.descontoPercentual}% OFF</span>` : ''}
                            </div>
                            
                            ${item.descontoPercentual > 0 ? `
                                <div style="margin: 6px 0;">
                                    <span style="text-decoration: line-through; color: #94a3b8; font-size: 0.75rem;">De: ${formatarMoeda(item.precoOriginal)}</span>
                                    <strong style="color: #10b981; font-size: 1rem; margin-left: 10px;">Por: ${formatarMoeda(item.precoFinal)}</strong>
                                </div>
                                <div style="background: #10b98110; border-radius: 8px; padding: 6px 10px; margin: 6px 0;">
                                    <i class="fa-solid fa-coins" style="color: #10b981; font-size: 0.7rem;"></i>
                                    <span style="color: #10b981; font-size: 0.7rem; font-weight: 500;"> Cliente economiza ${formatarMoeda(item.descontoValor)} com este pacote!</span>
                                </div>
                            ` : `
                                <div style="margin: 6px 0;">
                                    <strong style="color: #f59e0b; font-size: 1rem;">${formatarMoeda(item.precoFinal)}</strong>
                                </div>
                            `}
                            
                            ${renderizarServicosPacote(item.servicos)}
                        </div>
                    </div>
                </div>
            `;
        } else if (item.descontoPercentual > 0) {
            itensHtml += `
                <div style="background: rgba(16, 185, 129, 0.05); border-radius: 8px; padding: 8px 10px; margin-top: 5px; border-left: 3px solid #10b981;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-cut" style="color: #10b981; font-size: 0.75rem;"></i>
                            <span style="font-size: 0.75rem;">${escapeHtml(item.nome)}</span>
                        </div>
                        <div>
                            <span style="text-decoration: line-through; color: #94a3b8; font-size: 0.7rem;">${formatarMoeda(item.precoOriginal)}</span>
                            <strong style="color: #10b981; font-size: 0.8rem; margin-left: 6px;">${formatarMoeda(item.precoFinal)}</strong>
                            <span style="font-size: 0.55rem; background: #10b98120; padding: 2px 6px; border-radius: 10px; margin-left: 5px;">-${item.descontoPercentual}%</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            itensHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; margin-top: 4px; background: rgba(33, 153, 239, 0.04); border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-cut" style="color: #2199EF; font-size: 0.7rem;"></i>
                        <span style="font-size: 0.75rem;">${escapeHtml(item.nome)}</span>
                    </div>
                    <strong style="color: #2199EF; font-size: 0.75rem;">${formatarMoeda(item.precoFinal)}</strong>
                </div>
            `;
        }
    });

    if (itensHtml === '') {
        itensHtml = '<div style="color: #94a3b8; padding: 12px; text-align: center;">Nenhum serviço selecionado</div>';
    }

    const temPacote = itens.some(i => i.ehPacote);

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
                    <i class="fa-regular fa-bell"></i> Lembrar Hoje
                </button>
                <button class="btn-status lembrete-vespera" data-id="${agendamento.id}" data-tipo="vespera">
                    <i class="fa-regular fa-clock"></i> Lembrar Véspera
                </button>
                <button class="btn-status ver-comanda" data-id="${agendamento.id}">
                    <i class="fa-solid fa-receipt"></i> Ver Comanda
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

    card.innerHTML = `
        <div class="appointment-header">
            <div>
                <strong class="cliente-nome">${escapeHtml(cliente)}</strong>
                ${temPacote ? `
                    <span style="background: #f59e0b; color: #fff; font-size: 0.6rem; padding: 2px 10px; border-radius: 20px; margin-left: 8px; font-weight: 600;">
                        <i class="fa-solid fa-gift"></i> PACOTE
                    </span>
                ` : ''}
                ${totalEconomia > 0 && temPacote ? `
                    <span style="background: #10b98120; color: #10b981; font-size: 0.6rem; padding: 2px 8px; border-radius: 20px; margin-left: 5px;">
                        💰 Economia: ${formatarMoeda(totalEconomia)}
                    </span>
                ` : ''}
            </div>
            <span class="appointment-time">${escapeHtml(horario)}</span>
        </div>
        <div class="appointment-details">
            <div class="detail-item">
                <i class="fa-regular fa-calendar"></i> ${dataFormatada}
            </div>
            <div class="detail-item" style="align-items: flex-start;">
                <i class="fa-solid fa-list" style="margin-top: 3px;"></i>
                <div style="flex: 1;">
                    <div style="font-size: 0.7rem; color: #64748b; margin-bottom: 8px; font-weight: 600;">
                        ${temPacote ? '📦 DETALHES DO PACOTE:' : '✂️ SERVIÇOS:'}
                    </div>
                    ${itensHtml}
                </div>
            </div>
            <div class="detail-item">
                <i class="fa-solid fa-user-nurse"></i> ${escapeHtml(profissional)}
            </div>
            <div class="detail-item" style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
                <i class="fa-solid fa-dollar-sign" style="color: #2199EF;"></i> 
                <strong style="color: #2199EF; font-size: 1rem;">TOTAL: ${formatarMoeda(valorTotal)}</strong>
            </div>
            ${telefone ? `<div class="detail-item"><i class="fa-brands fa-whatsapp"></i> ${escapeHtml(telefone)}</div>` : ''}
        </div>
        ${botoesAcao}
    `;

    card.querySelector('.concluir')?.addEventListener('click', (e) => {
        e.stopPropagation();
        concluirAgendamento(agendamento.id, agendamento);
    });
    card.querySelector('.ausentar')?.addEventListener('click', (e) => {
        e.stopPropagation();
        marcarComoAusente(agendamento.id, agendamento);
    });
    card.querySelector('.cancelar')?.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelarAgendamento(agendamento.id, agendamento);
    });
    card.querySelector('.lembrete-dia')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const resultado = await enviarLembreteWhatsApp(agendamento, 'dia');
        if (resultado.sucesso) {
            mostrarToast(resultado.mensagem, 'sucesso');
        } else {
            mostrarToast(`Erro: ${resultado.motivo}`, 'erro');
        }
    });
    card.querySelector('.lembrete-vespera')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const resultado = await enviarLembreteWhatsApp(agendamento, 'vespera');
        if (resultado.sucesso) {
            mostrarToast(resultado.mensagem, 'sucesso');
        } else {
            mostrarToast(`Erro: ${resultado.motivo}`, 'erro');
        }
    });
    card.querySelector('.ver-comanda')?.addEventListener('click', (e) => {
        e.stopPropagation();
        abrirComandaDoAgendamento(agendamento.id);
    });

    return card;
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

// ==================== FUNÇÃO PARA APLICAR FILTRO ====================

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
        if (confirmadosDiv) confirmadosDiv.innerHTML = '';
        if (concluidosDiv) concluidosDiv.innerHTML = '';
        if (ausentesDiv) ausentesDiv.innerHTML = '';
        if (canceladosDiv) canceladosDiv.innerHTML = '';

        let countConf = 0, countConc = 0, countAus = 0, countCanc = 0;
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

        console.log(`📊 Agendamentos carregados - Total no período: ${agendamentosList.length}, Período: ${dInicio} até ${dFim}`);

        for (const data of agendamentosList) {
            const card = criarCardAgendamento(data);

            if (data.status === 'confirmado') {
                confirmadosDiv?.appendChild(card);
                countConf++;
            } else if (data.status === 'concluido') {
                concluidosDiv?.appendChild(card);
                countConc++;
            } else if (data.status === 'ausente') {
                ausentesDiv?.appendChild(card);
                countAus++;
            } else if (data.status === 'cancelado') {
                canceladosDiv?.appendChild(card);
                countCanc++;
            } else {
                confirmadosDiv?.appendChild(card);
                countConf++;
            }
        }

        if (countConfirmado) countConfirmado.textContent = countConf;
        if (countConcluido) countConcluido.textContent = countConc;
        if (countAusente) countAusente.textContent = countAus;
        if (countCancelado) countCancelado.textContent = countCanc;

        if (agendamentosList.length === 0 && confirmadosDiv) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-agenda';
            let mensagemVazio = '';
            const dataInicioFormatada = formatarData(dInicio);
            const dataFimFormatada = formatarData(dFim);
            if (filtroPersonalizado && dInicio !== dFim) {
                mensagemVazio = `<i class="fa-regular fa-calendar"></i><p>Nenhum agendamento encontrado no período de ${dataInicioFormatada} até ${dataFimFormatada}</p><p style="font-size: 0.8rem; margin-top: 8px;">🔒 Use o filtro acima para visualizar outras datas</p>`;
            } else if (filtroPersonalizado) {
                mensagemVazio = `<i class="fa-regular fa-calendar"></i><p>Nenhum agendamento encontrado para ${dataInicioFormatada}</p><p style="font-size: 0.8rem; margin-top: 8px;">🔒 Use o filtro acima para visualizar outras datas</p>`;
            } else {
                mensagemVazio = `<i class="fa-regular fa-calendar"></i><p>Nenhum agendamento para hoje (${dataInicioFormatada})</p><p style="font-size: 0.8rem; margin-top: 8px;">🔒 Use o filtro acima para visualizar outras datas</p>`;
            }
            emptyMessage.innerHTML = mensagemVazio;
            confirmadosDiv.appendChild(emptyMessage);
        }
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

// ==================== FUNÇÃO PARA BUSCAR TELEFONE POR NOME ====================

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
    
    // Verificar a cada 30 minutos
    intervaloLembretes = setInterval(() => {
        verificarLembretesAutomaticos();
    }, 30 * 60 * 1000);
    
    // Executar primeira verificação após 1 minuto
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
    console.log("📅 Agenda.js iniciado - Versão com LEMBRETES WHATSAPP");
    
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

console.log("✅ Agenda.js carregado - Agora com suporte a LEMBRETES WHATSAPP!");