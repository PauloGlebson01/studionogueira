// agendamento.js - Versão CORRIGIDA DEFINITIVA
// CORREÇÃO: TODO agendamento existente bloqueia o horário para evitar dupla reserva
// Independente do status (confirmado, concluido, cancelado, etc)
// CORREÇÃO V2: Horários exibem apenas o horário de início (mantendo sincronização com duração)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs,
    Timestamp,
    doc,
    updateDoc,
    getDoc,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged 
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
const form = document.getElementById("formAgendamento");
const nomeInput = document.getElementById("nome");
const telefoneInput = document.getElementById("telefone");
const emailInput = document.getElementById("email");
const dataNascimentoInput = document.getElementById("dataNascimento");
const profissionalSelect = document.getElementById("profissional");
const dataInput = document.getElementById("data");
const horariosDiv = document.getElementById("horarios");
const horarioHidden = document.getElementById("horario");
const mensagemDiv = document.getElementById("mensagem");
const loadingDiv = document.getElementById("loading");
const observacaoGeral = document.getElementById("observacaoGeral");
const servicosContainer = document.getElementById("servicosContainer");
const btnAdicionarServico = document.getElementById("btnAdicionarServico");
const valorTotalServicosSpan = document.getElementById("valorTotalServicos");

// ==================== HORÁRIOS POR DIA DA SEMANA ====================
const horariosSegundaQuarta = [
    "08:20", "09:00", "09:40", "10:20", "11:00", "11:40",
    "14:00", "14:40", "15:20", "16:00", "16:40", "17:20", "18:00"
];

const horariosQuintaSabado = [
    "08:00", "08:40", "09:20", "10:00", "10:40", "11:20",
    "14:00", "14:40", "15:20", "16:00", "16:40", "17:20", "18:00", "18:40"
];

const HORARIO_LIMITE = "20:00";

let camposPreenchidos = { nome: false, telefone: false, profissional: false, data: false, servicos: false };
let usuarioAutenticado = false;
let servicosDisponiveis = [];
let pacoteAtual = null;
let bloqueiosCache = new Map();

// ==================== FUNÇÕES DE UTILIDADE ====================

function horarioParaMinutos(horario) {
    if (!horario) return 0;
    const [horas, minutos] = horario.split(':').map(Number);
    return horas * 60 + minutos;
}

function minutosParaHorario(minutos) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function calcularDuracaoTotal() {
    if (pacoteAtual && pacoteAtual.duracaoTotal) {
        return pacoteAtual.duracaoTotal;
    }
    
    let duracaoTotal = 0;
    document.querySelectorAll('.servico-select').forEach(select => {
        const selectedOption = select.options[select.selectedIndex];
        const servicoId = selectedOption?.getAttribute('data-id');
        const servico = servicosDisponiveis.find(s => s.id === servicoId);
        if (servico && servico.duracao) {
            duracaoTotal += servico.duracao;
        }
    });
    return duracaoTotal > 0 ? duracaoTotal : 60;
}

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u0301]/g, '').trim();
}

function formatarTelefone(valor) {
    let v = valor.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length >= 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length >= 8) v = v.replace(/(\(\d{2}\) \d{5})(\d)/, "$1-$2");
    return v.slice(0, 16);
}

// ==================== FUNÇÃO PARA BUSCAR CLIENTE POR TELEFONE ====================
async function buscarClientePorTelefone(telefone) {
    if (!telefone) return null;
    
    const telefoneNumerico = telefone.replace(/\D/g, "");
    if (telefoneNumerico.length < 10) return null;
    
    try {
        console.log(`🔍 Buscando cliente com telefone: ${telefoneNumerico}`);
        
        const clientesRef = collection(db, "clientes");
        
        const qNumerico = query(clientesRef, where("telefoneNumerico", "==", telefoneNumerico));
        const snapshotNumerico = await getDocs(qNumerico);
        
        if (!snapshotNumerico.empty) {
            const clienteDoc = snapshotNumerico.docs[0];
            const cliente = { id: clienteDoc.id, ...clienteDoc.data() };
            console.log("✅ Cliente encontrado por telefoneNumerico:", cliente);
            return cliente;
        }
        
        const qTelefone = query(clientesRef, where("telefone", "==", telefone));
        const snapshotTelefone = await getDocs(qTelefone);
        
        if (!snapshotTelefone.empty) {
            const clienteDoc = snapshotTelefone.docs[0];
            const cliente = { id: clienteDoc.id, ...clienteDoc.data() };
            console.log("✅ Cliente encontrado por telefone:", cliente);
            return cliente;
        }
        
        console.log("❌ Nenhum cliente encontrado com este telefone");
        return null;
        
    } catch (error) {
        console.error("Erro ao buscar cliente:", error);
        return null;
    }
}

// ==================== FUNÇÃO PARA BUSCAR BLOQUEIOS ====================
async function buscarBloqueios(data, profissionalId = null) {
    if (!data) return [];
    
    const cacheKey = `${data}_${profissionalId || "todos"}`;
    if (bloqueiosCache.has(cacheKey)) {
        return bloqueiosCache.get(cacheKey);
    }
    
    try {
        const bloqueiosRef = collection(db, "bloqueios");
        const q = query(bloqueiosRef, where("ativo", "==", true));
        const snapshot = await getDocs(q);
        
        const bloqueios = [];
        
        snapshot.forEach(doc => {
            const bloqueio = { id: doc.id, ...doc.data() };
            
            let aplica = false;
            
            if (bloqueio.tipo === "dia" && bloqueio.data === data) {
                aplica = true;
            }
            else if (bloqueio.tipo === "periodo") {
                if (bloqueio.dataInicio <= data && bloqueio.dataFim >= data) {
                    aplica = true;
                }
            }
            else if (bloqueio.tipo === "horario" && bloqueio.data === data) {
                aplica = true;
            }
            
            if (aplica) {
                if (bloqueio.profissionalId && profissionalId && bloqueio.profissionalId !== profissionalId) {
                    return;
                }
                bloqueios.push(bloqueio);
            }
        });
        
        bloqueiosCache.set(cacheKey, bloqueios);
        
        setTimeout(() => bloqueiosCache.delete(cacheKey), 5 * 60 * 1000);
        
        return bloqueios;
        
    } catch (error) {
        console.error("Erro ao buscar bloqueios:", error);
        return [];
    }
}

async function isHorarioBloqueado(data, horario, profissionalId) {
    const bloqueios = await buscarBloqueios(data, profissionalId);
    
    for (const bloqueio of bloqueios) {
        if (bloqueio.tipo === "dia" || bloqueio.tipo === "periodo") {
            return true;
        }
        if (bloqueio.tipo === "horario" && bloqueio.horario === horario) {
            return true;
        }
    }
    
    return false;
}

