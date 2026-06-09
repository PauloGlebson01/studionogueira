// bloqueios.js - Gerenciamento de bloqueios de agenda para admin COM DIAGNÓSTICO

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    query, 
    orderBy,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

// Constantes de horários
const horariosSegundaQuarta = [
    "08:20", "09:00", "09:40", "10:20", "11:00", "11:40",
    "14:00", "14:40", "15:20", "16:00", "16:40", "17:20", "18:00"
];

const horariosQuintaSabado = [
    "08:00", "08:40", "09:20", "10:00", "10:40", "11:20",
    "14:00", "14:40", "15:20", "16:00", "16:40", "17:20", "18:00", "18:40"
];

const todosHorarios = [...new Set([...horariosSegundaQuarta, ...horariosQuintaSabado])].sort();

// Elementos DOM
const tipoBloqueio = document.getElementById("tipoBloqueio");
const camposDia = document.getElementById("camposDia");
const camposPeriodo = document.getElementById("camposPeriodo");
const camposHorario = document.getElementById("camposHorario");
const horariosMultiplos = document.getElementById("horariosMultiplos");
const profissionalSelect = document.getElementById("profissionalBloqueio");
const btnNovoBloqueio = document.getElementById("btnNovoBloqueio");
const formBloqueio = document.getElementById("formBloqueio");
const filtroBusca = document.getElementById("filtroBusca");
const filtroTipo = document.getElementById("filtroTipo");
const logoutBtn = document.getElementById("logout");

let profissionais = [];
let todosBloqueios = [];

// Mostrar notificação melhorada
function mostrarNotificacao(mensagem, tipo = "sucesso") {
    console.log(`[${tipo.toUpperCase()}] ${mensagem}`);
    
    // Mostrar notificação visual também
    const notificacao = document.getElementById("notificacao");
    if (notificacao) {
        const icon = notificacao.querySelector("i");
        const span = notificacao.querySelector("span");
        
        if (tipo === "erro") {
            icon.className = "fa-solid fa-circle-exclamation";
            notificacao.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
        } else if (tipo === "sucesso") {
            icon.className = "fa-solid fa-circle-check";
            notificacao.style.background = "linear-gradient(135deg, #10b981, #059669)";
        } else {
            icon.className = "fa-solid fa-bell";
            notificacao.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
        }
        
        span.textContent = mensagem;
        notificacao.style.display = "flex";
        
        setTimeout(() => {
            notificacao.style.display = "none";
        }, 3000);
    }
}

// Carregar profissionais
async function carregarProfissionais() {
    try {
        console.log("🔍 Buscando profissionais...");
        const profissionaisRef = collection(db, "profissionais");
        const snapshot = await getDocs(profissionaisRef);
        profissionais = [];
        snapshot.forEach(doc => {
            profissionais.push({ id: doc.id, nome: doc.data().nome });
        });
        
        console.log(`✅ ${profissionais.length} profissionais carregados:`, profissionais);
        
        if (profissionalSelect) {
            profissionalSelect.innerHTML = '<option value="">Todos os barbeiros</option>';
            profissionais.forEach(prof => {
                const option = document.createElement("option");
                option.value = prof.id;
                option.textContent = prof.nome;
                profissionalSelect.appendChild(option);
            });
        }
        
        if (profissionais.length === 0) {
            mostrarNotificacao("Nenhum profissional encontrado. Cadastre barbeiros primeiro.", "aviso");
        }
    } catch (error) {
        console.error("❌ Erro ao carregar profissionais:", error);
        mostrarNotificacao("Erro ao carregar profissionais: " + error.message, "erro");
    }
}

// Popular horários
function popularHorariosMultiplos() {
    if (!horariosMultiplos) return;
    horariosMultiplos.innerHTML = '';
    todosHorarios.forEach(horario => {
        const label = document.createElement("label");
        label.className = "horario-check";
        label.innerHTML = `
            <input type="checkbox" value="${horario}">
            <span>${horario}</span>
        `;
        horariosMultiplos.appendChild(label);
    });
    console.log(`✅ ${todosHorarios.length} horários disponíveis carregados`);
}

// Gerenciar campos baseado no tipo de bloqueio
if (tipoBloqueio) {
    tipoBloqueio.addEventListener("change", () => {
        const tipo = tipoBloqueio.value;
        if (camposDia) camposDia.style.display = "none";
        if (camposPeriodo) camposPeriodo.style.display = "none";
        if (camposHorario) camposHorario.style.display = "none";
        
        if (tipo === "dia") {
            if (camposDia) camposDia.style.display = "block";
        } else if (tipo === "periodo") {
            if (camposPeriodo) camposPeriodo.style.display = "block";
        } else if (tipo === "horario") {
            if (camposHorario) camposHorario.style.display = "block";
        }
    });
}

