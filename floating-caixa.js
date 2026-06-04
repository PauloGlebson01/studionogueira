// floating-caixa.js - Botão Flutuante do Caixa para todas as páginas

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

let caixaAberto = false;
let saldoAtual = 0;
let totalEntradasHoje = 0;
let totalSaidasHoje = 0;
let dadosCarregados = false;

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function atualizarUI() {
    const floatingBtn = document.getElementById('floatingCaixaBtn');
    const caixaBadge = document.getElementById('caixaBadge');
    const floatingSaldo = document.getElementById('floatingCaixaSaldo');
    const previewSaldo = document.getElementById('previewSaldo');
    const previewEntradas = document.getElementById('previewEntradas');
    const previewSaidas = document.getElementById('previewSaidas');
    
    if (!floatingBtn) return;
    
    if (caixaAberto) {
        floatingBtn.classList.add('has-caixa-aberto');
        floatingBtn.classList.remove('has-caixa-fechado');
        if (caixaBadge) caixaBadge.style.background = '#2199EF';
    } else {
        floatingBtn.classList.add('has-caixa-fechado');
        floatingBtn.classList.remove('has-caixa-aberto');
        if (caixaBadge) caixaBadge.style.background = '#ef4444';
    }
    
    if (floatingSaldo) floatingSaldo.textContent = formatarMoeda(saldoAtual);
    if (previewSaldo) previewSaldo.textContent = formatarMoeda(saldoAtual);
    if (previewEntradas) previewEntradas.textContent = formatarMoeda(totalEntradasHoje);
    if (previewSaidas) previewSaidas.textContent = formatarMoeda(totalSaidasHoje);
}

async function carregarStatusCaixa() {
    try {
        const hoje = new Date().toISOString().split('T')[0];
        const caixaQuery = query(
            collection(db, "caixa"),
            where("data", "==", hoje),
            where("status", "==", "aberto")
        );
        const caixaSnap = await getDocs(caixaQuery);
        caixaAberto = !caixaSnap.empty;
        atualizarUI();
    } catch (error) {
        console.error("Erro ao carregar status do caixa:", error);
    }
}

async function carregarMovimentacoes() {
    try {
        const hoje = new Date().toISOString().split('T')[0];
        const movQuery = query(
            collection(db, "movimentacoes_caixa"),
            where("dataFormatada", "==", hoje)
        );
        
        const snapshot = await getDocs(movQuery);
        totalEntradasHoje = 0;
        totalSaidasHoje = 0;
        
        snapshot.forEach(doc => {
            const mov = doc.data();
            if (mov.tipo === 'entrada') {
                totalEntradasHoje += mov.valor;
            } else if (mov.tipo === 'saida') {
                totalSaidasHoje += mov.valor;
            }
        });
        
        saldoAtual = totalEntradasHoje - totalSaidasHoje;
        dadosCarregados = true;
        atualizarUI();
    } catch (error) {
        console.error("Erro ao carregar movimentações:", error);
    }
}

function configurarEventos() {
    const floatingBtn = document.getElementById('floatingCaixaBtn');
    const preview = document.getElementById('floatingCaixaPreview');
    const closePreview = document.getElementById('closeCaixaPreview');
    const previewAtendimento = document.getElementById('previewAtendimento');
    const previewAbrirCaixa = document.getElementById('previewAbrirCaixa');
    
    let timeoutId;
    
    if (floatingBtn && preview) {
        floatingBtn.addEventListener('mouseenter', () => {
            if (timeoutId) clearTimeout(timeoutId);
            preview.classList.add('show');
        });
        
        floatingBtn.addEventListener('mouseleave', () => {
            timeoutId = setTimeout(() => {
                preview.classList.remove('show');
            }, 300);
        });
        
        floatingBtn.addEventListener('click', () => {
            window.location.href = 'caixa.html';
        });
        
        preview.addEventListener('mouseenter', () => {
            if (timeoutId) clearTimeout(timeoutId);
        });
        
        preview.addEventListener('mouseleave', () => {
            timeoutId = setTimeout(() => {
                preview.classList.remove('show');
            }, 300);
        });
    }
    
    if (closePreview) {
        closePreview.addEventListener('click', () => {
            if (preview) preview.classList.remove('show');
        });
    }
    
    if (previewAtendimento) {
        previewAtendimento.addEventListener('click', () => {
            window.location.href = 'caixa.html';
        });
    }
    
    if (previewAbrirCaixa) {
        previewAbrirCaixa.addEventListener('click', () => {
            window.location.href = 'caixa.html';
        });
    }
}

function criarBotaoSeNecessario() {
    if (!document.getElementById('floatingCaixaBtn')) {
        const btnHTML = `
            <button id="floatingCaixaBtn" class="floating-caixa-btn">
                <i class="fa-solid fa-cash-register"></i>
                <span class="caixa-badge" id="caixaBadge">●</span>
                <span class="floating-caixa-saldo" id="floatingCaixaSaldo">R$ 0,00</span>
            </button>
            <div id="floatingCaixaPreview" class="floating-caixa-preview">
                <div class="floating-caixa-preview-header">
                    <h4><i class="fa-solid fa-cash-register"></i> Resumo do Caixa</h4>
                    <button class="close-preview" id="closeCaixaPreview">&times;</button>
                </div>
                <div class="floating-caixa-preview-body">
                    <div class="preview-saldo">
                        <span>Saldo Atual</span>
                        <span id="previewSaldo">R$ 0,00</span>
                    </div>
                    <div class="preview-movimentacao">
                        <span><i class="fa-solid fa-arrow-up"></i> Entradas hoje</span>
                        <span id="previewEntradas">R$ 0,00</span>
                    </div>
                    <div class="preview-movimentacao">
                        <span><i class="fa-solid fa-arrow-down"></i> Saídas hoje</span>
                        <span id="previewSaidas">R$ 0,00</span>
                    </div>
                    <div class="preview-actions">
                        <button id="previewAtendimento" class="btn-preview-atendimento">
                            <i class="fa-solid fa-scissors"></i> Atender
                        </button>
                        <button id="previewAbrirCaixa" class="btn-preview-caixa">
                            <i class="fa-solid fa-cash-register"></i> Caixa
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', btnHTML);
        console.log("✅ Botão flutuante do caixa criado");
    }
}

async function inicializar() {
    console.log("🔧 Inicializando botão flutuante do caixa...");
    criarBotaoSeNecessario();
    await carregarStatusCaixa();
    await carregarMovimentacoes();
    configurarEventos();
    
    // Listener em tempo real para movimentações
    const hoje = new Date().toISOString().split('T')[0];
    const movQuery = query(collection(db, "movimentacoes_caixa"), where("dataFormatada", "==", hoje));
    onSnapshot(movQuery, () => {
        carregarMovimentacoes();
    });
    
    // Listener para status do caixa
    const caixaQuery = query(collection(db, "caixa"), where("data", "==", hoje));
    onSnapshot(caixaQuery, () => {
        carregarStatusCaixa();
    });
}

// Aguardar o DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        onAuthStateChanged(auth, (user) => {
            if (user) inicializar();
        });
    });
} else {
    onAuthStateChanged(auth, (user) => {
        if (user) inicializar();
    });
}