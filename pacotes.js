// pacotes.js - Versão completa e funcionando (sem imagem fixa)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc,
    doc, 
    getDocs, 
    onSnapshot,
    Timestamp,
    query,
    where
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

let pacotes = [];
let servicos = [];
let pacoteParaExcluir = null;
let imagemUploadFile = null;

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function mostrarToast(mensagem, tipo = 'sucesso') {
    let toast = document.getElementById('toastPacote');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastPacote';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `<i class="fa-solid ${tipo === 'sucesso' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><span>${mensagem}</span>`;
    toast.style.background = tipo === 'sucesso' ? 'linear-gradient(135deg, #2199EF, #1a7fcc)' : 'linear-gradient(135deg, #ef4444, #dc2626)';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function converterImagemParaBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Função para gerar cores baseadas no nome do pacote
function getCorPorNome(nome) {
    const cores = ['#2199EF', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    let hash = 0;
    for (let i = 0; i < nome.length; i++) {
        hash = ((hash << 5) - hash) + nome.charCodeAt(i);
        hash |= 0;
    }
    return cores[Math.abs(hash) % cores.length];
}

async function carregarServicos() {
    try {
        const servicosRef = collection(db, "servicos");
        const snapshot = await getDocs(servicosRef);
        servicos = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            servicos.push({ id: doc.id, nome: data.nome || 'Serviço sem nome', preco: data.preco || 0 });
        });
        console.log("📦 Serviços carregados:", servicos.length);
        return servicos;
    } catch (error) {
        console.error("Erro ao carregar serviços:", error);
        return [];
    }
}

