/*
 * Camada de dados: Firestore (compartilhado) ou localStorage (demonstração).
 * As duas expõem a mesma interface: Store.assinar(cb) e Store.adicionar(marcacao).
 */
window.Store = (function () {
  'use strict';
  var cfg = window.OLHO_CONFIG || {};
  var fb = cfg.firebase || {};
  var colecao = cfg.colecao || 'marcacoes';
  var CHAVE_LOCAL = 'olho-na-mare:marcacoes';

  var online = false;
  var db = null;
  if (fb.apiKey && fb.projectId && window.firebase) {
    try {
      firebase.initializeApp(fb);
      db = firebase.firestore();
      online = true;
    } catch (e) {
      console.error('Falha ao iniciar o Firebase:', e);
    }
  }

  function lerLocal() {
    try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL)) || []; } catch (e) { return []; }
  }
  function gravarLocal(lista) {
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(lista)); } catch (e) { /* armazenamento bloqueado */ }
  }
  var ouvintesLocais = [];

  function doDocumento(doc) {
    var d = doc.data();
    var criado = d.criadoEm && d.criadoEm.toMillis ? d.criadoEm.toMillis() : Date.now();
    return {
      id: doc.id, lat: d.lat, lng: d.lng, tipo: d.tipo, intensidade: d.intensidade,
      dataObservada: d.dataObservada, local: d.local || '', estado: d.estado || '',
      descricao: d.descricao || '', criadoEm: criado
    };
  }

  return {
    online: online,

    // Chama cb(lista) agora e a cada mudança; cb(null, erro) se falhar.
    assinar: function (cb) {
      if (online) {
        return db.collection(colecao).orderBy('criadoEm', 'desc').limit(3000).onSnapshot(
          function (snap) { cb(snap.docs.map(doDocumento)); },
          function (erro) { console.error(erro); cb(null, erro); }
        );
      }
      ouvintesLocais.push(cb);
      cb(lerLocal());
      return function () { ouvintesLocais = ouvintesLocais.filter(function (f) { return f !== cb; }); };
    },

    adicionar: function (m) {
      if (online) {
        var dados = Object.assign({}, m, { criadoEm: firebase.firestore.FieldValue.serverTimestamp() });
        return db.collection(colecao).add(dados);
      }
      var lista = lerLocal();
      lista.unshift(Object.assign({}, m, { id: 'local-' + Date.now(), criadoEm: Date.now() }));
      gravarLocal(lista);
      ouvintesLocais.forEach(function (f) { f(lista); });
      return Promise.resolve();
    }
  };
})();
