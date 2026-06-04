import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

let isAdminLogout = false;

// Verificar se o sistema já foi configurado
async function verificarConfiguracaoSistema() {
    try {
        const configRef = doc(db, "configuracoes", "sistema");
        const configDoc = await getDoc(configRef);
        
        if (!configDoc.exists() || configDoc.data().configurado !== true) {
            console.log("⚠️ Sistema não configurado. Redirecionando para configuração inicial...");
            window.location.href = 'configuracao-inicial.html';
            return false;
        }
        return true;
    } catch (error) {
        console.error("Erro ao verificar configuração:", error);
        return true; // Assume que está configurado para não bloquear
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Primeiro, verificar se o sistema está configurado
    const configurado = await verificarConfiguracaoSistema();
    if (!configurado) return;
    
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const btnLogin = document.getElementById('btnLogin');
    const loginErro = document.getElementById('loginErro');

    function mostrarErro(mensagem) {
        if (loginErro) {
            loginErro.textContent = mensagem;
            loginErro.style.display = 'block';
            setTimeout(() => {
                if (loginErro) loginErro.style.display = 'none';
            }, 5000);
        }
    }

    function limparErro() {
        if (loginErro) {
            loginErro.style.display = 'none';
            loginErro.textContent = '';
        }
    }

    function setLoading(loading) {
        if (btnLogin) {
            if (loading) {
                btnLogin.disabled = true;
                btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
            } else {
                btnLogin.disabled = false;
                btnLogin.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Entrar';
            }
        }
    }

    onAuthStateChanged(auth, (user) => {
        if (isAdminLogout) return;
        
        const isAdminSession = sessionStorage.getItem('admin_active') === 'true';
        const adminId = sessionStorage.getItem('admin_session_id');
        
        if (user && isAdminSession && adminId) {
            console.log("Admin autenticado nesta aba");
            window.location.href = 'dashboard.html';
        } else if (!user && isAdminSession) {
            sessionStorage.clear();
            window.location.reload();
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            limparErro();
            
            const email = emailInput ? emailInput.value.trim() : '';
            const senha = senhaInput ? senhaInput.value : '';
            
            if (!email || !senha) {
                mostrarErro("Preencha todos os campos!");
                return;
            }
            
            setLoading(true);
            
            try {
                isAdminLogout = false;
                sessionStorage.clear();
                
                const sessionId = Math.random().toString(36).substring(2, 15) + Date.now().toString();
                
                if (auth.currentUser) {
                    await signOut(auth);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                const userCredential = await signInWithEmailAndPassword(auth, email, senha);
                
                sessionStorage.setItem('admin_active', 'true');
                sessionStorage.setItem('admin_session_id', sessionId);
                sessionStorage.setItem('admin_email', userCredential.user.email);
                sessionStorage.setItem('admin_login_time', Date.now().toString());
                
                console.log("✅ Admin logado com sucesso:", userCredential.user.email);
                window.location.href = 'dashboard.html';
                
            } catch (error) {
                console.error("Erro na autenticação:", error.code);
                sessionStorage.clear();
                
                let mensagemErro = "";
                
                switch (error.code) {
                    case 'auth/invalid-email':
                        mensagemErro = "❌ E-mail inválido.";
                        break;
                    case 'auth/user-not-found':
                        mensagemErro = "❌ Usuário não encontrado. Faça a configuração inicial primeiro.";
                        break;
                    case 'auth/wrong-password':
                        mensagemErro = "❌ Senha incorreta.";
                        break;
                    case 'auth/too-many-requests':
                        mensagemErro = "⚠️ Muitas tentativas. Aguarde.";
                        break;
                    default:
                        mensagemErro = `❌ Erro: ${error.message}`;
                }
                
                mostrarErro(mensagemErro);
                setLoading(false);
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && loginForm) {
            e.preventDefault();
            loginForm.dispatchEvent(new Event('submit'));
        }
    });

    if (emailInput) emailInput.addEventListener('input', limparErro);
    if (senhaInput) senhaInput.addEventListener('input', limparErro);
});