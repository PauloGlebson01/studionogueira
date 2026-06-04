// agendamento.js - Versão com PREENCHIMENTO AUTOMÁTICO de dados do cliente
// Ao digitar o telefone, busca automaticamente os dados do cliente se já existir

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

const horariosDisponiveis = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

let camposPreenchidos = { nome: false, telefone: false, profissional: false, data: false, servicos: false };
let usuarioAutenticado = false;
let servicosDisponiveis = [];
let pacoteAtual = null;

// ==================== FUNÇÃO PARA NORMALIZAR TEXTOS ====================
function normalizarTexto(texto) {
    if (!texto) return '';
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u0301]/g, '').trim();
}

// ==================== FUNÇÃO PARA FORMATAR TELEFONE ====================
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
        
        // Buscar por telefoneNumerico (campo que salvamos)
        const qNumerico = query(clientesRef, where("telefoneNumerico", "==", telefoneNumerico));
        const snapshotNumerico = await getDocs(qNumerico);
        
        if (!snapshotNumerico.empty) {
            const clienteDoc = snapshotNumerico.docs[0];
            const cliente = { id: clienteDoc.id, ...clienteDoc.data() };
            console.log("✅ Cliente encontrado por telefoneNumerico:", cliente);
            return cliente;
        }
        
        // Buscar por telefone normal
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