// ==================== FUNÇÃO PARA AUTO PREENCHER DADOS DO CLIENTE ====================
async function autoPreencherDadosCliente() {
    const telefone = telefoneInput?.value || "";
    const telefoneNumerico = telefone.replace(/\D/g, "");
    
    if (telefoneNumerico.length < 10) return;
    
    console.log(`🔍 Verificando cliente com telefone: ${telefoneNumerico}`);
    
    const telefoneLabel = document.querySelector('label[for="telefone"]');
    if (telefoneLabel) {
        const existingLoader = document.getElementById('clienteLoader');
        if (!existingLoader) {
            const loaderSpan = document.createElement('span');
            loaderSpan.id = 'clienteLoader';
            loaderSpan.innerHTML = ' <i class="fa-solid fa-spinner fa-spin"></i> Buscando...';
            loaderSpan.style.fontSize = '0.7rem';
            loaderSpan.style.marginLeft = '8px';
            telefoneLabel.appendChild(loaderSpan);
        }
    }
    
    try {
        const cliente = await buscarClientePorTelefone(telefone);
        
        const loader = document.getElementById('clienteLoader');
        if (loader) loader.remove();
        
        if (cliente) {
            console.log("🎯 Cliente encontrado! Preenchendo dados automaticamente:", cliente.nome);
            
            if (nomeInput && cliente.nome) {
                nomeInput.value = cliente.nome;
                nomeInput.style.borderColor = "#10b981";
                setTimeout(() => {
                    nomeInput.style.borderColor = "";
                }, 2000);
            }
            
            if (emailInput && cliente.email) {
                emailInput.value = cliente.email;
                emailInput.style.borderColor = "#10b981";
                setTimeout(() => {
                    emailInput.style.borderColor = "";
                }, 2000);
            }
            
            if (dataNascimentoInput && cliente.nascimento) {
                dataNascimentoInput.value = cliente.nascimento;
                dataNascimentoInput.style.borderColor = "#10b981";
                setTimeout(() => {
                    dataNascimentoInput.style.borderColor = "";
                }, 2000);
            }
            
            const clienteNome = cliente.nome.split(' ')[0];
            const totalAgendamentos = cliente.totalAgendamentos || 0;
            
            if (totalAgendamentos > 0) {
                mostrarMensagem(`🎉 Bem-vindo de volta, ${clienteNome}! Seus dados foram preenchidos automaticamente.`, "sucesso");
            } else {
                mostrarMensagem(`✨ Olá ${clienteNome}! Seus dados foram carregados.`, "sucesso");
            }
            
            if (cliente.nascimento) {
                const hoje = new Date();
                const nascimento = new Date(cliente.nascimento);
                if (nascimento.getMonth() === hoje.getMonth() && nascimento.getDate() === hoje.getDate()) {
                    mostrarMensagem(`🎂🎉 FELIZ ANIVERSÁRIO, ${clienteNome.toUpperCase()}! 🎉🎂 Você ganha 10% de desconto hoje!`, "sucesso");
                    
                    setTimeout(() => {
                        aplicarDescontoAniversario();
                    }, 500);
                }
            }
            
            verificarCamposPreenchidos();
            
        } else {
            console.log("📝 Cliente não encontrado. Novo cliente será cadastrado.");
        }
        
    } catch (error) {
        console.error("Erro ao auto preencher dados:", error);
        const loader = document.getElementById('clienteLoader');
        if (loader) loader.remove();
    }
}

function aplicarDescontoAniversario() {
    if (!pacoteAtual) {
        let totalAtual = 0;
        document.querySelectorAll('.servico-select').forEach(select => {
            const selectedOption = select.options[select.selectedIndex];
            const preco = parseFloat(selectedOption?.getAttribute('data-preco') || 0);
            totalAtual += preco;
        });
        
        if (totalAtual > 0) {
            const desconto = totalAtual * 0.10;
            const novoTotal = totalAtual - desconto;
            
            if (valorTotalServicosSpan) {
                valorTotalServicosSpan.innerHTML = `${formatarMoeda(novoTotal)} <span style="font-size: 0.65rem; color: #10b981; margin-left: 8px;">(10% OFF - Aniversário!)</span>`;
                valorTotalServicosSpan.style.color = '#10b981';
                setTimeout(() => {
                    valorTotalServicosSpan.style.color = '';
                }, 5000);
            }
            
            mostrarMensagem(`🎂 Desconto de aniversário de 10% aplicado! De ${formatarMoeda(totalAtual)} por ${formatarMoeda(novoTotal)}`, "sucesso");
        }
    }
}

