// agendamento.js - Versão CORRIGIDA com MODAL para seleção de múltiplos clientes
// E FILTRO DE HORÁRIOS QUE IGNORA STATUS AUSENTE/CANCELADO

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
    orderBy,
    and
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

// Elementos do Modal
const modalSelecionarCliente = document.getElementById("modalSelecionarCliente");
const listaClientesModal = document.getElementById("listaClientesModal");
const btnFecharModal = document.getElementById("btnFecharModal");

// Variáveis de controle
let clienteSelecionadoParaAgendamento = null;
let agendamentoEmAndamento = false;

// ==================== HORÁRIOS POR DIA DA SEMANA ====================
const horariosSegundaQuarta = [
    "08:20", "09:00", "09:40", "10:20", "11:00", "11:40",
    "14:00", "14:40", "15:20", "16:00", "16:40", "17:20", "18:00", "18:40"
];

const horariosQuintaSabado = [
    "08:00", "08:40", "09:20", "10:00", "10:40",
    "14:00", "14:40", "15:20", "16:00", "17:20", "18:00", "18:40"
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

// ==================== FUNÇÕES DO MODAL ====================

function abrirModalSelecionarCliente(clientes, telefone) {
    if (!modalSelecionarCliente || !listaClientesModal) return;
    
    listaClientesModal.innerHTML = "";
    
    clientes.forEach(cliente => {
        const card = document.createElement("div");
        card.className = "cliente-card-modal";
        
        const inicial = cliente.nome ? cliente.nome.charAt(0).toUpperCase() : "?";
        
        let dataCriacao = "";
        if (cliente.createdAt) {
            const date = cliente.createdAt.toDate ? cliente.createdAt.toDate() : new Date(cliente.createdAt);
            dataCriacao = date.toLocaleDateString('pt-BR');
        }
        
        card.innerHTML = `
            <div class="cliente-avatar-modal">${inicial}</div>
            <div class="cliente-info-modal">
                <h4>${cliente.nome}</h4>
                <p>📅 Cliente desde: ${dataCriacao || "N/A"}</p>
                <p>📊 ${cliente.totalAgendamentos || 0} agendamento(s)</p>
                ${cliente.nascimento ? `<p>🎂 Nascimento: ${cliente.nascimento}</p>` : ""}
                ${cliente.email ? `<p>✉️ ${cliente.email}</p>` : ""}
            </div>
            <i class="fa-solid fa-chevron-right" style="color: #2199EF;"></i>
        `;
        
        card.addEventListener("click", () => {
            clienteSelecionadoParaAgendamento = {
                id: cliente.id,
                nome: cliente.nome,
                email: cliente.email || "",
                nascimento: cliente.nascimento || "",
                telefone: telefone,
                totalAgendamentos: cliente.totalAgendamentos || 0
            };
            
            if (nomeInput) nomeInput.value = cliente.nome;
            if (emailInput && cliente.email) emailInput.value = cliente.email;
            if (dataNascimentoInput && cliente.nascimento) dataNascimentoInput.value = cliente.nascimento;
            
            fecharModal();
            
            if (cliente.nascimento) {
                verificarAniversario(cliente.nascimento, cliente.nome);
            }
            
            mostrarMensagem(`✅ Cliente ${cliente.nome} selecionado!`, "sucesso");
            verificarCamposPreenchidos();
        });
        
        listaClientesModal.appendChild(card);
    });
    
    modalSelecionarCliente.style.display = "flex";
}

function fecharModal() {
    if (modalSelecionarCliente) {
        modalSelecionarCliente.style.display = "none";
    }
}

function verificarAniversario(dataNascimento, nome) {
    if (!dataNascimento) return false;
    
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    
    if (nascimento.getMonth() === hoje.getMonth() && nascimento.getDate() === hoje.getDate()) {
        mostrarMensagem(`🎂🎉 FELIZ ANIVERSÁRIO, ${nome.toUpperCase()}! 🎉🎂 Você ganha 10% de desconto hoje!`, "sucesso");
        
        setTimeout(() => {
            aplicarDescontoAniversario();
        }, 500);
        return true;
    }
    return false;
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
        }
    }
}