// ==================== FUNÇÃO PARA AUTO PREENCHER DADOS DO CLIENTE ====================
async function autoPreencherDadosCliente() {
    const telefone = telefoneInput?.value || "";
    const telefoneNumerico = telefone.replace(/\D/g, "");
    
    if (telefoneNumerico.length < 10) return;
    
    console.log(`🔍 Verificando cliente com telefone: ${telefoneNumerico}`);
    
    // Mostrar indicador de carregamento
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
        
        // Remover loader
        const loader = document.getElementById('clienteLoader');
        if (loader) loader.remove();
        
        if (cliente) {
            console.log("🎯 Cliente encontrado! Preenchendo dados automaticamente:", cliente.nome);
            
            // Preencher dados do cliente automaticamente
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
            
            // Exibir mensagem de boas-vindas
            const clienteNome = cliente.nome.split(' ')[0]; // Primeiro nome
            const totalAgendamentos = cliente.totalAgendamentos || 0;
            
            if (totalAgendamentos > 0) {
                mostrarMensagem(`🎉 Bem-vindo de volta, ${clienteNome}! Seus dados foram preenchidos automaticamente.`, "sucesso");
            } else {
                mostrarMensagem(`✨ Olá ${clienteNome}! Seus dados foram carregados.`, "sucesso");
            }
            
            // Verificar se é aniversário do cliente
            if (cliente.nascimento) {
                const hoje = new Date();
                const nascimento = new Date(cliente.nascimento);
                if (nascimento.getMonth() === hoje.getMonth() && nascimento.getDate() === hoje.getDate()) {
                    mostrarMensagem(`🎂🎉 FELIZ ANIVERSÁRIO, ${clienteNome.toUpperCase()}! 🎉🎂 Você ganha 10% de desconto hoje!`, "sucesso");
                    
                    // Aplicar desconto de aniversário se tiver serviço selecionado
                    setTimeout(() => {
                        aplicarDescontoAniversario();
                    }, 500);
                }
            }
            
            // Forçar validação de campos
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

// ==================== FUNÇÃO PARA APLICAR DESCONTO DE ANIVERSÁRIO ====================
function aplicarDescontoAniversario() {
    if (!pacoteAtual) {
        // Calcular total atual
        let totalAtual = 0;
        document.querySelectorAll('.servico-select').forEach(select => {
            const selectedOption = select.options[select.selectedIndex];
            const preco = parseFloat(selectedOption?.getAttribute('data-preco') || 0);
            totalAtual += preco;
        });
        
        if (totalAtual > 0) {
            const desconto = totalAtual * 0.10;
            const novoTotal = totalAtual - desconto;
            
            // Mostrar informação do desconto
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

// ==================== FUNÇÃO PARA BUSCAR TODOS OS AGENDAMENTOS DO CLIENTE ====================
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

// ==================== FUNÇÃO PARA MOSTRAR HISTÓRICO DO CLIENTE ====================
async function mostrarHistoricoCliente() {
    const telefone = telefoneInput?.value || "";
    const telefoneNumerico = telefone.replace(/\D/g, "");
    
    if (telefoneNumerico.length < 10) return;
    
    const agendamentos = await buscarAgendamentosCliente(telefone);
    
    if (agendamentos.length === 0) return;
    
    // Criar elemento de histórico
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

// ==================== FUNÇÃO PARA REMOVER HISTÓRICO ====================
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

// ==================== BUSCAR DADOS COMPLETOS DO PACOTE ====================
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

// ==================== PROCESSAR PACOTE DA URL ====================
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
            servicos: pacoteAtual.servicos || []
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

// ==================== PROCESSAR PARÂMETROS DE PROFISSIONAL ====================
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

// ==================== CARREGAR PROFISSIONAIS ====================
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
        option.textContent = `${servico.nome} - ${formatarMoeda(servico.preco)}`;
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
    });
    
    const btnRemover = novoServico.querySelector('.btn-remover-servico');
    btnRemover.addEventListener('click', () => {
        if (document.querySelectorAll('.servico-item').length > 1) {
            novoServico.remove();
            calcularValorTotal();
            verificarCamposPreenchidos();
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
        });
    });
}

// ==================== FUNÇÃO DE CLIENTE (COM AUTO PREENCHIMENTO) ====================
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
        
        // Buscar por telefone
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

function getInfoAtendimentoPorDia(dataStr) {
    const diaSemana = getDiaSemana(dataStr);
    if (diaSemana === 0) return { temAtendimento: false, mensagem: "Não atendemos aos domingos." };
    return { temAtendimento: true, horarios: horariosDisponiveis, mensagem: "Atendimento Presencial" };
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

// ==================== ATUALIZAR HORÁRIOS ====================
async function atualizarHorarios() {
    const data = dataInput.value;
    const profissionalId = profissionalSelect?.value;
    const profissionalNome = profissionalSelect?.options[profissionalSelect.selectedIndex]?.getAttribute('data-nome');
    
    if (!data || !profissionalId) return;
    
    const infoAtendimento = getInfoAtendimentoPorDia(data);
    if (!infoAtendimento.temAtendimento) {
        horariosDiv.innerHTML = `<div class="aviso-campos"><i class="fa-solid fa-calendar-xmark"></i><p>${infoAtendimento.mensagem}</p></div>`;
        return;
    }
    
    horariosDiv.innerHTML = '<div class="loading-horarios"><i class="fas fa-spinner fa-spin"></i> Verificando horários...</div>';
    
    try {
        const agendamentosRef = collection(db, "agendamentos");
        const q1 = query(agendamentosRef, where("data", "==", data), where("profissionalId", "==", profissionalId));
        const q2 = query(agendamentosRef, where("data", "==", data), where("profissional", "==", profissionalNome));
        
        const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        
        const comandasRef = collection(db, "comandas");
        const comandasQuery = query(comandasRef, where("status", "==", "finalizada"));
        const comandasSnapshot = await getDocs(comandasQuery);
        
        const agendamentosFinalizados = new Set();
        comandasSnapshot.forEach(doc => {
            const comanda = doc.data();
            if (comanda.agendamentoId) {
                agendamentosFinalizados.add(comanda.agendamentoId);
            }
        });
        
        const ocupados = new Set();
        
        function isHorarioOcupado(agendamento, agendamentoId) {
            const status = agendamento.status;
            if (status === 'confirmado' || status === 'aguardando_pagamento') return true;
            if (status === 'finalizado') return true;
            if (agendamentosFinalizados.has(agendamentoId)) return true;
            return false;
        }
        
        snapshot1.forEach(doc => {
            const agendamento = doc.data();
            const agendamentoId = doc.id;
            if (isHorarioOcupado(agendamento, agendamentoId) && agendamento.horario) {
                ocupados.add(agendamento.horario);
            }
        });
        
        snapshot2.forEach(doc => {
            const agendamento = doc.data();
            const agendamentoId = doc.id;
            if (isHorarioOcupado(agendamento, agendamentoId) && agendamento.horario) {
                ocupados.add(agendamento.horario);
            }
        });
        
        renderizarHorarios(Array.from(ocupados));
        
    } catch (error) {
        console.error("Erro ao buscar horários:", error);
        horariosDiv.innerHTML = `<div class="aviso-campos erro"><i class="fa-solid fa-circle-exclamation"></i><p>Erro ao carregar horários</p></div>`;
    }
}

function renderizarHorarios(ocupados = []) {
    const nomeDia = getNomeDiaSemana(dataInput.value);
    horariosDiv.innerHTML = '';
    const infoHeader = document.createElement('div');
    infoHeader.style.cssText = `background:#e8f4fd;padding:14px 16px;border-radius:16px;margin-bottom:20px;text-align:center;border-left:4px solid #2199EF;`;
    infoHeader.innerHTML = `<div><h3 style="margin:0;color:#2199EF;">Horários Disponíveis - ${nomeDia}</h3></div>`;
    horariosDiv.appendChild(infoHeader);
    const containerBotoes = document.createElement('div');
    containerBotoes.className = 'botoes-horarios';
    horariosDisponiveis.forEach(hora => {
        const isOcupado = ocupados.includes(hora);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `horario-btn ${isOcupado ? 'indisponivel' : ''}`;
        btn.textContent = hora;
        if (isOcupado) {
            btn.disabled = true;
            btn.title = "Horário indisponível";
        } else {
            btn.onclick = () => {
                document.querySelectorAll(".horario-btn").forEach(b => b.classList.remove("selecionado"));
                btn.classList.add("selecionado");
                horarioHidden.value = hora;
            };
        }
        containerBotoes.appendChild(btn);
    });
    horariosDiv.appendChild(containerBotoes);
    
    if (ocupados.length > 0) {
        const infoOcupados = document.createElement('div');
        infoOcupados.style.cssText = `margin-top:16px;padding:8px 12px;background:#fef2e8;border-radius:12px;font-size:0.75rem;color:#c2410c;text-align:center;`;
        infoOcupados.innerHTML = `<i class="fa-solid fa-clock"></i> Horários indisponíveis: ${ocupados.join(', ')}`;
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
        console.log("  Email:", email);
        
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
                    servicosLista.push({ 
                        id: servicoId, 
                        nome: select.value, 
                        preco: preco,
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
if (profissionalSelect) profissionalSelect.addEventListener('change', verificarCamposPreenchidos);
if (dataInput) dataInput.addEventListener('change', () => { horarioHidden.value = ''; verificarCamposPreenchidos(); });

// ==================== AUTO PREENCHIMENTO AO DIGITAR TELEFONE ====================
if (telefoneInput) {
    telefoneInput.addEventListener('input', (e) => {
        e.target.value = formatarTelefone(e.target.value);
        verificarCamposPreenchidos();
        
        // Adicionar debounce para não buscar a cada tecla
        clearTimeout(window.telefoneDebounce);
        window.telefoneDebounce = setTimeout(() => {
            autoPreencherDadosCliente();
        }, 800);
    });
    
    // Quando sair do campo telefone, buscar imediatamente
    telefoneInput.addEventListener('blur', () => {
        autoPreencherDadosCliente();
        mostrarHistoricoCliente();
    });
    
    // Quando limpar o telefone, remover histórico
    telefoneInput.addEventListener('focus', () => {
        if (!telefoneInput.value) {
            removerHistoricoCliente();
        }
    });
}

if (servicosContainer && !pacoteAtual) {
    const observer = new MutationObserver(() => { configurarEventosServicos(); verificarCamposPreenchidos(); });
    observer.observe(servicosContainer, { childList: true, subtree: true });
}

configurarDataMinima();
configurarEventosServicos();
calcularValorTotal();

console.log("✅ agendamento.js carregado com sucesso - Com AUTO PREENCHIMENTO de dados do cliente!");