// Obtém a data atual no formato YYYY-MM-DD
function getDataHojeLocal() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// Carregar todos os bloqueios
async function carregarBloqueios() {
    try {
        console.log("🔄 Carregando bloqueios do Firebase...");
        
        // Verificar conexão com Firebase
        if (!db) {
            throw new Error("Firestore não inicializado");
        }
        
        const bloqueiosRef = collection(db, "bloqueios");
        const q = query(bloqueiosRef, orderBy("criadoEm", "desc"));
        const snapshot = await getDocs(q);
        
        console.log(`📊 Documentos encontrados: ${snapshot.size}`);
        
        const hojeStr = getDataHojeLocal();
        console.log(`📅 Data atual para referência: ${hojeStr}`);
        
        todosBloqueios = [];
        
        if (snapshot.size === 0) {
            console.log("ℹ️ Nenhum bloqueio encontrado no Firebase");
            mostrarNotificacao("Nenhum bloqueio encontrado. Crie seu primeiro bloqueio!", "aviso");
        }
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const bloqueio = { id: doc.id, ...data };
            
            console.log(`📄 Bloqueio #${doc.id}:`, bloqueio);
            
            let isAtivo = true;
            
            if (bloqueio.ativo === false) {
                isAtivo = false;
            }
            else if (bloqueio.tipo === "periodo" && bloqueio.dataFim) {
                isAtivo = bloqueio.dataFim >= hojeStr;
            }
            else if ((bloqueio.tipo === "dia" || bloqueio.tipo === "horario") && bloqueio.data) {
                isAtivo = bloqueio.data >= hojeStr;
            }
            
            todosBloqueios.push({
                ...bloqueio,
                isAtivo: isAtivo
            });
        });
        
        console.log(`✅ Total de bloqueios processados: ${todosBloqueios.length}`);
        console.log(`   - Ativos: ${todosBloqueios.filter(b => b.isAtivo).length}`);
        console.log(`   - Expirados: ${todosBloqueios.filter(b => !b.isAtivo).length}`);
        
        renderizarBloqueios();
        
        if (todosBloqueios.length === 0) {
            const containerAtivos = document.getElementById("bloqueiosAtivos");
            if (containerAtivos) {
                containerAtivos.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-calendar-times"></i>
                        <p>Nenhum bloqueio cadastrado</p>
                        <small>Clique em "Novo Bloqueio" para começar</small>
                    </div>
                `;
            }
        }
        
    } catch (error) {
        console.error("❌ Erro CRÍTICO ao carregar bloqueios:", error);
        console.error("Detalhes do erro:", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        
        mostrarNotificacao("Erro ao carregar bloqueios: " + error.message, "erro");
        
        // Mostrar erro na tela
        const containerAtivos = document.getElementById("bloqueiosAtivos");
        if (containerAtivos) {
            containerAtivos.innerHTML = `
                <div class="empty-state" style="border: 1px solid #ef4444; background: rgba(239,68,68,0.1);">
                    <i class="fa-solid fa-circle-exclamation" style="color: #ef4444;"></i>
                    <p style="color: #ef4444;">Erro ao carregar bloqueios</p>
                    <small>${error.message}</small>
                    <br><br>
                    <button onclick="location.reload()" class="btn-bloqueio" style="margin-top: 10px;">
                        <i class="fa-solid fa-rotate-right"></i> Tentar novamente
                    </button>
                </div>
            `;
        }
        
        const containerHistorico = document.getElementById("bloqueiosHistorico");
        if (containerHistorico) {
            containerHistorico.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <p>Não foi possível carregar o histórico</p>
                </div>
            `;
        }
    }
}