async function buscarAgendamentosCliente(telefone) {
    if (!telefone) return [];
    
    const telefoneNumerico = telefone.replace(/\D/g, "");
    if (telefoneNumerico.length < 10) return [];
    
    try {
        const cliente = await buscarClientePorTelefone(telefone);
        if (!cliente) return [];
        
        const agendamentosRef = collection(db, "agendamentos");
        const q = query(agendamentosRef, where("clienteId", "==", cliente.id), orderBy("dataCriacao", "desc"));
        const snapshot = await getDocs(q);
        
        const agendamentos = [];
        snapshot.forEach(doc => {
            agendamentos.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`📋 Encontrados ${agendamentos.length} agendamentos para o cliente ${cliente.nome}`);
        return agendamentos;
        
    } catch (error) {
        console.error("Erro ao buscar agendamentos do cliente:", error);
        return [];
    }
}

async function mostrarHistoricoCliente() {
    const telefone = telefoneInput?.value || "";
    const telefoneNumerico = telefone.replace(/\D/g, "");
    
    if (telefoneNumerico.length < 10) return;
    
    const agendamentos = await buscarAgendamentosCliente(telefone);
    
    if (agendamentos.length === 0) return;
    
    let historicoDiv = document.getElementById('historicoCliente');
    if (!historicoDiv) {
        historicoDiv = document.createElement('div');
        historicoDiv.id = 'historicoCliente';
        historicoDiv.className = 'historico-cliente';
        historicoDiv.style.cssText = `
            background: rgba(33, 153, 239, 0.05);
            border-radius: 16px;
            padding: 12px;
            margin-top: 10px;
            margin-bottom: 16px;
            font-size: 0.75rem;
            border-left: 3px solid #2199EF;
        `;
        
        const telefoneGroup = document.querySelector('.input-group input#telefone')?.closest('.input-group');
        if (telefoneGroup && telefoneGroup.parentNode) {
            telefoneGroup.parentNode.insertBefore(historicoDiv, telefoneGroup.nextSibling);
        }
    }
    
    const ultimosAgendamentos = agendamentos.slice(0, 3);
    const totalRealizados = agendamentos.filter(a => a.status === 'concluido').length;
    const totalGasto = agendamentos
        .filter(a => a.status === 'concluido')
        .reduce((sum, a) => sum + (a.valor || a.valorTotal || 0), 0);
    
    historicoDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span><i class="fa-solid fa-history" style="color: #2199EF;"></i> <strong>Histórico de Atendimentos</strong></span>
            <span style="font-size: 0.65rem; color: #10b981;">${totalRealizados} atendimento(s)</span>
        </div>
        <div style="margin-bottom: 8px;">
            <span style="font-size: 0.65rem; color: #64748b;">💰 Total gasto: ${formatarMoeda(totalGasto)}</span>
        </div>
        ${ultimosAgendamentos.length > 0 ? `
            <div style="font-size: 0.65rem; color: #64748b;">
                <i class="fa-regular fa-clock"></i> Últimos atendimentos:
            </div>
            <div style="margin-top: 6px;">
                ${ultimosAgendamentos.map(a => {
                    const data = a.data || '';
                    const servico = a.servicos?.[0]?.nome || a.servicoNome || 'Serviço';
                    const status = a.status === 'concluido' ? '✅' : (a.status === 'confirmado' ? '⏳' : '❌');
                    return `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span>${status} ${servico}</span>
                        <span style="color: #2199EF;">${data}</span>
                    </div>`;
                }).join('')}
            </div>
        ` : ''}
    `;
    
    historicoDiv.style.display = 'block';
}

function removerHistoricoCliente() {
    const historicoDiv = document.getElementById('historicoCliente');
    if (historicoDiv) {
        historicoDiv.remove();
    }
}

// ==================== FUNÇÃO PARA PROCESSAR SERVIÇO DA URL ====================
async function processarServicoUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const servicoNome = urlParams.get('servico');
    const servicoPreco = urlParams.get('servicoPreco');
    const servicoId = urlParams.get('servicoId');
    const servicoDuracao = urlParams.get('servicoDuracao');
    
    if (!servicoNome) return false;
    
    console.log("🎯 Serviço recebido da URL:", servicoNome);
    
    let tentativas = 0;
    const maxTentativas = 30;
    
    return new Promise((resolve) => {
        const tentarSelecionarServico = setInterval(() => {
            tentativas++;
            
            if (servicosDisponiveis.length > 0) {
                const servicoEncontrado = servicosDisponiveis.find(s => 
                    s.nome === servicoNome || 
                    s.id === servicoId ||
                    s.nome.toLowerCase() === servicoNome.toLowerCase()
                );
                
                if (servicoEncontrado) {
                    console.log("✅ Serviço encontrado:", servicoEncontrado);
                    
                    const primeiroSelect = document.querySelector('.servico-select');
                    if (primeiroSelect) {
                        for (let i = 0; i < primeiroSelect.options.length; i++) {
                            if (primeiroSelect.options[i].value === servicoEncontrado.nome) {
                                primeiroSelect.selectedIndex = i;
                                const event = new Event('change');
                                primeiroSelect.dispatchEvent(event);
                                calcularValorTotal();
                                verificarCamposPreenchidos();
                                mostrarMensagem(`✅ Serviço "${servicoEncontrado.nome}" selecionado automaticamente!`, "sucesso");
                                break;
                            }
                        }
                    }
                    clearInterval(tentarSelecionarServico);
                    resolve(true);
                    return;
                }
            }
            
            if (tentativas >= maxTentativas) {
                const primeiroSelect = document.querySelector('.servico-select');
                if (primeiroSelect && primeiroSelect.options.length > 1) {
                    for (let i = 0; i < primeiroSelect.options.length; i++) {
                        const optionText = primeiroSelect.options[i].textContent;
                        if (optionText.includes(servicoNome) || 
                            normalizarTexto(optionText) === normalizarTexto(servicoNome)) {
                            primeiroSelect.selectedIndex = i;
                            const event = new Event('change');
                            primeiroSelect.dispatchEvent(event);
                            calcularValorTotal();
                            verificarCamposPreenchidos();
                            mostrarMensagem(`✅ Serviço "${servicoNome}" selecionado!`, "sucesso");
                            break;
                        }
                    }
                }
                clearInterval(tentarSelecionarServico);
                resolve(false);
            }
        }, 200);
    });
}

// ==================== EXIBIR INFORMAÇÕES DO PACOTE ====================
function exibirInfoPacote(pacote) {
    const infoPacoteDiv = document.getElementById('infoPacote');
    if (!infoPacoteDiv) return;
    
    if (pacote && pacote.preco && pacote.precoOriginal) {
        const economia = pacote.precoOriginal - pacote.preco;
        const descontoPercentual = pacote.desconto || ((economia / pacote.precoOriginal) * 100).toFixed(1);
        
        document.getElementById('pacoteNomeDisplay').textContent = pacote.nome;
        document.getElementById('precoOriginalDisplay').textContent = formatarMoeda(pacote.precoOriginal);
        document.getElementById('precoDescontoDisplay').textContent = formatarMoeda(pacote.preco);
        document.getElementById('descontoBadgeDisplay').innerHTML = `<i class="fa-solid fa-percent"></i> ${descontoPercentual}% OFF`;
        document.getElementById('economiaValorDisplay').textContent = formatarMoeda(economia);
        
        infoPacoteDiv.style.display = 'block';
        
        const totalSpan = document.getElementById('valorTotalServicos');
        if (totalSpan) {
            totalSpan.style.color = '#10b981';
            totalSpan.style.fontSize = '1.3rem';
        }
    } else {
        infoPacoteDiv.style.display = 'none';
        const totalSpan = document.getElementById('valorTotalServicos');
        if (totalSpan) {
            totalSpan.style.color = '';
            totalSpan.style.fontSize = '';
        }
    }
}

// ==================== RECEBER PARÂMETROS DA URL ====================
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        profissionalId: urlParams.get('profissionalId'),
        profissionalNome: urlParams.get('profissionalNome'),
        pacoteNome: urlParams.get('pacote'),
        servicosParam: urlParams.get('servicos'),
        precoTotal: urlParams.get('precoTotal'),
        pacoteId: urlParams.get('pacoteId'),
        servico: urlParams.get('servico'),
        servicoPreco: urlParams.get('servicoPreco'),
        servicoId: urlParams.get('servicoId')
    };
}

async function buscarPacoteCompleto(pacoteNome, pacoteId) {
    try {
        if (pacoteId) {
            const pacoteRef = doc(db, "pacotes", pacoteId);
            const pacoteSnap = await getDoc(pacoteRef);
            if (pacoteSnap.exists()) {
                return { id: pacoteSnap.id, ...pacoteSnap.data() };
            }
        }
        
        if (pacoteNome) {
            const pacotesRef = collection(db, "pacotes");
            const q = query(pacotesRef, where("nome", "==", pacoteNome));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            }
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar pacote:", error);
        return null;
    }
}

async function processarPacoteUrl() {
    const params = getUrlParams();
    const pacoteNome = params.pacoteNome;
    const pacoteId = params.pacoteId;
    const precoTotal = params.precoTotal;
    
    if (!pacoteNome && !pacoteId) return false;
    
    pacoteAtual = await buscarPacoteCompleto(pacoteNome, pacoteId);
    
    if (pacoteAtual) {
        console.log("🎁 Pacote carregado:", pacoteAtual);
        
        pacoteAtual = {
            id: pacoteAtual.id,
            nome: pacoteAtual.nome,
            precoOriginal: pacoteAtual.precoOriginal || pacoteAtual.preco,
            preco: precoTotal ? parseFloat(precoTotal) : pacoteAtual.preco,
            desconto: pacoteAtual.desconto || 0,
            servicos: pacoteAtual.servicos || [],
            duracaoTotal: pacoteAtual.duracaoTotal || 60
        };
        
        if (pacoteAtual.desconto === 0 && pacoteAtual.precoOriginal > pacoteAtual.preco) {
            pacoteAtual.desconto = Math.round((1 - pacoteAtual.preco / pacoteAtual.precoOriginal) * 100);
        }
        
        exibirInfoPacote(pacoteAtual);
        mostrarMensagem(`🎁 Pacote "${pacoteAtual.nome}" aplicado! Desconto de ${pacoteAtual.desconto}% OFF.`, "sucesso");
        
        if (valorTotalServicosSpan) {
            valorTotalServicosSpan.textContent = formatarMoeda(pacoteAtual.preco);
            valorTotalServicosSpan.style.animation = 'pulse 0.5s ease';
            setTimeout(() => valorTotalServicosSpan.style.animation = '', 500);
        }
        
        if (btnAdicionarServico) {
            btnAdicionarServico.disabled = true;
            btnAdicionarServico.style.opacity = '0.5';
            btnAdicionarServico.style.cursor = 'not-allowed';
        }
        
        document.querySelectorAll('.btn-remover-servico').forEach(btn => {
            btn.style.display = 'none';
        });
        
        if (pacoteAtual.servicos && pacoteAtual.servicos.length > 0) {
            while (document.querySelectorAll('.servico-item').length > 1) {
                document.querySelector('.servico-item:last-child')?.remove();
            }
            
            for (let i = 0; i < pacoteAtual.servicos.length; i++) {
                const servico = pacoteAtual.servicos[i];
                const servicoNome = servico.nome;
                
                if (i === 0) {
                    const primeiroSelect = document.querySelector('.servico-select');
                    if (primeiroSelect) {
                        for (let j = 0; j < primeiroSelect.options.length; j++) {
                            if (primeiroSelect.options[j].value === servicoNome) {
                                primeiroSelect.selectedIndex = j;
                                primeiroSelect.disabled = true;
                                break;
                            }
                        }
                    }
                } else {
                    const index = document.querySelectorAll('.servico-item').length;
                    const novoServico = document.createElement('div');
                    novoServico.className = 'servico-item';
                    novoServico.setAttribute('data-index', index);
                    novoServico.innerHTML = `
                        <div class="servico-row">
                            <select name="servico[]" class="servico-select" required disabled>
                                <option value="">Selecione um serviço</option>
                            </select>
                            <button type="button" class="btn-remover-servico" data-index="${index}" style="display: none;">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    `;
                    servicosContainer.appendChild(novoServico);
                    
                    const novoServicoSelect = novoServico.querySelector('.servico-select');
                    popularSelectServico(novoServicoSelect);
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    for (let j = 0; j < novoServicoSelect.options.length; j++) {
                        if (novoServicoSelect.options[j].value === servicoNome) {
                            novoServicoSelect.selectedIndex = j;
                            novoServicoSelect.disabled = true;
                            break;
                        }
                    }
                }
            }
        }
        
        verificarCamposPreenchidos();
        return true;
    }
    
    return false;
}

function processarParametrosProfissional() {
    const params = getUrlParams();
    
    if (params.profissionalId || params.profissionalNome) {
        let tentativas = 0;
        const maxTentativas = 30;
        
        const tentarSelecionar = setInterval(() => {
            tentativas++;
            
            if (!profissionalSelect || profissionalSelect.options.length === 0) {
                if (tentativas >= maxTentativas) clearInterval(tentarSelecionar);
                return;
            }
            
            for (let i = 0; i < profissionalSelect.options.length; i++) {
                const option = profissionalSelect.options[i];
                if ((params.profissionalId && option.value === params.profissionalId) ||
                    (params.profissionalNome && option.textContent === params.profissionalNome)) {
                    profissionalSelect.value = option.value;
                    mostrarMensagem(`✅ Barbeiro ${option.textContent} selecionado!`, "sucesso");
                    verificarCamposPreenchidos();
                    clearInterval(tentarSelecionar);
                    return;
                }
            }
            
            if (tentativas >= maxTentativas) clearInterval(tentarSelecionar);
        }, 500);
    }
}

// ==================== CARREGAR SERVIÇOS ====================
async function carregarServicosFirebase() {
    try {
        const servicosRef = collection(db, "servicos");
        const snapshot = await getDocs(servicosRef);
        
        servicosDisponiveis = [];
        snapshot.forEach(doc => {
            const servico = doc.data();
            servicosDisponiveis.push({
                id: doc.id,
                nome: servico.nome,
                preco: servico.preco || 0,
                duracao: servico.duracao || 60
            });
        });
        
        recriarSelectsServicos();
        
        const pacoteProcessado = await processarPacoteUrl();
        
        if (!pacoteProcessado) {
            await processarServicoUrl();
        }
        
    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
    }
}

async function carregarProfissionais() {
    if (!profissionalSelect) return;
    
    profissionalSelect.innerHTML = '<option value="">Carregando especialistas...</option>';
    profissionalSelect.disabled = true;
    
    try {
        const profissionaisRef = collection(db, "profissionais");
        const snapshot = await getDocs(profissionaisRef);
        
        if (snapshot.empty) {
            profissionalSelect.innerHTML = '<option value="">Nenhum especialista disponível</option>';
            profissionalSelect.disabled = false;
            return;
        }
        
        profissionalSelect.innerHTML = '<option value="">Selecione um barbeiro</option>';
        
        snapshot.forEach(doc => {
            const profissional = doc.data();
            const nome = profissional.nome || profissional.name || 'Sem nome';
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = nome;
            option.setAttribute('data-nome', nome);
            profissionalSelect.appendChild(option);
        });
        
        profissionalSelect.disabled = false;
        processarParametrosProfissional();
        
    } catch (error) {
        console.error("Erro ao carregar profissionais:", error);
        profissionalSelect.innerHTML = '<option value="">Erro ao carregar especialistas</option>';
        profissionalSelect.disabled = false;
    }
}

// ==================== FUNÇÕES DE SERVIÇOS ====================
function recriarSelectsServicos() {
    document.querySelectorAll('.servico-item .servico-select').forEach(select => {
        popularSelectServico(select);
    });
}

function popularSelectServico(selectElement) {
    const valorAtual = selectElement.value;
    selectElement.innerHTML = '<option value="">Selecione um serviço</option>';
    
    servicosDisponiveis.forEach(servico => {
        const option = document.createElement('option');
        option.value = servico.nome;
        option.setAttribute('data-preco', servico.preco);
        option.setAttribute('data-id', servico.id);
        option.setAttribute('data-duracao', servico.duracao);
        option.textContent = `${servico.nome} - ${formatarMoeda(servico.preco)} (${Math.floor(servico.duracao / 60)}h${servico.duracao % 60}min)`;
        selectElement.appendChild(option);
    });
    
    if (valorAtual && servicosDisponiveis.some(s => s.nome === valorAtual)) {
        selectElement.value = valorAtual;
    }
}

function calcularValorTotalReal() {
    let total = 0;
    document.querySelectorAll('.servico-select').forEach(select => {
        const selectedOption = select.options[select.selectedIndex];
        const preco = parseFloat(selectedOption?.getAttribute('data-preco') || 0);
        total += preco;
    });
    return total;
}

function calcularValorTotal() {
    if (pacoteAtual && pacoteAtual.preco) {
        valorTotalServicosSpan.textContent = formatarMoeda(pacoteAtual.preco);
        exibirInfoPacote(pacoteAtual);
        return pacoteAtual.preco;
    }
    
    let total = 0;
    document.querySelectorAll('.servico-select').forEach(select => {
        const selectedOption = select.options[select.selectedIndex];
        const preco = parseFloat(selectedOption?.getAttribute('data-preco') || 0);
        total += preco;
    });
    valorTotalServicosSpan.textContent = formatarMoeda(total);
    
    if (!pacoteAtual) {
        exibirInfoPacote(null);
    }
    
    return total;
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function adicionarServico() {
    if (pacoteAtual) {
        mostrarMensagem("⚠️ Não é possível adicionar serviços avulsos a um pacote. Finalize ou cancele o pacote.", "erro");
        return;
    }
    
    const index = document.querySelectorAll('.servico-item').length;
    const novoServico = document.createElement('div');
    novoServico.className = 'servico-item';
    novoServico.setAttribute('data-index', index);
    novoServico.innerHTML = `
        <div class="servico-row">
            <select name="servico[]" class="servico-select" required>
                <option value="">Carregando serviços...</option>
            </select>
            <button type="button" class="btn-remover-servico" data-index="${index}">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
    servicosContainer.appendChild(novoServico);
    
    const novoServicoSelect = novoServico.querySelector('.servico-select');
    popularSelectServico(novoServicoSelect);
    
    novoServicoSelect.addEventListener('change', () => {
        calcularValorTotal();
        verificarCamposPreenchidos();
        if (verificarCamposPreenchidos()) {
            atualizarHorarios();
        }
    });
    
    const btnRemover = novoServico.querySelector('.btn-remover-servico');
    btnRemover.addEventListener('click', () => {
        if (document.querySelectorAll('.servico-item').length > 1) {
            novoServico.remove();
            calcularValorTotal();
            verificarCamposPreenchidos();
            if (verificarCamposPreenchidos()) {
                atualizarHorarios();
            }
        } else {
            mostrarMensagem("Você precisa manter pelo menos um serviço.", "erro");
        }
    });
    
    document.querySelectorAll('.btn-remover-servico').forEach(btn => btn.style.display = 'flex');
    calcularValorTotal();
}

if (btnAdicionarServico) btnAdicionarServico.addEventListener('click', adicionarServico);

function configurarEventosServicos() {
    if (pacoteAtual) return;
    
    document.querySelectorAll('.servico-select').forEach(select => {
        select.removeEventListener('change', () => {});
        select.addEventListener('change', () => { 
            calcularValorTotal(); 
            verificarCamposPreenchidos();
            if (verificarCamposPreenchidos()) {
                atualizarHorarios();
            }
        });
    });
}

// ==================== FUNÇÃO DE CLIENTE ====================
async function salvarOuAtualizarCliente(dadosCliente) {
    try {
        const { nome, telefone, email, dataNascimento } = dadosCliente;
        
        if (!nome || nome.length < 2) {
            console.error("❌ Nome inválido:", nome);
            mostrarMensagem("Nome inválido. Digite seu nome completo.", "erro");
            return null;
        }
        
        if (!telefone || telefone.replace(/\D/g, "").length < 10) {
            console.error("❌ Telefone inválido:", telefone);
            mostrarMensagem("Telefone inválido. Use um número válido com DDD.", "erro");
            return null;
        }
        
        const telefoneNumerico = telefone.replace(/\D/g, "");
        console.log("📱 Buscando cliente - Nome:", nome, "| Telefone:", telefoneNumerico);
        
        const clientesRef = collection(db, "clientes");
        
        let clienteExistente = null;
        const qTelefone = query(clientesRef, where("telefoneNumerico", "==", telefoneNumerico));
        const snapshotTelefone = await getDocs(qTelefone);
        
        if (!snapshotTelefone.empty) {
            clienteExistente = snapshotTelefone.docs[0];
        } else {
            const qNome = query(clientesRef, where("nome", "==", nome));
            const snapshotNome = await getDocs(qNome);
            for (const doc of snapshotNome.docs) {
                if (doc.data().telefoneNumerico === telefoneNumerico) {
                    clienteExistente = doc;
                    break;
                }
            }
        }
        
        let clienteId = null;
        const now = Timestamp.now();
        
        if (clienteExistente) {
            console.log("✅ Cliente encontrado, atualizando...", clienteExistente.id);
            clienteId = clienteExistente.id;
            const clienteRef = doc(db, "clientes", clienteId);
            
            const dadosAtuais = clienteExistente.data();
            await updateDoc(clienteRef, {
                totalAgendamentos: (dadosAtuais.totalAgendamentos || 0) + 1,
                ultimoAtendimento: now,
                atualizadoEm: now,
                email: email || dadosAtuais.email || "",
                nascimento: dataNascimento || dadosAtuais.nascimento || ""
            });
            
            console.log("✅ Cliente atualizado! Total de agendamentos agora:", (dadosAtuais.totalAgendamentos || 0) + 1);
            mostrarMensagem(`✅ Bem-vindo de volta, ${nome}! Seu agendamento foi confirmado.`, "sucesso");
            
        } else {
            console.log("🆕 Cliente não encontrado. Criando novo cliente...");
            
            const novoCliente = {
                nome: nome,
                telefone: telefone,
                telefoneNumerico: telefoneNumerico,
                email: email || "",
                nascimento: dataNascimento || "",
                totalAgendamentos: 1,
                primeiroAtendimento: now,
                ultimoAtendimento: now,
                createdAt: now,
                atualizadoEm: now,
                status: "ativo"
            };
            
            console.log("📝 Dados do novo cliente:", novoCliente);
            
            const docRef = await addDoc(collection(db, "clientes"), novoCliente);
            clienteId = docRef.id;
            console.log("✅ Novo cliente criado com ID:", clienteId);
            mostrarMensagem(`✅ Cliente ${nome} cadastrado com sucesso!`, "sucesso");
        }
        
        if (clienteId) {
            const checkDoc = await getDoc(doc(db, "clientes", clienteId));
            if (checkDoc.exists()) {
                console.log("✅ Verificação: Cliente existe no Firebase!");
            } else {
                console.error("❌ ERRO: Cliente não foi persistido!");
            }
        }
        
        return clienteId;
        
    } catch (error) {
        console.error("❌ Erro em salvarOuAtualizarCliente:", error);
        mostrarMensagem(`Erro ao processar cliente. Tente novamente.`, "erro");
        return null;
    }
}

// ==================== FUNÇÕES DE AGENDAMENTO ====================
function mostrarMensagem(texto, tipo = 'sucesso') {
    if (!mensagemDiv) return;
    mensagemDiv.textContent = texto;
    mensagemDiv.className = tipo === 'sucesso' ? 'sucesso' : 'erro';
    setTimeout(() => { mensagemDiv.textContent = ''; mensagemDiv.className = ''; }, 5000);
}

function getDiaSemana(dataStr) {
    if (!dataStr) return null;
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const dataUTC = new Date(Date.UTC(ano, mes - 1, dia));
    return dataUTC.getUTCDay();
}

function getNomeDiaSemana(dataStr) {
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return dias[getDiaSemana(dataStr)];
}

function getHorariosPorDia(dataStr) {
    const diaSemana = getDiaSemana(dataStr);
    
    if (diaSemana >= 1 && diaSemana <= 3) {
        return { 
            horarios: horariosSegundaQuarta,
            descricao: "Segunda à Quarta"
        };
    }
    else if (diaSemana >= 4 && diaSemana <= 6) {
        return { 
            horarios: horariosQuintaSabado,
            descricao: "Quinta à Sábado"
        };
    }
    else {
        return { 
            horarios: [],
            descricao: "Domingo"
        };
    }
}

function getInfoAtendimentoPorDia(dataStr) {
    const diaSemana = getDiaSemana(dataStr);
    
    if (diaSemana === 0) {
        return { 
            temAtendimento: false, 
            mensagem: "Não atendemos aos domingos." 
        };
    }
    
    const horariosInfo = getHorariosPorDia(dataStr);
    
    return { 
        temAtendimento: true, 
        horarios: horariosInfo.horarios,
        mensagem: `Horários - ${horariosInfo.descricao}`
    };
}

function verificarCamposPreenchidos() {
    const nome = nomeInput?.value.trim();
    const telefone = telefoneInput?.value.trim();
    const profissional = profissionalSelect?.value;
    const data = dataInput?.value;
    let servicoSelecionado = false;
    
    if (pacoteAtual) {
        servicoSelecionado = true;
    } else {
        document.querySelectorAll('.servico-select').forEach(select => { 
            if (select.value && select.value !== "") servicoSelecionado = true; 
        });
    }
    
    camposPreenchidos.nome = nome && nome.length >= 3;
    camposPreenchidos.telefone = telefone && telefone.replace(/\D/g, "").length >= 10;
    camposPreenchidos.profissional = profissional && profissional !== "" && !profissional.includes("Carregando") && !profissional.includes("Nenhum") && !profissional.includes("Erro");
    camposPreenchidos.data = data && data !== "";
    camposPreenchidos.servicos = servicoSelecionado;
    
    const todosPreenchidos = Object.values(camposPreenchidos).every(v => v === true);
    if (todosPreenchidos && data && usuarioAutenticado) atualizarHorarios();
    else if (horariosDiv && !todosPreenchidos) mostrarMensagemCampos();
    return todosPreenchidos;
}

function mostrarMensagemCampos() {
    if (!horariosDiv) return;
    let mensagem = "";
    if (!camposPreenchidos.nome) mensagem = "Preencha seu nome";
    else if (!camposPreenchidos.telefone) mensagem = "Preencha seu WhatsApp";
    else if (!camposPreenchidos.servicos) mensagem = "Selecione um serviço";
    else if (!camposPreenchidos.profissional) mensagem = "Selecione um barbeiro";
    else if (!camposPreenchidos.data) mensagem = "Selecione uma data";
    if (mensagem) horariosDiv.innerHTML = `<div class="aviso-campos"><i class="fa-solid fa-info-circle"></i><p>${mensagem}</p></div>`;
}

function configurarDataMinima() {
    if (!dataInput) return;
    const hoje = new Date();
    dataInput.min = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

// ==================== ATUALIZAR HORÁRIOS (VERSÃO CORRIGIDA DEFINITIVA) ====================
// CORREÇÃO: TODO agendamento existente bloqueia o horário para evitar dupla reserva
async function atualizarHorarios() {
    const data = dataInput.value;
    const profissionalId = profissionalSelect?.value;
    const profissionalNome = profissionalSelect?.options[profissionalSelect.selectedIndex]?.getAttribute('data-nome');
    
    console.log("=== INICIANDO VERIFICAÇÃO DE HORÁRIOS ===");
    console.log(`📅 Data: ${data}`);
    console.log(`👨‍🦱 Profissional ID: ${profissionalId}`);
    console.log(`👨‍🦱 Profissional Nome: ${profissionalNome}`);
    
    if (!data || !profissionalId) {
        console.log("❌ Data ou profissional não selecionado");
        return;
    }
    
    const duracaoTotal = calcularDuracaoTotal();
    console.log(`⏱️ Duração total do serviço: ${duracaoTotal} minutos`);
    
    if (duracaoTotal === 0) {
        horariosDiv.innerHTML = `<div class="aviso-campos"><i class="fa-solid fa-clock"></i><p>Selecione os serviços primeiro</p></div>`;
        return;
    }
    
    const infoAtendimento = getInfoAtendimentoPorDia(data);
    console.log(`📋 Info do dia:`, infoAtendimento);
    
    if (!infoAtendimento.temAtendimento) {
        horariosDiv.innerHTML = `<div class="aviso-campos"><i class="fa-solid fa-calendar-xmark"></i><p>${infoAtendimento.mensagem}</p></div>`;
        return;
    }
    
    horariosDiv.innerHTML = '<div class="loading-horarios"><i class="fas fa-spinner fa-spin"></i> Verificando horários disponíveis...</div>';
    
    try {
        // Buscar TODOS os agendamentos do dia para este profissional
        const agendamentosRef = collection(db, "agendamentos");
        
        // Criar múltiplas queries para garantir que encontramos todos
        const queries = [];
        
        // Query por profissionalId
        if (profissionalId) {
            queries.push(query(agendamentosRef, where("data", "==", data), where("profissionalId", "==", profissionalId)));
        }
        
        // Query por profissional (nome)
        if (profissionalNome) {
            queries.push(query(agendamentosRef, where("data", "==", data), where("profissional", "==", profissionalNome)));
        }
        
        // Query por profissionalId como string (caso esteja como string)
        if (profissionalId) {
            queries.push(query(agendamentosRef, where("data", "==", data), where("profissionalId", "==", String(profissionalId))));
        }
        
        const todosAgendamentos = [];
        
        for (const q of queries) {
            const snapshot = await getDocs(q);
            console.log(`📊 Query retornou ${snapshot.size} resultados`);
            
            snapshot.forEach(doc => {
                const agendamento = { id: doc.id, ...doc.data() };
                // Evitar duplicatas
                if (!todosAgendamentos.find(a => a.id === agendamento.id)) {
                    todosAgendamentos.push(agendamento);
                }
            });
        }
        
        console.log(`📊 TOTAL de agendamentos únicos encontrados: ${todosAgendamentos.length}`);
        
        // IMPORTANTE: TODO agendamento existente bloqueia o horário
        // Independente do status, pois se já teve um atendimento naquele horário,
        // não pode ser agendado novamente (evita dupla reserva)
        const horariosOcupados = [];
        
        for (const agendamento of todosAgendamentos) {
            const horario = agendamento.horario;
            const horarioFim = agendamento.horarioFim;
            
            console.log(`\n--- Agendamento encontrado ---`);
            console.log(`  ID: ${agendamento.id}`);
            console.log(`  Status: ${agendamento.status}`);
            console.log(`  Horário: ${horario}`);
            console.log(`  Horário Fim: ${horarioFim}`);
            console.log(`  Cliente: ${agendamento.cliente || agendamento.nome}`);
            
            if (horario) {
                let duracaoAgendamento = agendamento.duracaoTotal || 60;
                
                // Calcular duração baseada nos serviços se disponível
                if (agendamento.servicos && agendamento.servicos.length > 0 && !agendamento.duracaoTotal) {
                    duracaoAgendamento = 0;
                    agendamento.servicos.forEach(servico => {
                        const servicoCompleto = servicosDisponiveis.find(s => s.id === servico.id || s.nome === servico.nome);
                        duracaoAgendamento += servicoCompleto?.duracao || 60;
                    });
                }
                
                horariosOcupados.push({
                    horario: horario,
                    duracaoTotal: duracaoAgendamento,
                    status: agendamento.status,
                    id: agendamento.id,
                    horarioFim: horarioFim
                });
                
                console.log(`  🔒 BLOQUEANDO - Horário ${horario} está OCUPADO (status: ${agendamento.status})`);
            } else {
                console.log(`  ⚠️ Agendamento sem horário definido`);
            }
        }
        
        console.log(`\n📊 Total de horários ocupados que BLOQUEIAM: ${horariosOcupados.length}`);
        
        // Buscar bloqueios manuais
        const bloqueios = await buscarBloqueios(data, profissionalId);
        const temBloqueioDiaInteiro = bloqueios.some(b => b.tipo === "dia" || b.tipo === "periodo");
        
        if (temBloqueioDiaInteiro) {
            const motivoBloqueio = bloqueios.find(b => b.tipo === "dia" || b.tipo === "periodo")?.motivo || "Estabelecimento fechado";
            horariosDiv.innerHTML = `
                <div class="aviso-campos erro">
                    <i class="fa-solid fa-store-slash"></i>
                    <p><strong>⚠️ Estabelecimento fechado neste dia</strong></p>
                    <p style="font-size: 0.8rem; margin-top: 8px;">${motivoBloqueio}</p>
                </div>
            `;
            return;
        }
        
        // Horários bloqueados manualmente
        const horariosBloqueadosManualmente = new Set();
        for (const bloqueio of bloqueios) {
            if (bloqueio.tipo === "horario" && bloqueio.horario) {
                horariosBloqueadosManualmente.add(bloqueio.horario);
            }
        }
        
        const limiteMinutos = horarioParaMinutos(HORARIO_LIMITE);
        const horariosDisponiveis = [];
        const horariosIndisponiveis = [];
        
        console.log(`\n📋 Verificando cada horário da lista (${infoAtendimento.horarios.length} horários totais)...`);
        
        for (const horarioBase of infoAtendimento.horarios) {
            console.log(`\n--- Verificando horário: ${horarioBase} ---`);
            
            // Verificar bloqueio manual
            if (horariosBloqueadosManualmente.has(horarioBase)) {
                horariosIndisponiveis.push(horarioBase);
                console.log(`  ⚠️ INDISPONÍVEL (bloqueio manual)`);
                continue;
            }
            
            const inicioMinutos = horarioParaMinutos(horarioBase);
            const fimMinutos = inicioMinutos + duracaoTotal;
            
            // Verificar se ultrapassa o horário limite
            if (fimMinutos > limiteMinutos) {
                horariosIndisponiveis.push(horarioBase);
                console.log(`  ⚠️ INDISPONÍVEL (ultrapassa limite ${HORARIO_LIMITE})`);
                continue;
            }
            
            // Verificar conflito com horários ocupados
            let conflito = false;
            let motivoConflito = "";
            
            for (const ocupado of horariosOcupados) {
                const ocupadoInicio = horarioParaMinutos(ocupado.horario);
                const ocupadoFim = ocupadoInicio + (ocupado.duracaoTotal || 60);
                
                if (inicioMinutos < ocupadoFim && fimMinutos > ocupadoInicio) {
                    conflito = true;
                    motivoConflito = `Conflito com ${ocupado.horario} (${ocupado.status})`;
                    console.log(`  ⚠️ INDISPONÍVEL - ${motivoConflito}`);
                    console.log(`     Seu horário: ${horarioBase} (${inicioMinutos}min - ${fimMinutos}min)`);
                    console.log(`     Ocupado: ${ocupado.horario} (${ocupadoInicio}min - ${ocupadoFim}min)`);
                    break;
                }
            }
            
            if (conflito) {
                horariosIndisponiveis.push(horarioBase);
            } else {
                horariosDisponiveis.push(horarioBase);
                console.log(`  ✅ DISPONÍVEL`);
            }
        }
        
        console.log(`\n📊 RESULTADO FINAL:`);
        console.log(`   ✅ Disponíveis: ${horariosDisponiveis.length}`);
        console.log(`   ❌ Indisponíveis: ${horariosIndisponiveis.length}`);
        
        renderizarHorarios(horariosDisponiveis, horariosIndisponiveis, infoAtendimento, duracaoTotal);
        
    } catch (error) {
        console.error("❌ Erro ao buscar horários:", error);
        horariosDiv.innerHTML = `<div class="aviso-campos erro"><i class="fa-solid fa-circle-exclamation"></i><p>Erro ao carregar horários: ${error.message}</p></div>`;
    }
}

// CORREÇÃO V2: Renderizar horários mostrando APENAS o horário de início
function renderizarHorarios(horariosDisponiveis = [], horariosIndisponiveis = [], infoAtendimento, duracaoTotal) {
    const nomeDia = getNomeDiaSemana(dataInput.value);
    
    horariosDiv.innerHTML = '';
    
    const duracaoFormatada = `${Math.floor(duracaoTotal / 60)}h ${duracaoTotal % 60}min`;
    
    const infoHeader = document.createElement('div');
    infoHeader.style.cssText = `background:#e8f4fd;padding:14px 16px;border-radius:16px;margin-bottom:20px;text-align:center;border-left:4px solid #2199EF;`;
    infoHeader.innerHTML = `
        <div>
            <h3 style="margin:0;color:#2199EF;">Horários Disponíveis - ${nomeDia}</h3>
            <p style="margin:5px 0 0;font-size:0.75rem;color:#475569;">${infoAtendimento.mensagem}</p>
            <p style="margin:5px 0 0;font-size:0.7rem;color:#10b981;">
                <i class="fa-regular fa-clock"></i> Duração total: ${duracaoFormatada}
            </p>
        </div>
    `;
    horariosDiv.appendChild(infoHeader);
    
    if (horariosDisponiveis.length === 0) {
        const avisoDiv = document.createElement('div');
        avisoDiv.className = 'aviso-campos';
        avisoDiv.innerHTML = `
            <i class="fa-solid fa-clock"></i>
            <p>Nenhum horário disponível para esta data</p>
            <p style="font-size: 0.7rem; margin-top: 8px;">Tente outra data ou horário</p>
            ${horariosIndisponiveis.length > 0 ? `<p style="font-size: 0.65rem; margin-top: 8px; color:#c2410c;">Horários ocupados: ${horariosIndisponiveis.join(', ')}</p>` : ''}
        `;
        horariosDiv.appendChild(avisoDiv);
        return;
    }
    
    const containerBotoes = document.createElement('div');
    containerBotoes.className = 'botoes-horarios';
    
    horariosDisponiveis.forEach(hora => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "horario-btn";
        
        // CORREÇÃO: Mostrar apenas o horário de início, sem o horário de término
        // A duração continua sendo usada internamente para validação de conflitos
        btn.textContent = hora;
        
        // Tooltip opcional com informação da duração (aparece ao passar o mouse)
        btn.title = `Duração do serviço: ${duracaoFormatada}`;
        
        btn.onclick = () => {
            document.querySelectorAll(".horario-btn").forEach(b => b.classList.remove("selecionado"));
            btn.classList.add("selecionado");
            horarioHidden.value = hora;
        };
        containerBotoes.appendChild(btn);
    });
    horariosDiv.appendChild(containerBotoes);
    
    if (horariosIndisponiveis.length > 0) {
        const infoOcupados = document.createElement('div');
        infoOcupados.style.cssText = `margin-top:16px;padding:8px 12px;background:#fef2e8;border-radius:12px;font-size:0.75rem;color:#c2410c;text-align:center;`;
        infoOcupados.innerHTML = `<i class="fa-solid fa-clock"></i> Horários indisponíveis: ${horariosIndisponiveis.join(', ')}`;
        horariosDiv.appendChild(infoOcupados);
    }
}

function redirecionarParaPagamento(agendamentoId) {
    window.location.href = `pagamento-cliente.html?agendamento=${agendamentoId}`;
}

async function criarComanda(agendamentoId, dadosAgendamento) {
    try {
        const comandaData = {
            agendamentoId: agendamentoId,
            clienteNome: dadosAgendamento.nome,
            barbeiroNome: dadosAgendamento.profissional,
            servicos: dadosAgendamento.servicos || [],
            pacotes: dadosAgendamento.pacoteInfo ? [dadosAgendamento.pacoteInfo] : [],
            total: dadosAgendamento.valorTotal,
            status: "aguardando_pagamento",
            dataAgendamento: dadosAgendamento.data,
            horarioAgendamento: dadosAgendamento.horario,
            dataCriacao: Timestamp.now(),
            origem: "agendamento",
            pacoteId: dadosAgendamento.pacoteId || null,
            pacoteNome: dadosAgendamento.pacoteNome || null,
            descontoAplicado: dadosAgendamento.descontoAplicado || 0
        };
        
        const comandaRef = await addDoc(collection(db, "comandas"), comandaData);
        await updateDoc(doc(db, "agendamentos", agendamentoId), { comandaId: comandaRef.id });
        return comandaRef.id;
    } catch (error) {
        console.error("Erro ao criar comanda:", error);
        return null;
    }
}

// ==================== AUTENTICAÇÃO ====================
function autenticar(tentativa = 1) {
    signInAnonymously(auth).then(async () => {
        usuarioAutenticado = true;
        await carregarProfissionais();
        await carregarServicosFirebase();
        verificarCamposPreenchidos();
    }).catch((error) => {
        console.error(`Erro autenticação (${tentativa}/3):`, error);
        if (tentativa < 3) setTimeout(() => autenticar(tentativa + 1), 1000);
    });
}

autenticar();

onAuthStateChanged(auth, async (user) => {
    if (user && !usuarioAutenticado) {
        usuarioAutenticado = true;
        await carregarProfissionais();
        await carregarServicosFirebase();
        verificarCamposPreenchidos();
    }
});

// ==================== SUBMIT DO FORMULÁRIO ====================
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const nome = nomeInput?.value.trim();
        const telefone = telefoneInput?.value.trim();
        const email = emailInput?.value.trim();
        const dataNascimento = dataNascimentoInput?.value || "";
        const profissionalId = profissionalSelect?.value;
        const profissionalNome = profissionalSelect?.options[profissionalSelect.selectedIndex]?.getAttribute('data-nome');
        const data = dataInput?.value;
        const horario = horarioHidden?.value;
        const obsGeral = observacaoGeral?.value || '';
        
        console.log("📝 Dados do formulário:");
        console.log("  Nome:", nome);
        console.log("  Telefone:", telefone);
        console.log("  Data:", data);
        console.log("  Horário:", horario);
        
        const duracaoTotal = calcularDuracaoTotal();
        
        // Verificar se horário está bloqueado antes de prosseguir
        if (data && horario && profissionalId) {
            // Verificar se já existe um agendamento neste horário
            const agendamentosRef = collection(db, "agendamentos");
            const q = query(
                agendamentosRef, 
                where("data", "==", data), 
                where("horario", "==", horario),
                where("profissionalId", "==", profissionalId)
            );
            const existingSnap = await getDocs(q);
            
            if (!existingSnap.empty) {
                mostrarMensagem("❌ Este horário não está mais disponível. Por favor, selecione outro horário.", "erro");
                await atualizarHorarios();
                return;
            }
            
            // Verificar bloqueios manuais
            const isBloqueado = await isHorarioBloqueado(data, horario, profissionalId);
            if (isBloqueado) {
                mostrarMensagem("❌ Este horário não está mais disponível. Por favor, selecione outro horário.", "erro");
                await atualizarHorarios();
                return;
            }
        }
        
        let servicosLista = [];
        let valorTotal = 0;
        let pacoteInfo = null;
        
        if (pacoteAtual) {
            pacoteInfo = {
                id: pacoteAtual.id,
                nome: pacoteAtual.nome,
                precoOriginal: pacoteAtual.precoOriginal,
                preco: pacoteAtual.preco,
                descontoPercentual: pacoteAtual.desconto,
                descontoValor: pacoteAtual.precoOriginal - pacoteAtual.preco,
                servicos: pacoteAtual.servicos || [],
                duracaoTotal: pacoteAtual.duracaoTotal || duracaoTotal,
                tipo: "pacote",
                isPacote: true
            };
            valorTotal = pacoteAtual.preco;
        } else {
            const servicosSelects = document.querySelectorAll('.servico-select');
            servicosSelects.forEach(select => {
                if (select.value && select.value !== "") {
                    const selectedOption = select.options[select.selectedIndex];
                    const preco = parseFloat(selectedOption?.getAttribute('data-preco') || 0);
                    const servicoId = selectedOption?.getAttribute('data-id');
                    const duracao = parseInt(selectedOption?.getAttribute('data-duracao') || 60);
                    servicosLista.push({ 
                        id: servicoId, 
                        nome: select.value, 
                        preco: preco,
                        duracao: duracao,
                        tipo: "servico"
                    });
                    valorTotal += preco;
                }
            });
        }
        
        if (!pacoteAtual && servicosLista.length === 0) { 
            mostrarMensagem("Selecione pelo menos um serviço.", "erro"); 
            return; 
        }
        if (!nome) { mostrarMensagem("Preencha seu nome.", "erro"); return; }
        if (!telefone) { mostrarMensagem("Preencha seu WhatsApp.", "erro"); return; }
        if (!profissionalId) { mostrarMensagem("Selecione um barbeiro.", "erro"); return; }
        if (!data) { mostrarMensagem("Selecione uma data.", "erro"); return; }
        if (!horario) { mostrarMensagem("Selecione um horário.", "erro"); return; }
        
        const inicioMinutos = horarioParaMinutos(horario);
        const fimMinutos = inicioMinutos + duracaoTotal;
        const horarioFim = minutosParaHorario(fimMinutos);
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
        loadingDiv.style.display = "block";
        
        const clienteId = await salvarOuAtualizarCliente({ nome, telefone, email, dataNascimento });
        
        if (!clienteId) {
            mostrarMensagem("Erro ao processar cliente. Tente novamente.", "erro");
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Confirmar Agendamento';
            loadingDiv.style.display = "none";
            return;
        }
        
        const dadosAgendamento = {
            nome, 
            cliente: nome, 
            clienteId, 
            telefone, 
            whatsapp: telefone, 
            email: email || null,
            profissional: profissionalNome, 
            profissionalId, 
            tipoAtendimento: "Presencial",
            valor: valorTotal, 
            valorTotal: valorTotal, 
            data, 
            horario,
            horarioFim: horarioFim,
            duracaoTotal: duracaoTotal,
            observacaoGeral: obsGeral,
            status: "aguardando_pagamento", 
            pagamentoStatus: "pendente",
            createdAt: Timestamp.now(), 
            atualizadoEm: Timestamp.now()
        };
        
        if (pacoteInfo) {
            dadosAgendamento.pacoteInfo = pacoteInfo;
            dadosAgendamento.pacoteId = pacoteAtual.id;
            dadosAgendamento.pacoteNome = pacoteAtual.nome;
            dadosAgendamento.descontoAplicado = pacoteAtual.desconto;
            dadosAgendamento.servicos = [];
        } else {
            dadosAgendamento.servicos = servicosLista;
            dadosAgendamento.servicosNomes = servicosLista.map(s => s.nome).join(', ');
        }
        
        try {
            const docRef = await addDoc(collection(db, "agendamentos"), dadosAgendamento);
            const agendamentoId = docRef.id;
            
            if (clienteId) await updateDoc(doc(db, "agendamentos", agendamentoId), { clienteId });
            await criarComanda(agendamentoId, dadosAgendamento);
            
            mostrarMensagem("✅ Agendamento criado! Redirecionando para pagamento...", "sucesso");
            setTimeout(() => redirecionarParaPagamento(agendamentoId), 1500);
            
        } catch (error) {
            console.error("Erro ao processar:", error);
            mostrarMensagem("Erro ao processar seu agendamento. Tente novamente.", "erro");
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Confirmar Agendamento';
            loadingDiv.style.display = "none";
        }
    });
}