// ==================== FUNÇÃO PARA BUSCAR CLIENTES POR TELEFONE ====================
async function buscarTodosClientesPorTelefone(telefone) {
    if (!telefone) return [];
    
    const telefoneNumerico = telefone.replace(/\D/g, "");
    if (telefoneNumerico.length < 10) return [];
    
    try {
        console.log(`🔍 Buscando TODOS clientes com telefone: ${telefoneNumerico}`);
        
        const clientesRef = collection(db, "clientes");
        const qNumerico = query(clientesRef, where("telefoneNumerico", "==", telefoneNumerico));
        const snapshotNumerico = await getDocs(qNumerico);
        
        const clientes = [];
        snapshotNumerico.forEach(doc => {
            clientes.push({ id: doc.id, ...doc.data() });
        });
        
        if (clientes.length === 0) {
            const qTelefone = query(clientesRef, where("telefone", "==", telefone));
            const snapshotTelefone = await getDocs(qTelefone);
            snapshotTelefone.forEach(doc => {
                clientes.push({ id: doc.id, ...doc.data() });
            });
        }
        
        console.log(`📋 Encontrados ${clientes.length} clientes com este telefone`);
        return clientes;
        
    } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        return [];
    }
}

async function buscarClientePorTelefoneENome(telefone, nome) {
    if (!telefone) return null;
    
    const telefoneNumerico = telefone.replace(/\D/g, "");
    if (telefoneNumerico.length < 10) return null;
    
    const nomeNormalizado = nome ? normalizarTexto(nome) : "";
    
    try {
        console.log(`🔍 Buscando cliente com telefone: ${telefoneNumerico} e nome: ${nome}`);
        
        const clientesRef = collection(db, "clientes");
        
        const qExato = query(
            clientesRef, 
            where("telefoneNumerico", "==", telefoneNumerico),
            where("nome", "==", nome)
        );
        const snapshotExato = await getDocs(qExato);
        
        if (!snapshotExato.empty) {
            const clienteDoc = snapshotExato.docs[0];
            const cliente = { id: clienteDoc.id, ...clienteDoc.data() };
            console.log("✅ Cliente encontrado por telefone+nome exato:", cliente.nome);
            return cliente;
        }
        
        const todosClientes = await getDocs(clientesRef);
        for (const doc of todosClientes.docs) {
            const cliente = doc.data();
            const telefoneCliente = cliente.telefoneNumerico || cliente.telefone?.replace(/\D/g, "");
            const nomeClienteNormalizado = normalizarTexto(cliente.nome || "");
            
            if (telefoneCliente === telefoneNumerico && nomeClienteNormalizado === nomeNormalizado) {
                console.log("✅ Cliente encontrado por telefone+nome normalizado:", cliente.nome);
                return { id: doc.id, ...cliente };
            }
        }
        
        console.log("❌ Nenhum cliente encontrado com este telefone e nome");
        return null;
        
    } catch (error) {
        console.error("Erro ao buscar cliente:", error);
        return null;
    }
}

// ==================== FUNÇÃO PARA PROCESSAR CLIENTE ====================
let debounceTimeout = null;