// Renderizar bloqueios
function renderizarBloqueios() {
    const containerAtivos = document.getElementById("bloqueiosAtivos");
    const containerHistorico = document.getElementById("bloqueiosHistorico");
    
    if (!containerAtivos || !containerHistorico) {
        console.error("❌ Containers não encontrados!");
        return;
    }
    
    let filtroTexto = filtroBusca?.value.toLowerCase() || "";
    let filtroTipoValor = filtroTipo?.value || "";
    
    const ativos = todosBloqueios.filter(b => b.isAtivo === true);
    const historico = todosBloqueios.filter(b => b.isAtivo === false);
    
    let filtradosAtivos = ativos.filter(b => {
        if (filtroTipoValor && b.tipo !== filtroTipoValor) return false;
        if (filtroTexto) {
            const info = `${b.data || ''} ${b.dataInicio || ''} ${b.dataFim || ''} ${b.motivo || ''} ${b.tipo || ''}`.toLowerCase();
            return info.includes(filtroTexto);
        }
        return true;
    });
    
    let filtradosHistorico = historico.filter(b => {
        if (filtroTipoValor && b.tipo !== filtroTipoValor) return false;
        if (filtroTexto) {
            const info = `${b.data || ''} ${b.dataInicio || ''} ${b.dataFim || ''} ${b.motivo || ''} ${b.tipo || ''}`.toLowerCase();
            return info.includes(filtroTexto);
        }
        return true;
    });
    
    // Ordenar ativos por data
    filtradosAtivos.sort((a, b) => {
        const dataA = a.data || a.dataInicio || '';
        const dataB = b.data || b.dataInicio || '';
        return dataA.localeCompare(dataB);
    });
    
    filtradosHistorico.sort((a, b) => {
        const dataA = a.data || a.dataInicio || '';
        const dataB = b.data || b.dataInicio || '';
        return dataB.localeCompare(dataA);
    });
    
    console.log(`🎨 Renderizando: ${filtradosAtivos.length} ativos, ${filtradosHistorico.length} histórico`);
    
    containerAtivos.innerHTML = '';
    containerHistorico.innerHTML = '';
    
    if (filtradosAtivos.length === 0) {
        containerAtivos.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-calendar-check"></i>
                <p>Nenhum bloqueio ativo</p>
                <small>Clique em "Novo Bloqueio" para adicionar</small>
            </div>
        `;
    } else {
        filtradosAtivos.forEach(bloqueio => {
            containerAtivos.appendChild(criarCardBloqueio(bloqueio, true));
        });
    }
    
    if (filtradosHistorico.length === 0) {
        containerHistorico.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-clock-rotate-left"></i>
                <p>Nenhum bloqueio no histórico</p>
            </div>
        `;
    } else {
        filtradosHistorico.forEach(bloqueio => {
            containerHistorico.appendChild(criarCardBloqueio(bloqueio, false));
        });
    }
}

// Criar card de bloqueio
function criarCardBloqueio(bloqueio, isAtivo) {
    const div = document.createElement("div");
    div.className = "bloqueio-card";
    
    let infoHtml = "";
    let tipoIcon = "";
    let tipoLabel = "";
    
    switch (bloqueio.tipo) {
        case "dia":
            tipoIcon = "fa-solid fa-calendar-day";
            tipoLabel = "Dia Inteiro";
            infoHtml = `<strong>${formatarData(bloqueio.data)}</strong> - Todos os horários bloqueados`;
            break;
        case "periodo":
            tipoIcon = "fa-solid fa-calendar-range";
            tipoLabel = "Período";
            infoHtml = `<strong>${formatarData(bloqueio.dataInicio)} até ${formatarData(bloqueio.dataFim)}</strong> - Todos os dias e horários bloqueados`;
            break;
        case "horario":
            tipoIcon = "fa-solid fa-clock";
            tipoLabel = "Horário Específico";
            const profissional = profissionais.find(p => p.id === bloqueio.profissionalId);
            const profTexto = profissional ? ` para ${profissional.nome}` : " para todos os barbeiros";
            infoHtml = `<strong>${formatarData(bloqueio.data)}</strong> - Horário ${bloqueio.horario} bloqueado${profTexto}`;
            break;
        default:
            tipoIcon = "fa-solid fa-lock";
            tipoLabel = "Bloqueio";
            infoHtml = `<strong>${formatarData(bloqueio.data)}</strong> - Bloqueado`;
    }
    
    div.innerHTML = `
        <div class="bloqueio-info">
            <h4>
                <i class="${tipoIcon}"></i>
                <span>${tipoLabel}</span>
                <span class="badge" style="${isAtivo ? 'background:rgba(16,185,129,0.2);color:#10b981;' : 'background:rgba(239,68,68,0.2);color:#ef4444;'}">
                    ${isAtivo ? 'Ativo' : 'Expirado'}
                </span>
            </h4>
            <p>${infoHtml}</p>
            ${bloqueio.motivo ? `<div class="motivo"><i class="fa-solid fa-comment"></i> ${bloqueio.motivo}</div>` : ''}
            <small style="color: var(--text-muted); font-size: 0.65rem;">
                Criado em: ${formatarDataHora(bloqueio.criadoEm)}
            </small>
        </div>
        <div class="bloqueio-actions">
            <button class="btn-icon btn-delete" data-id="${bloqueio.id}">
                <i class="fa-solid fa-trash"></i> Excluir
            </button>
        </div>
    `;
    
    const deleteBtn = div.querySelector(".btn-delete");
    deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const mensagem = isAtivo 
            ? "Tem certeza que deseja excluir este bloqueio ativo? O horário voltará a ficar disponível para agendamentos imediatamente."
            : "Tem certeza que deseja excluir este bloqueio do histórico?";
        
        if (confirm(mensagem)) {
            try {
                await deleteDoc(doc(db, "bloqueios", bloqueio.id));
                console.log("✅ Bloqueio excluído com sucesso!");
                mostrarNotificacao("Bloqueio excluído com sucesso!", "sucesso");
                await carregarBloqueios();
            } catch (error) {
                console.error("Erro ao excluir bloqueio:", error);
                mostrarNotificacao("Erro ao excluir bloqueio: " + error.message, "erro");
            }
        }
    });
    
    return div;
}