// ==================== EVENT LISTENERS ====================
if (nomeInput) nomeInput.addEventListener('input', verificarCamposPreenchidos);
if (profissionalSelect) profissionalSelect.addEventListener('change', () => {
    horarioHidden.value = '';
    verificarCamposPreenchidos();
});
if (dataInput) dataInput.addEventListener('change', () => { 
    horarioHidden.value = ''; 
    verificarCamposPreenchidos(); 
});

if (telefoneInput) {
    telefoneInput.addEventListener('input', (e) => {
        e.target.value = formatarTelefone(e.target.value);
        verificarCamposPreenchidos();
        
        clearTimeout(window.telefoneDebounce);
        window.telefoneDebounce = setTimeout(() => {
            autoPreencherDadosCliente();
        }, 800);
    });
    
    telefoneInput.addEventListener('blur', () => {
        autoPreencherDadosCliente();
        mostrarHistoricoCliente();
    });
    
    telefoneInput.addEventListener('focus', () => {
        if (!telefoneInput.value) {
            removerHistoricoCliente();
        }
    });
}

if (servicosContainer && !pacoteAtual) {
    const observer = new MutationObserver(() => { 
        configurarEventosServicos(); 
        verificarCamposPreenchidos();
        if (verificarCamposPreenchidos()) {
            atualizarHorarios();
        }
    });
    observer.observe(servicosContainer, { childList: true, subtree: true });
}

configurarDataMinima();
configurarEventosServicos();
calcularValorTotal();

console.log("✅ agendamento.js carregado com sucesso!");
console.log("📋 Horários Segunda à Quarta:", horariosSegundaQuarta);
console.log("📋 Horários Quinta à Sábado:", horariosQuintaSabado);
console.log("🔒 Sistema de bloqueios integrado!");
console.log("⏱️ Sistema de duração de serviços integrado!");
console.log("🔓 CORREÇÃO DEFINITIVA: TODO agendamento existente BLOQUEIA o horário!");
console.log("🔓 Isso evita dupla reserva e overbooking!");
console.log("🎯 CORREÇÃO V2: Horários exibem apenas o horário de início!");