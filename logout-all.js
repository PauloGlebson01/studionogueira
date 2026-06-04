// logout-all.js - Para deslogar completamente todos os usuários
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

async function logoutCompleto() {
    try {
        await signOut(auth);
        // Limpar todos os storages
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Erro no logout:", error);
    }
}

// Executar se a página for carregada com parâmetro de logout total
if (window.location.search.includes('logout=all')) {
    logoutCompleto();
}

// Função para logout apenas do admin (mantém barbeiros)
async function logoutAdmin() {
    try {
        // Verificar se tem barbeiros logados
        const hasBarbeiro = sessionStorage.getItem('barbeiroLogado') === 'true';
        
        if (!hasBarbeiro) {
            await signOut(auth);
        }
        
        sessionStorage.removeItem('adminAuthTime');
        sessionStorage.removeItem('userType');
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Erro no logout admin:", error);
    }
}

// Exportar funções para uso
export { logoutCompleto, logoutAdmin };