// Formatar data
function formatarData(dataStr) {
    if (!dataStr) return "";
    const partes = dataStr.split("-");
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataStr;
}

function formatarDataHora(timestamp) {
    if (!timestamp) return "Data desconhecida";
    if (timestamp.toDate) {
        const date = timestamp.toDate();
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return timestamp;
}

// Configurar data mínima nos inputs
function configurarDataMinima() {
    const hoje = getDataHojeLocal();
    const dataInputs = ['dataBloqueio', 'dataHorarioBloqueio', 'dataInicioBloqueio', 'dataFimBloqueio'];
    dataInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.min = hoje;
    });
}

// Salvar bloqueio
if (formBloqueio) {
    formBloqueio.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const tipo = tipoBloqueio.value;
        const motivo = document.getElementById("motivoBloqueio").value;
        
        let dadosBloqueio = {
            tipo,
            motivo: motivo || null,
            ativo: true,
            criadoEm: Timestamp.now(),
            criadoPor: "admin"
        };
        
        if (tipo === "dia") {
            const data = document.getElementById("dataBloqueio").value;
            if (!data) {
                mostrarNotificacao("Selecione uma data", "erro");
                return;
            }
            dadosBloqueio.data = data;
            dadosBloqueio.diaInteiro = true;
            
            try {
                await addDoc(collection(db, "bloqueios"), dadosBloqueio);
                console.log("✅ Bloqueio de dia inteiro adicionado com sucesso!");
                mostrarNotificacao("Bloqueio de dia inteiro criado com sucesso!", "sucesso");
                closeModal();
                formBloqueio.reset();
                tipoBloqueio.dispatchEvent(new Event("change"));
                await carregarBloqueios();
            } catch (error) {
                console.error("Erro ao salvar bloqueio:", error);
                mostrarNotificacao("Erro ao salvar bloqueio: " + error.message, "erro");
            }
        } 
        else if (tipo === "periodo") {
            const dataInicio = document.getElementById("dataInicioBloqueio").value;
            const dataFim = document.getElementById("dataFimBloqueio").value;
            if (!dataInicio || !dataFim) {
                mostrarNotificacao("Selecione o período", "erro");
                return;
            }
            if (dataInicio > dataFim) {
                mostrarNotificacao("Data inicial não pode ser maior que data final", "erro");
                return;
            }
            dadosBloqueio.dataInicio = dataInicio;
            dadosBloqueio.dataFim = dataFim;
            dadosBloqueio.periodoCompleto = true;
            
            try {
                await addDoc(collection(db, "bloqueios"), dadosBloqueio);
                console.log("✅ Bloqueio de período adicionado com sucesso!");
                mostrarNotificacao("Bloqueio de período criado com sucesso!", "sucesso");
                closeModal();
                formBloqueio.reset();
                tipoBloqueio.dispatchEvent(new Event("change"));
                await carregarBloqueios();
            } catch (error) {
                console.error("Erro ao salvar bloqueio:", error);
                mostrarNotificacao("Erro ao salvar bloqueio: " + error.message, "erro");
            }
        }
        else if (tipo === "horario") {
            const data = document.getElementById("dataHorarioBloqueio").value;
            const profissionalId = profissionalSelect.value;
            
            if (!data) {
                mostrarNotificacao("Selecione uma data", "erro");
                return;
            }
            
            const horariosSelecionados = [];
            document.querySelectorAll('#horariosMultiplos input[type="checkbox"]').forEach(cb => {
                if (cb.checked) horariosSelecionados.push(cb.value);
            });
            
            if (horariosSelecionados.length === 0) {
                mostrarNotificacao("Selecione pelo menos um horário", "erro");
                return;
            }
            
            dadosBloqueio.data = data;
            if (profissionalId) dadosBloqueio.profissionalId = profissionalId;
            
            let sucessos = 0;
            let erros = 0;
            
            for (const horario of horariosSelecionados) {
                const bloqueioHorario = { ...dadosBloqueio, horario };
                try {
                    await addDoc(collection(db, "bloqueios"), bloqueioHorario);
                    sucessos++;
                } catch (err) {
                    console.error("Erro ao adicionar horário:", horario, err);
                    erros++;
                }
            }
            
            if (sucessos > 0) {
                console.log(`✅ ${sucessos} bloqueio(s) adicionado(s) com sucesso!`);
                mostrarNotificacao(`${sucessos} bloqueio(s) criado(s) com sucesso!${erros > 0 ? ` (${erros} falhas)` : ''}`, "sucesso");
                closeModal();
                formBloqueio.reset();
                tipoBloqueio.dispatchEvent(new Event("change"));
                
                document.querySelectorAll('#horariosMultiplos input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                });
                
                await carregarBloqueios();
            } else {
                mostrarNotificacao("Erro ao adicionar bloqueios", "erro");
            }
        }
    });
}

