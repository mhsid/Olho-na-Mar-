/*
 * Configuração do Olho na Maré
 *
 * Enquanto os campos do Firebase estiverem vazios, o site roda em
 * "modo demonstração": as marcações ficam salvas só no navegador de quem marcou.
 *
 * ATENÇÃO: cole só os VALORES dentro das aspas abaixo. Não cole as linhas
 * "import ..." nem "initializeApp(...)" que o Firebase mostra: elas quebram o site.
 */
window.OLHO_CONFIG = {
  firebase: {
    apiKey: "AIzaSyCvEtSyo-c8TX52WWmK3IfmyGgVGv2Rb84",
    authDomain: "olho-na-mare.firebaseapp.com",
    projectId: "olho-na-mare",
    storageBucket: "olho-na-mare.firebasestorage.app",
    messagingSenderId: "1095634758258",
    appId: "1:1095634758258:web:be2022964c9912d126b0eb"
  },
  // Nome da coleção no Firestore (precisa bater com o firestore.rules)
  colecao: "marcacoes",
  // Tempo mínimo entre duas marcações do mesmo navegador (segundos)
  intervaloEntreMarcacoes: 45
};