function carregarPacotes() {
    const pacotesRef = collection(db, "pacotes");
    onSnapshot(pacotesRef, (snapshot) => {
        pacotes = [];
        snapshot.forEach(doc => { pacotes.push({ id: doc.id, ...doc.data() }); });
        renderizarPacotes();
        atualizarEstatisticas();
    }, (error) => console.error("Erro ao carregar pacotes:", error));
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderizarPacotes() {
    const filtroStatus = document.getElementById('filtroStatus')?.value || 'todos';
    const busca = document.getElementById('buscaPacote')?.value.toLowerCase() || '';
    
    let pacotesFiltrados = pacotes.filter(pacote => {
        if (filtroStatus !== 'todos' && pacote.status !== filtroStatus) return false;
        if (busca && !pacote.nome.toLowerCase().includes(busca)) return false;
        return true;
    });
    
    const grid = document.getElementById('pacotesGrid');
    if (!grid) return;
    
    if (pacotesFiltrados.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-box-open"></i><p>Nenhum pacote encontrado</p><p style="font-size: 0.8rem; margin-top: 8px;">Clique em "Novo Pacote" para começar</p></div>';
        return;
    }
    
    grid.innerHTML = pacotesFiltrados.map(pacote => {
        const corIcone = getCorPorNome(pacote.nome);
        const temImagem = pacote.imagemBase64 || (pacote.imagem && pacote.imagem !== './assets/barber-perfil.jfif');
        
        return `
        <div class="pacote-card ${pacote.status === 'inativo' ? 'inativo' : ''}">
            <div class="pacote-status ${pacote.status === 'ativo' ? 'status-ativo' : 'status-inativo'}">
                ${pacote.status === 'ativo' ? '✓ Ativo' : '✗ Inativo'}
            </div>
            <div class="pacote-imagem-container">
                ${temImagem ? 
                    `<img src="${pacote.imagemBase64 || pacote.imagem}" class="pacote-imagem" alt="${escapeHtml(pacote.nome)}" onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'pacote-imagem-placeholder\\' style=\\'background: linear-gradient(135deg, ${corIcone}, ${corIcone}88);\\'><i class=\\'fa-solid fa-gift\\' style=\\'font-size: 2.5rem; color: white;\\'></i></div>'">` : 
                    `<div class="pacote-imagem-placeholder" style="background: linear-gradient(135deg, ${corIcone}, ${corIcone}88);">
                        <i class="fa-solid fa-gift" style="font-size: 2.5rem; color: white;"></i>
                    </div>`
                }
            </div>
            <div class="pacote-info">
                <h3 class="pacote-nome">${escapeHtml(pacote.nome)}</h3>
                <p class="pacote-descricao">${escapeHtml(pacote.descricao || 'Sem descrição')}</p>
                <div class="servicos-inclusos">
                    <h4><i class="fa-solid fa-scissors"></i> Serviços Inclusos (${pacote.servicos?.length || 0})</h4>
                    <div class="servicos-lista">
                        ${pacote.servicos?.map(s => `<span class="servico-tag">${escapeHtml(s.nome)}</span>`).join('') || 'Nenhum serviço'}
                    </div>
                </div>
                <div class="pacote-precos">
                    <div>
                        <span class="preco-original">De: ${formatarMoeda(pacote.precoOriginal)}</span>
                        <div class="preco-promocional">Por: ${formatarMoeda(pacote.preco)}</div>
                    </div>
                    ${pacote.desconto ? `<span class="desconto-badge">-${pacote.desconto}% OFF</span>` : ''}
                </div>
                <div class="pacote-acoes">
                    <button class="btn-vender-pacote" data-pacote-id="${pacote.id}"><i class="fa-solid fa-cart-shopping"></i> Vender</button>
                    <button class="btn-editar-pacote" data-pacote-id="${pacote.id}"><i class="fa-solid fa-pen"></i> Editar</button>
                    <button class="btn-excluir-pacote" data-pacote-id="${pacote.id}" data-pacote-nome="${escapeHtml(pacote.nome).replace(/'/g, "\\'")}"><i class="fa-solid fa-trash"></i> Excluir</button>
                </div>
            </div>
        </div>`;
    }).join('');
    
    document.querySelectorAll('.btn-vender-pacote').forEach(btn => {
        btn.removeEventListener('click', venderPacoteHandler);
        btn.addEventListener('click', venderPacoteHandler);
    });
    document.querySelectorAll('.btn-editar-pacote').forEach(btn => {
        btn.removeEventListener('click', editarPacoteHandler);
        btn.addEventListener('click', editarPacoteHandler);
    });
    document.querySelectorAll('.btn-excluir-pacote').forEach(btn => {
        btn.removeEventListener('click', excluirPacoteHandler);
        btn.addEventListener('click', excluirPacoteHandler);
    });
}

function venderPacoteHandler(e) { venderPacote(e.currentTarget.getAttribute('data-pacote-id')); }
function editarPacoteHandler(e) { editarPacote(e.currentTarget.getAttribute('data-pacote-id')); }
function excluirPacoteHandler(e) { 
    const btn = e.currentTarget;
    excluirPacote(btn.getAttribute('data-pacote-id'), btn.getAttribute('data-pacote-nome'));
}

async function venderPacote(pacoteId) {
    console.log("🎯 Vender pacote:", pacoteId);
    
    const pacote = pacotes.find(p => p.id === pacoteId);
    if (!pacote) {
        mostrarToast('❌ Pacote não encontrado!', 'erro');
        return;
    }
    
    if (!pacote.servicos || pacote.servicos.length === 0) {
        mostrarToast('⚠️ Este pacote não possui serviços. Edite e adicione serviços.', 'erro');
        return;
    }
    
    const servicosNomes = pacote.servicos.map(s => s.nome);
    const servicosParam = encodeURIComponent(servicosNomes.join(','));
    const url = `agendamento.html?pacote=${encodeURIComponent(pacote.nome)}&servicos=${servicosParam}&precoTotal=${pacote.preco}&pacoteId=${pacote.id}`;
    
    console.log("🔗 Redirecionando:", url);
    window.location.href = url;
}

async function editarPacote(pacoteId) {
    const pacote = pacotes.find(p => p.id === pacoteId);
    if (!pacote) return;
    
    await carregarServicos();
    
    document.getElementById('pacoteId').value = pacote.id;
    document.getElementById('pacoteNome').value = pacote.nome;
    document.getElementById('pacoteDescricao').value = pacote.descricao || '';
    document.getElementById('pacotePreco').value = pacote.preco;
    document.getElementById('pacoteValidade').value = pacote.validade || 30;
    document.getElementById('pacoteStatus').value = pacote.status;
    document.getElementById('pacoteDesconto').value = pacote.desconto || '0';
    imagemUploadFile = null;
    
    const servicosSelecionadosIds = pacote.servicos?.map(s => s.id) || [];
    preencherListaServicos(servicos, servicosSelecionadosIds);
    
    document.getElementById('modalTitle').textContent = 'Editar Pacote';
    document.getElementById('modalPacote').style.display = 'flex';
}

function excluirPacote(id, nome) {
    pacoteParaExcluir = id;
    document.getElementById('excluirPacoteNome').textContent = nome;
    document.getElementById('modalExcluirPacote').style.display = 'flex';
}

function fecharModalExcluirPacote() {
    document.getElementById('modalExcluirPacote').style.display = 'none';
    pacoteParaExcluir = null;
}

async function deletarPacote(id) {
    if (!id) return;
    try {
        await deleteDoc(doc(db, "pacotes", id));
        mostrarToast("✅ Pacote excluído com sucesso!");
        fecharModalExcluirPacote();
    } catch (error) {
        mostrarToast("❌ Erro ao excluir pacote: " + error.message, "erro");
    }
}

function preencherListaServicos(servicosParaExibir, servicosSelecionadosIds = []) {
    const servicosLista = document.getElementById('servicosLista');
    if (!servicosLista) return;
    
    servicosLista.innerHTML = '';
    
    if (!servicosParaExibir || servicosParaExibir.length === 0) {
        servicosLista.innerHTML = `<div class="empty-state" style="padding: 20px;"><i class="fa-solid fa-info-circle"></i><p>Nenhum serviço cadastrado</p></div>`;
        return;
    }
    
    servicosParaExibir.forEach(servico => {
        const isChecked = servicosSelecionadosIds.includes(servico.id);
        const label = document.createElement('label');
        label.className = 'checkbox-servico';
        label.innerHTML = `
            <input type="checkbox" value="${servico.id}" data-preco="${servico.preco}" data-nome="${escapeHtml(servico.nome)}" ${isChecked ? 'checked' : ''}>
            <div class="servico-info"><div class="servico-nome">${escapeHtml(servico.nome)}</div><div class="servico-preco">${formatarMoeda(servico.preco)}</div></div>
            <div class="preco-servico">${formatarMoeda(servico.preco)}</div>
        `;
        servicosLista.appendChild(label);
    });
    
    document.querySelectorAll('.checkbox-servico input').forEach(checkbox => {
        checkbox.removeEventListener('change', calcularPrecoTotal);
        checkbox.addEventListener('change', calcularPrecoTotal);
    });
    calcularPrecoTotal();
}

function calcularPrecoOriginal() {
    let total = 0;
    document.querySelectorAll('.checkbox-servico input:checked').forEach(cb => {
        total += parseFloat(cb.getAttribute('data-preco')) || 0;
    });
    return total;
}

function calcularPrecoTotal() {
    let total = 0;
    document.querySelectorAll('.checkbox-servico input:checked').forEach(cb => {
        total += parseFloat(cb.getAttribute('data-preco')) || 0;
    });
    const precoInput = document.getElementById('pacotePreco');
    if (precoInput) precoInput.value = total.toFixed(2);
    calcularDesconto();
}

function calcularDesconto() {
    const precoOriginal = calcularPrecoOriginal();
    const precoVenda = parseFloat(document.getElementById('pacotePreco')?.value) || 0;
    const descontoInput = document.getElementById('pacoteDesconto');
    if (precoOriginal > 0 && precoVenda > 0 && precoVenda < precoOriginal) {
        descontoInput.value = ((precoOriginal - precoVenda) / precoOriginal * 100).toFixed(1);
    } else if (precoVenda >= precoOriginal && precoOriginal > 0) {
        descontoInput.value = '0';
    }
}

function aplicarDescontoPercentual() {
    const precoOriginal = calcularPrecoOriginal();
    const desconto = parseFloat(document.getElementById('pacoteDesconto')?.value) || 0;
    if (precoOriginal > 0 && desconto > 0) {
        document.getElementById('pacotePreco').value = (precoOriginal * (1 - desconto / 100)).toFixed(2);
    } else if (desconto === 0 && precoOriginal > 0) {
        document.getElementById('pacotePreco').value = precoOriginal.toFixed(2);
    }
}

document.getElementById('btnNovoPacote')?.addEventListener('click', async () => {
    document.getElementById('pacoteId').value = '';
    document.getElementById('pacoteNome').value = '';
    document.getElementById('pacoteDescricao').value = '';
    document.getElementById('pacotePreco').value = '';
    document.getElementById('pacoteValidade').value = '30';
    document.getElementById('pacoteStatus').value = 'ativo';
    document.getElementById('pacoteDesconto').value = '0';
    document.getElementById('pacoteImagem').value = '';
    imagemUploadFile = null;
    
    await carregarServicos();
    preencherListaServicos(servicos, []);
    
    document.getElementById('modalTitle').textContent = 'Criar Novo Pacote';
    document.getElementById('modalPacote').style.display = 'flex';
});

document.getElementById('pacotePreco')?.addEventListener('input', calcularDesconto);
document.getElementById('pacoteDesconto')?.addEventListener('input', aplicarDescontoPercentual);
document.getElementById('pacoteImagem')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        imagemUploadFile = e.target.files[0];
        mostrarToast('Imagem selecionada: ' + imagemUploadFile.name, 'sucesso');
    }
});

document.getElementById('formPacote')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const servicosSelecionados = [];
    document.querySelectorAll('.checkbox-servico input:checked').forEach(checkbox => {
        servicosSelecionados.push({
            id: checkbox.value,
            nome: checkbox.getAttribute('data-nome'),
            preco: parseFloat(checkbox.getAttribute('data-preco'))
        });
    });
    
    if (servicosSelecionados.length === 0) {
        mostrarToast('⚠️ Selecione pelo menos um serviço!', 'erro');
        return;
    }
    
    const precoOriginal = calcularPrecoOriginal();
    const precoComDesconto = parseFloat(document.getElementById('pacotePreco').value);
    
    if (precoComDesconto > precoOriginal) {
        mostrarToast('⚠️ O preço com desconto não pode ser maior que o preço original!', 'erro');
        return;
    }
    
    let imagemBase64 = null;
    if (imagemUploadFile) {
        try {
            imagemBase64 = await converterImagemParaBase64(imagemUploadFile);
        } catch (error) {
            console.error("Erro ao converter imagem:", error);
        }
    }
    
    const pacoteData = {
        nome: document.getElementById('pacoteNome').value,
        descricao: document.getElementById('pacoteDescricao').value,
        servicos: servicosSelecionados,
        precoOriginal: precoOriginal,
        preco: precoComDesconto,
        desconto: parseFloat(document.getElementById('pacoteDesconto').value) || 0,
        validade: parseInt(document.getElementById('pacoteValidade').value),
        status: document.getElementById('pacoteStatus').value,
        updatedAt: Timestamp.now(),
        vendas: 0
    };
    
    if (imagemBase64) pacoteData.imagemBase64 = imagemBase64;
    
    const pacoteId = document.getElementById('pacoteId').value;
    
    try {
        if (pacoteId) {
            await updateDoc(doc(db, "pacotes", pacoteId), pacoteData);
            mostrarToast('✅ Pacote atualizado com sucesso!');
        } else {
            pacoteData.createdAt = Timestamp.now();
            await addDoc(collection(db, "pacotes"), pacoteData);
            mostrarToast('✅ Pacote criado com sucesso!');
        }
        fecharModais();
        document.getElementById('formPacote').reset();
        imagemUploadFile = null;
    } catch (error) {
        mostrarToast('❌ Erro ao salvar pacote: ' + error.message, 'erro');
    }
});

function fecharModais() {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
}

document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', fecharModais));
document.getElementById('btnCancelar')?.addEventListener('click', fecharModais);
document.getElementById('btnConfirmarExcluirPacote')?.addEventListener('click', () => { if (pacoteParaExcluir) deletarPacote(pacoteParaExcluir); });
document.getElementById('btnCancelarExcluir')?.addEventListener('click', fecharModalExcluirPacote);
document.querySelector('#modalExcluirPacote .modal-close-excluir')?.addEventListener('click', fecharModalExcluirPacote);

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) e.target.style.display = 'none';
});

document.getElementById('filtroStatus')?.addEventListener('change', renderizarPacotes);
document.getElementById('buscaPacote')?.addEventListener('input', renderizarPacotes);
document.getElementById('btnLimparFiltros')?.addEventListener('click', () => {
    if (document.getElementById('buscaPacote')) document.getElementById('buscaPacote').value = '';
    if (document.getElementById('filtroStatus')) document.getElementById('filtroStatus').value = 'todos';
    renderizarPacotes();
});

function atualizarEstatisticas() {
    document.getElementById('totalPacotes').textContent = pacotes.length;
    document.getElementById('pacotesAtivos').textContent = pacotes.filter(p => p.status === 'ativo').length;
    document.getElementById('pacotesVendidos').textContent = pacotes.reduce((sum, p) => sum + (p.vendas || 0), 0);
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("✅ Usuário autenticado:", user.email);
        carregarPacotes();
    } else {
        window.location.href = 'login.html';
    }
});

document.getElementById('logout')?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'login.html';
});

console.log("🚀 Sistema de Pacotes carregado!");