// Abrir modal para novo bloqueio
if (btnNovoBloqueio) {
    btnNovoBloqueio.addEventListener("click", () => {
        console.log("📝 Abrindo modal para novo bloqueio");
        const modalTitle = document.getElementById("modalTitle");
        if (modalTitle) modalTitle.textContent = "Novo Bloqueio";
        const bloqueioIdInput = document.getElementById("bloqueioId");
        if (bloqueioIdInput) bloqueioIdInput.value = "";
        if (formBloqueio) formBloqueio.reset();
        if (tipoBloqueio) tipoBloqueio.dispatchEvent(new Event("change"));
        
        if (horariosMultiplos) {
            document.querySelectorAll('#horariosMultiplos input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
        }
        
        configurarDataMinima();
        openModal();
    });
}

// Filtros
if (filtroBusca) {
    filtroBusca.addEventListener("input", () => renderizarBloqueios());
}
if (filtroTipo) {
    filtroTipo.addEventListener("change", () => renderizarBloqueios());
}

// Tabs
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const tabId = btn.getAttribute("data-tab");
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));
        const tabPane = document.getElementById(`tab-${tabId}`);
        if (tabPane) tabPane.classList.add("active");
        renderizarBloqueios();
    });
});

// Logout
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        try {
            await signOut(auth);
            sessionStorage.removeItem('admin_active');
            sessionStorage.removeItem('admin_session_id');
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
            mostrarNotificacao("Erro ao fazer logout: " + error.message, "erro");
        }
    };
}

// Inicialização
async function init() {
    console.log("🚀 Inicializando sistema de bloqueios...");
    console.log("📱 Firebase config:", firebaseConfig.projectId);
    
    // Verificar elementos DOM
    const elementosNecessarios = [
        'bloqueiosAtivos', 'bloqueiosHistorico', 'tipoBloqueio', 
        'formBloqueio', 'btnNovoBloqueio'
    ];
    
    elementosNecessarios.forEach(id => {
        const elemento = document.getElementById(id);
        if (!elemento) {
            console.warn(`⚠️ Elemento não encontrado: #${id}`);
        } else {
            console.log(`✅ Elemento encontrado: #${id}`);
        }
    });
    
    configurarDataMinima();
    await carregarProfissionais();
    popularHorariosMultiplos();
    await carregarBloqueios();
    console.log("✅ Sistema de bloqueios pronto e funcionando!");
}

// Iniciar após o DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Funções globais
window.closeModal = function() {
    const modal = document.getElementById("modalBloqueio");
    if (modal) modal.classList.remove("active");
};

window.openModal = function() {
    const modal = document.getElementById("modalBloqueio");
    if (modal) modal.classList.add("active");
};

console.log("✅ bloqueios.js carregado com sucesso!");