async function processarTelefoneCliente(telefone) {
    if (!telefone || telefone.replace(/\D/g, "").length < 10) {
        clienteSelecionadoParaAgendamento = null;
        return;
    }
    
    const clientes = await buscarTodosClientesPorTelefone(telefone);
    
    if (clientes.length === 0) {
        clienteSelecionadoParaAgendamento = null;
    } 
    else if (clientes.length === 1) {
        const cliente = clientes[0];
        clienteSelecionadoParaAgendamento = {
            id: cliente.id,
            nome: cliente.nome,
            email: cliente.email || "",
            nascimento: cliente.nascimento || "",
            telefone: telefone,
            totalAgendamentos: cliente.totalAgendamentos || 0
        };
        
        if (nomeInput) nomeInput.value = cliente.nome;
        if (emailInput && cliente.email) emailInput.value = cliente.email;
        if (dataNascimentoInput && cliente.nascimento) dataNascimentoInput.value = cliente.nascimento;
        
        if (cliente.nascimento) {
            verificarAniversario(cliente.nascimento, cliente.nome);
        }
        
        console.log(`✅ Cliente único encontrado: ${cliente.nome}`);
    }
    else if (clientes.length > 1) {
        console.log(`⚠️ Múltiplos clientes (${clientes.length}) encontrados com este telefone`);
        
        const nomeDigitado = nomeInput?.value.trim() || "";
        if (nomeDigitado) {
            const matchExato = clientes.find(c => c.nome.toLowerCase() === nomeDigitado.toLowerCase());
            if (matchExato) {
                clienteSelecionadoParaAgendamento = {
                    id: matchExato.id,
                    nome: matchExato.nome,
                    email: matchExato.email || "",
                    nascimento: matchExato.nascimento || "",
                    telefone: telefone,
                    totalAgendamentos: matchExato.totalAgendamentos || 0
                };
                
                if (nomeInput) nomeInput.value = matchExato.nome;
                if (emailInput && matchExato.email) emailInput.value = matchExato.email;
                if (dataNascimentoInput && matchExato.nascimento) dataNascimentoInput.value = matchExato.nascimento;
                
                if (matchExato.nascimento) {
                    verificarAniversario(matchExato.nascimento, matchExato.nome);
                }
                
                console.log(`✅ Match exato encontrado: ${matchExato.nome}`);
                return;
            }
        }
        
        abrirModalSelecionarCliente(clientes, telefone);
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

// ==================== FUNÇÃO DE CLIENTE CORRIGIDA ====================
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
        console.log("📱 Processando cliente - Nome:", nome, "| Telefone:", telefoneNumerico);
        
        let clienteId = null;
        const now = Timestamp.now();
        
        if (clienteSelecionadoParaAgendamento && clienteSelecionadoParaAgendamento.id) {
            console.log("✅ Usando cliente pré-selecionado:", clienteSelecionadoParaAgendamento.nome);
            clienteId = clienteSelecionadoParaAgendamento.id;
            
            const clienteRef = doc(db, "clientes", clienteId);
            const clienteSnap = await getDoc(clienteRef);
            
            if (clienteSnap.exists()) {
                const dadosAtuais = clienteSnap.data();
                await updateDoc(clienteRef, {
                    totalAgendamentos: (dadosAtuais.totalAgendamentos || 0) + 1,
                    ultimoAtendimento: now,
                    atualizadoEm: now,
                    email: email || dadosAtuais.email || "",
                    nascimento: dataNascimento || dadosAtuais.nascimento || ""
                });
                
                console.log("✅ Cliente atualizado! Total de agendamentos agora:", (dadosAtuais.totalAgendamentos || 0) + 1);
                mostrarMensagem(`✅ Bem-vindo de volta, ${dadosAtuais.nome}! Seu agendamento foi confirmado.`, "sucesso");
                
                return clienteId;
            }
        }
        
        const clienteExistente = await buscarClientePorTelefoneENome(telefone, nome);
        
        if (clienteExistente) {
            console.log("✅ Cliente encontrado, atualizando...", clienteExistente.id);
            clienteId = clienteExistente.id;
            const clienteRef = doc(db, "clientes", clienteId);
            
            await updateDoc(clienteRef, {
                totalAgendamentos: (clienteExistente.totalAgendamentos || 0) + 1,
                ultimoAtendimento: now,
                atualizadoEm: now,
                email: email || clienteExistente.email || "",
                nascimento: dataNascimento || clienteExistente.nascimento || ""
            });
            
            console.log("✅ Cliente atualizado! Total de agendamentos agora:", (clienteExistente.totalAgendamentos || 0) + 1);
            mostrarMensagem(`✅ Bem-vindo de volta, ${clienteExistente.nome}! Seu agendamento foi confirmado.`, "sucesso");
            
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

// ==================== ATUALIZAR HORÁRIOS (CORRIGIDO - IGNORA STATUS AUSENTE/CANCELADO) ====================
async function atualizarHorarios() {
    const data = dataInput.value;
    const profissionalId = profissionalSelect?.value;
    const profissionalNome = profissionalSelect?.options[profissionalSelect.selectedIndex]?.getAttribute('data-nome');
    
    console.log("=== INICIANDO VERIFICAÇÃO DE HORÁRIOS ===");
    console.log(`📅 Data: ${data}`);
    console.log(`👨‍🦱 Profissional ID: ${profissionalId}`);
    
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
    
    if (!infoAtendimento.temAtendimento) {
        horariosDiv.innerHTML = `<div class="aviso-campos"><i class="fa-solid fa-calendar-xmark"></i><p>${infoAtendimento.mensagem}</p></div>`;
        return;
    }
    
    horariosDiv.innerHTML = '<div class="loading-horarios"><i class="fas fa-spinner fa-spin"></i> Verificando horários disponíveis...</div>';
    
    try {
        const agendamentosRef = collection(db, "agendamentos");
        
        // Buscar TODOS os agendamentos da data e profissional
        const q = query(
            agendamentosRef, 
            where("data", "==", data), 
            where("profissionalId", "==", profissionalId)
        );
        
        const snapshot = await getDocs(q);
        
        // Status que ocupam horário (confirmado ou pendente)
        const statusOcupados = ["confirmado", "pendente"];
        const horariosOcupados = [];
        
        console.log(`📊 TOTAL de agendamentos encontrados: ${snapshot.size}`);
        
        snapshot.forEach(doc => {
            const agendamento = doc.data();
            const status = agendamento.status;
            const horario = agendamento.horario;
            
            if (statusOcupados.includes(status)) {
                if (horario) {
                    horariosOcupados.push({
                        horario: horario,
                        duracaoTotal: agendamento.duracaoTotal || 60,
                        status: status
                    });
                    console.log(`   🔴 OCUPADO: ${horario} (status: ${status})`);
                }
            } else {
                console.log(`   🟢 IGNORADO/LIBERADO: ${horario} (status: ${status})`);
            }
        });
        
        console.log(`📊 Horários efetivamente ocupados: ${horariosOcupados.length}`);
        
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
        
        const horariosBloqueadosManualmente = new Set();
        for (const bloqueio of bloqueios) {
            if (bloqueio.tipo === "horario" && bloqueio.horario) {
                horariosBloqueadosManualmente.add(bloqueio.horario);
            }
        }
        
        const limiteMinutos = horarioParaMinutos(HORARIO_LIMITE);
        const horariosDisponiveis = [];
        const horariosIndisponiveis = [];
        
        for (const horarioBase of infoAtendimento.horarios) {
            if (horariosBloqueadosManualmente.has(horarioBase)) {
                horariosIndisponiveis.push(horarioBase);
                continue;
            }
            
            const inicioMinutos = horarioParaMinutos(horarioBase);
            const fimMinutos = inicioMinutos + duracaoTotal;
            
            if (fimMinutos > limiteMinutos) {
                horariosIndisponiveis.push(horarioBase);
                continue;
            }
            
            let conflito = false;
            for (const ocupado of horariosOcupados) {
                const ocupadoInicio = horarioParaMinutos(ocupado.horario);
                const ocupadoFim = ocupadoInicio + (ocupado.duracaoTotal || 60);
                if (inicioMinutos < ocupadoFim && fimMinutos > ocupadoInicio) {
                    conflito = true;
                    break;
                }
            }
            
            if (conflito) {
                horariosIndisponiveis.push(horarioBase);
            } else {
                horariosDisponiveis.push(horarioBase);
            }
        }
        
        console.log(`✅ Horários disponíveis: ${horariosDisponiveis.length}`);
        console.log(`   Disponíveis: ${horariosDisponiveis.join(', ')}`);
        console.log(`   Indisponíveis: ${horariosIndisponiveis.join(', ')}`);
        
        renderizarHorarios(horariosDisponiveis, horariosIndisponiveis, infoAtendimento, duracaoTotal);
        
    } catch (error) {
        console.error("❌ Erro ao buscar horários:", error);
        horariosDiv.innerHTML = `<div class="aviso-campos erro"><i class="fa-solid fa-circle-exclamation"></i><p>Erro ao carregar horários: ${error.message}</p></div>`;
    }
}

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
        btn.textContent = hora;
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
        
        if (data && horario && profissionalId) {
            const agendamentosRef = collection(db, "agendamentos");
            const q = query(
                agendamentosRef, 
                where("data", "==", data), 
                where("horario", "==", horario),
                where("profissionalId", "==", profissionalId),
                where("status", "in", ["confirmado", "pendente"])
            );
            const existingSnap = await getDocs(q);
            
            if (!existingSnap.empty) {
                mostrarMensagem("❌ Este horário não está mais disponível. Por favor, selecione outro horário.", "erro");
                await atualizarHorarios();
                return;
            }
            
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
            
            clienteSelecionadoParaAgendamento = null;
            
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
        
        clearTimeout(debounceTimeout);
        const telefone = e.target.value;
        if (telefone.replace(/\D/g, "").length >= 10) {
            debounceTimeout = setTimeout(() => {
                processarTelefoneCliente(telefone);
            }, 800);
        } else {
            clienteSelecionadoParaAgendamento = null;
        }
    });
    
    telefoneInput.addEventListener('blur', () => {
        const telefone = telefoneInput.value;
        if (telefone.replace(/\D/g, "").length >= 10) {
            processarTelefoneCliente(telefone);
        }
    });
}

if (btnFecharModal) {
    btnFecharModal.addEventListener('click', fecharModal);
}

window.addEventListener('click', (e) => {
    if (modalSelecionarCliente && e.target === modalSelecionarCliente) {
        fecharModal();
    }
});

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

// ==================== LISTENERS PARA HORÁRIOS LIBERADOS ====================
window.recarregarHorariosDisponiveis = function(data, profissionalId) {
    console.log("🔄 Agenda: Recarregando horários para:", data, profissionalId);
    
    const dataInput = document.getElementById("data");
    const profissionalSelect = document.getElementById("profissional");
    
    if (dataInput && dataInput.value === data) {
        console.log("✅ Data corresponde, recarregando horários...");
        if (typeof atualizarHorarios === 'function') {
            setTimeout(() => atualizarHorarios(), 300);
        }
    }
};

window.addEventListener('horarioLiberado', (event) => {
    console.log("🔔 Agenda: Horário liberado recebido!", event.detail);
    console.log(`   Data: ${event.detail.data}, Horário: ${event.detail.horario}, Ação: ${event.detail.acao}`);
    
    if (typeof mostrarMensagem === 'function') {
        mostrarMensagem(`🔓 Horário ${event.detail.horario} do dia ${event.detail.data} foi liberado e está disponível!`, "sucesso");
    }
    
    const dataInput = document.getElementById("data");
    if (dataInput && dataInput.value === event.detail.data) {
        if (typeof atualizarHorarios === 'function') {
            atualizarHorarios();
        }
    }
});

window.addEventListener('storage', (e) => {
    if (e.key === 'forcarAtualizacaoAgenda' && e.newValue) {
        try {
            const data = JSON.parse(e.newValue);
            console.log("🔔 Forçando atualização da agenda via localStorage:", data);
            
            if (typeof atualizarHorarios === 'function') {
                const dataInput = document.getElementById("data");
                if (dataInput && dataInput.value === data.data) {
                    setTimeout(() => atualizarHorarios(), 200);
                }
            }
        } catch(e) {}
    }
    
    if (e.key === 'horarioLiberado' && e.newValue) {
        try {
            const data = JSON.parse(e.newValue);
            console.log("🔔 Horário liberado detectado em outra aba:", data);
            
            if (typeof mostrarMensagem === 'function') {
                mostrarMensagem(`🔓 Horário ${data.horario} foi liberado e está disponível!`, "sucesso");
            }
            
            if (typeof atualizarHorarios === 'function') {
                const dataInput = document.getElementById("data");
                if (dataInput && dataInput.value === data.data) {
                    setTimeout(() => atualizarHorarios(), 200);
                }
            }
        } catch(e) {}
    }
});

console.log("✅ agendamento.js carregado com sucesso!");
console.log("📋 Horários Segunda à Quarta:", horariosSegundaQuarta);
console.log("📋 Horários Quinta à Sábado:", horariosQuintaSabado);
console.log("🔒 Sistema de bloqueios integrado!");
console.log("👨‍👦 MODAL para seleção de múltiplos clientes com mesmo telefone!");
console.log("✅ FILTRO DE HORÁRIOS: Ignora agendamentos com status ausente/cancelado!");