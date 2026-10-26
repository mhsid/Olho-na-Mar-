(function () {
  'use strict';

  // ---------- Constantes ----------
  var ESTADOS = [
    ['MA', 'Maranhão'], ['PI', 'Piauí'], ['CE', 'Ceará'], ['RN', 'Rio Grande do Norte'],
    ['PB', 'Paraíba'], ['PE', 'Pernambuco'], ['AL', 'Alagoas'], ['SE', 'Sergipe'], ['BA', 'Bahia']
  ];
  var NOME_ESTADO = {};
  ESTADOS.forEach(function (e) { NOME_ESTADO[e[0]] = e[1]; });

  var TIPOS = {
    mancha: 'Mancha ou placa de óleo',
    pelotas: 'Pelotas / fragmentos de piche',
    animal: 'Animal sujo de óleo',
    outro: 'Outro sinal de óleo'
  };
  var INTENSIDADES = { leve: 'Leve', moderada: 'Moderada', grave: 'Grave' };

  // Retângulo que cobre o litoral do Maranhão ao sul da Bahia
  var LIMITES = L.latLngBounds([-18.5, -49], [-0.5, -34.5]);
  var CFG = window.OLHO_CONFIG || {};
  var INTERVALO = (CFG.intervaloEntreMarcacoes || 45) * 1000;
  var CHAVE_ULTIMA = 'olho-na-mare:ultima';

  var $ = function (id) { return document.getElementById(id); };

  // ---------- Utilidades ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hojeISO() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  function dataBR(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function haQuanto(ms) {
    var s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return 'agora';
    if (s < 3600) return Math.floor(s / 60) + ' min';
    if (s < 86400) return Math.floor(s / 3600) + ' h';
    var d = Math.floor(s / 86400);
    if (d < 30) return d + (d === 1 ? ' dia' : ' dias');
    var m = Math.floor(d / 30);
    if (m < 12) return m + (m === 1 ? ' mês' : ' meses');
    var a = Math.floor(d / 365);
    return a + (a === 1 ? ' ano' : ' anos');
  }
  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('visivel'); }, 3800);
  }
  function celular() { return window.matchMedia('(max-width: 760px)').matches; }
  function lerLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravarLS(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignorado */ } }

  // Preenche os selects de estado
  ESTADOS.forEach(function (e) {
    $('f-estado').add(new Option(e[1], e[0]));
    $('m-estado').add(new Option(e[1], e[0]));
  });

  // ---------- Mapa ----------
  var mapa = L.map('mapa', {
    zoomControl: false,
    minZoom: 5,
    maxBounds: LIMITES.pad(0.5),
    maxBoundsViscosity: 0.8
  }).setView([-8.6, -37.2], 6);
  L.control.zoom({ position: 'bottomright', zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(mapa);
  mapa.attributionControl.setPrefix(false);

  var camadas = {
    mapa: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores do OpenStreetMap</a>'
    }),
    satelite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Imagens © Esri, Maxar, Earthstar Geographics'
    })
  };
  var camadaAtual = 'mapa';
  camadas.mapa.addTo(mapa);

  $('btn-camada').addEventListener('click', function () {
    mapa.removeLayer(camadas[camadaAtual]);
    camadaAtual = camadaAtual === 'mapa' ? 'satelite' : 'mapa';
    camadas[camadaAtual].addTo(mapa);
    var proximo = camadaAtual === 'mapa' ? 'Satélite' : 'Mapa';
    $('camada-rotulo').textContent = proximo;
    $('btn-camada').title = 'Trocar para ' + proximo.toLowerCase();
    $('btn-camada').classList.toggle('para-mapa', camadaAtual === 'satelite');
  });

  function icone(classe) {
    return L.divIcon({
      className: 'pino pino-' + classe, html: '<span></span>',
      iconSize: [28, 38], iconAnchor: [14, 38], popupAnchor: [0, -34]
    });
  }

  var grupo = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 44,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: function (c) {
      return L.divIcon({ html: '<span>' + c.getChildCount() + '</span>', className: 'cluster', iconSize: [40, 40] });
    }
  });
  mapa.addLayer(grupo);

  // ---------- Dados e renderização ----------
  var todas = [];
  var marcadores = {};
  var carregou = false;

  if (!Store.online) $('aviso-demo').hidden = false;

  Store.assinar(function (lista, erro) {
    if (erro) {
      toast('Não foi possível carregar as marcações. Verifique a conexão.');
      $('resumo-curto').textContent = 'Sem conexão com o banco de dados';
      return;
    }
    carregou = true;
    todas = lista.filter(function (m) { return typeof m.lat === 'number' && typeof m.lng === 'number'; });
    render();
  });

  function filtros() {
    var ints = Array.prototype.map.call(
      document.querySelectorAll('#f-intensidade input:checked'), function (i) { return i.value; }
    );
    return { estado: $('f-estado').value, dias: Number($('f-periodo').value), ints: ints };
  }

  function filtradas() {
    var f = filtros();
    var corte = f.dias ? Date.now() - f.dias * 86400000 : 0;
    return todas.filter(function (m) {
      if (f.estado && m.estado !== f.estado) return false;
      if (f.ints.indexOf(m.intensidade) === -1) return false;
      if (corte) {
        var obs = m.dataObservada ? new Date(m.dataObservada + 'T12:00:00').getTime() : m.criadoEm;
        if (obs < corte) return false;
      }
      return true;
    });
  }

  function popupHtml(m) {
    var titulo = m.local || (NOME_ESTADO[m.estado] ? 'Litoral de ' + NOME_ESTADO[m.estado] : 'Local sem nome');
    return '<div class="pop">' +
      '<span class="pop-tag"><span class="bola bola-' + esc(m.intensidade) + '"></span>' + esc(INTENSIDADES[m.intensidade] || '') + '</span>' +
      '<div class="pop-titulo">' + esc(titulo) + '</div>' +
      '<div class="pop-meta">' + esc(TIPOS[m.tipo] || '') + '<br>Visto em ' + esc(dataBR(m.dataObservada)) +
      (m.estado ? ' · ' + esc(m.estado) : '') + '<br>Registrado há ' + esc(haQuanto(m.criadoEm)) + '</div>' +
      (m.descricao ? '<p class="pop-desc">' + esc(m.descricao) + '</p>' : '') +
      '</div>';
  }

  function render() {
    var lista = filtradas();
    grupo.clearLayers();
    marcadores = {};
    var camadasNovas = lista.map(function (m) {
      var mk = L.marker([m.lat, m.lng], { icon: icone(m.intensidade), title: m.local || TIPOS[m.tipo] });
      mk.bindPopup(function () { return popupHtml(m); }, {
        maxWidth: 280,
        autoPanPaddingTopLeft: celular() ? [16, 80] : [420, 80],
        autoPanPaddingBottomRight: celular() ? [16, 120] : [100, 40]
      });
      marcadores[m.id] = mk;
      return mk;
    });
    grupo.addLayers(camadasNovas);

    // Números
    var estados = {};
    var graves = 0;
    lista.forEach(function (m) {
      if (m.estado) estados[m.estado] = 1;
      if (m.intensidade === 'grave') graves++;
    });
    $('n-total').textContent = lista.length;
    $('n-graves').textContent = graves;
    $('n-estados').innerHTML = Object.keys(estados).length + '<small>/9</small>';
    $('resumo-curto').textContent = carregou
      ? (lista.length === 1 ? '1 marcação' : lista.length + ' marcações') + ' no mapa · ver lista'
      : 'Carregando marcações…';

    // Lista (mostra as 150 mais recentes)
    var ol = $('lista');
    ol.innerHTML = '';
    lista.slice(0, 150).forEach(function (m) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML =
        '<span class="bola bola-' + esc(m.intensidade) + '"></span>' +
        '<strong>' + esc(m.local || TIPOS[m.tipo]) + '</strong>' +
        '<time>' + esc(haQuanto(m.criadoEm)) + '</time>' +
        '<span class="meta">' + esc(TIPOS[m.tipo] || '') + ' · ' + esc(dataBR(m.dataObservada)) +
        (m.estado ? ' · ' + esc(m.estado) : '') + '</span>';
      b.addEventListener('click', function () { focar(m.id); });
      li.appendChild(b);
      ol.appendChild(li);
    });
    $('lista-vazia').hidden = !carregou || lista.length > 0;
  }

  function focar(id) {
    var mk = marcadores[id];
    if (!mk) return;
    if (celular()) abrirPainel(false);
    grupo.zoomToShowLayer(mk, function () {
      mapa.setView(mk.getLatLng(), Math.max(mapa.getZoom(), 14));
      mk.openPopup();
    });
  }

  ['f-estado', 'f-periodo'].forEach(function (id) { $(id).addEventListener('change', render); });
  $('f-intensidade').addEventListener('change', render);
  setInterval(function () { if (carregou) render(); }, 60000); // atualiza "há X min"

  // ---------- Painel (gaveta no celular) ----------
  function abrirPainel(abrir) {
    $('painel').classList.toggle('aberto', abrir);
    $('painel-alca').setAttribute('aria-expanded', String(abrir));
  }
  $('painel-alca').addEventListener('click', function () {
    abrirPainel(!$('painel').classList.contains('aberto'));
  });

  // ---------- Marcação ----------
  var marcando = false;
  var pinoNovo = null;
  var localAuto = '';
  var geoControle = null;

  function entrarModoMarcar() {
    var ultima = Number(lerLS(CHAVE_ULTIMA) || 0);
    var falta = Math.ceil((ultima + INTERVALO - Date.now()) / 1000);
    if (falta > 0) {
      toast('Aguarde ' + falta + ' s para fazer outra marcação.');
      return;
    }
    marcando = true;
    document.body.classList.add('marcando');
    $('dica').hidden = false;
    abrirPainel(false);
    mapa.closePopup();
  }
  function sairModoMarcar() {
    marcando = false;
    document.body.classList.remove('marcando');
    $('dica').hidden = true;
  }

  $('btn-marcar').addEventListener('click', entrarModoMarcar);
  $('dica-cancelar').addEventListener('click', sairModoMarcar);

  mapa.on('click', function (e) { if (marcando) escolherPonto(e.latlng); });
  // Clique com o botão direito (ou toque longo) também marca, como no Google Maps
  mapa.on('contextmenu', function (e) {
    if (!$('form-painel').hidden || marcando) { escolherPonto(e.latlng); return; }
    entrarModoMarcar();
    if (marcando) escolherPonto(e.latlng);
  });

  function escolherPonto(ll) {
    if (!LIMITES.contains(ll)) {
      toast('Esse ponto fica fora do litoral nordestino. Escolha um local entre o Maranhão e a Bahia.');
      return;
    }
    sairModoMarcar();
    if (pinoNovo) {
      pinoNovo.setLatLng(ll);
    } else {
      pinoNovo = L.marker(ll, { icon: icone('novo'), draggable: true, zIndexOffset: 1000, keyboard: false }).addTo(mapa);
      pinoNovo.on('dragend', function () {
        var p = pinoNovo.getLatLng();
        if (!LIMITES.contains(p)) toast('O pino está fora do litoral nordestino.');
        atualizarPonto(p);
      });
    }
    abrirFormulario();
    atualizarPonto(ll);
  }

  function abrirFormulario() {
    var form = $('form-painel');
    if (form.hidden) {
      $('form-marcacao').reset();
      $('m-data').value = hojeISO();
      $('m-data').max = hojeISO();
      $('m-contador').textContent = '0';
      localAuto = '';
    }
    form.hidden = false;
    document.body.classList.add('formulario');
  }

  function fecharFormulario() {
    $('form-painel').hidden = true;
    document.body.classList.remove('formulario');
    if (pinoNovo) { mapa.removeLayer(pinoNovo); pinoNovo = null; }
    if (geoControle) geoControle.abort();
  }
  $('form-fechar').addEventListener('click', fecharFormulario);
  $('form-cancelar').addEventListener('click', fecharFormulario);

  function atualizarPonto(ll) {
    $('form-coords').textContent = ll.lat.toFixed(5) + ', ' + ll.lng.toFixed(5);
    var z = mapa.getZoom();
    if (z < 12) mapa.setView(ll, 13); else mapa.panTo(ll);
    buscarEndereco(ll);
  }

  // Descobre praia/cidade e estado pelo ponto (OpenStreetMap / Nominatim)
  function buscarEndereco(ll) {
    if (geoControle) geoControle.abort();
    geoControle = new AbortController();
    var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=pt-BR' +
      '&lat=' + ll.lat.toFixed(5) + '&lon=' + ll.lng.toFixed(5);
    fetch(url, { signal: geoControle.signal })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var a = d.address || {};
        var sigla = '';
        var iso = a['ISO3166-2-lvl4'] || '';
        if (iso.indexOf('BR-') === 0) sigla = iso.slice(3);
        if (NOME_ESTADO[sigla]) $('m-estado').value = sigla;
        else if (sigla) toast('Esse ponto parece estar fora dos estados do Nordeste.');

        var praia = d.name || a.beach || a.natural || a.neighbourhood || a.suburb || '';
        var cidade = a.city || a.town || a.village || a.municipality || '';
        var texto = [praia, cidade].filter(function (x, i, arr) {
          return x && x !== a.state && x !== a.country && arr.indexOf(x) === i;
        }).join(', ');
        var campo = $('m-local');
        if (texto && (!campo.value || campo.value === localAuto)) {
          campo.value = texto.slice(0, 120);
          localAuto = campo.value;
        }
      })
      .catch(function () { /* sem endereço: a pessoa preenche manualmente */ });
  }

  $('m-descricao').addEventListener('input', function () {
    $('m-contador').textContent = this.value.length;
  });

  $('form-marcacao').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!pinoNovo) return;
    var ll = pinoNovo.getLatLng();
    if (!LIMITES.contains(ll)) { toast('Mova o pino para o litoral nordestino.'); return; }

    var estado = $('m-estado').value;
    var data = $('m-data').value;
    if (!estado) { toast('Escolha o estado.'); $('m-estado').focus(); return; }
    if (!data || data > hojeISO() || data < '2019-01-01') { toast('Informe uma data válida (até hoje).'); $('m-data').focus(); return; }

    var ultima = Number(lerLS(CHAVE_ULTIMA) || 0);
    if (Date.now() - ultima < INTERVALO) {
      toast('Aguarde alguns segundos antes de fazer outra marcação.');
      return;
    }

    var marcacao = {
      lat: Math.round(ll.lat * 1e5) / 1e5,
      lng: Math.round(ll.lng * 1e5) / 1e5,
      tipo: document.querySelector('input[name="tipo"]:checked').value,
      intensidade: document.querySelector('input[name="intensidade"]:checked').value,
      dataObservada: data,
      local: $('m-local').value.trim().slice(0, 120),
      estado: estado,
      descricao: $('m-descricao').value.trim().slice(0, 500)
    };

    var btn = $('form-enviar');
    btn.disabled = true;
    btn.textContent = 'Registrando…';
    Store.adicionar(marcacao)
      .then(function () {
        gravarLS(CHAVE_ULTIMA, String(Date.now()));
        fecharFormulario();
        toast('Marcação registrada. Obrigado por ajudar a monitorar o litoral!');
      })
      .catch(function (err) {
        console.error(err);
        toast('Não foi possível registrar. Verifique a conexão e tente de novo.');
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = 'Registrar marcação';
      });
  });

  // ---------- Busca ----------
  var resultados = $('busca-resultados');
  $('busca').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('busca-texto').value.trim();
    if (q.length < 2) return;
    resultados.hidden = false;
    resultados.innerHTML = '<li class="info">Buscando…</li>';
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=br&bounded=1' +
      '&accept-language=pt-BR&viewbox=-49,-0.5,-34.5,-18.5&q=' + encodeURIComponent(q);
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (itens) {
        resultados.innerHTML = '';
        if (!itens.length) {
          resultados.innerHTML = '<li class="info">Nada encontrado no Nordeste para “' + esc(q) + '”.</li>';
          return;
        }
        itens.forEach(function (it) {
          var partes = it.display_name.split(', ');
          var li = document.createElement('li');
          var b = document.createElement('button');
          b.type = 'button';
          b.innerHTML = esc(partes[0]) + '<small>' + esc(partes.slice(1, 4).join(', ')) + '</small>';
          b.addEventListener('click', function () {
            resultados.hidden = true;
            mapa.flyTo([Number(it.lat), Number(it.lon)], 14, { duration: 1.2 });
          });
          li.appendChild(b);
          resultados.appendChild(li);
        });
      })
      .catch(function () {
        resultados.innerHTML = '<li class="info">A busca não respondeu. Tente de novo em instantes.</li>';
      });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.topo')) resultados.hidden = true;
  });

  // ---------- Minha localização ----------
  var pontoVoce = null;
  $('btn-local').addEventListener('click', function () {
    if (!navigator.geolocation) { toast('Seu navegador não informa a localização.'); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      if (!pontoVoce) {
        pontoVoce = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="voce"></div>', iconSize: [18, 18] }), interactive: false }).addTo(mapa);
      } else {
        pontoVoce.setLatLng(ll);
      }
      if (!LIMITES.contains(ll)) toast('Você está fora do litoral nordestino.');
      mapa.flyTo(ll, 15);
    }, function () {
      toast('Não foi possível obter sua localização. Verifique a permissão do navegador.');
    }, { enableHighAccuracy: true, timeout: 10000 });
  });

  // ---------- Sobre ----------
  var modal = $('modal-sobre');
  $('btn-sobre').addEventListener('click', function (e) { e.preventDefault(); modal.hidden = false; });
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-fechar]')) modal.hidden = true;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!modal.hidden) modal.hidden = true;
    else if (marcando) sairModoMarcar();
    else if (!$('form-painel').hidden) fecharFormulario();
  });
  if (!lerLS('olho-na-mare:visitou')) {
    modal.hidden = false;
    gravarLS('olho-na-mare:visitou', '1');
  }

  // ---------- Exportar CSV ----------
  $('btn-csv').addEventListener('click', function () {
    var lista = filtradas();
    if (!lista.length) { toast('Não há marcações para exportar com esses filtros.'); return; }
    var cab = ['latitude', 'longitude', 'estado', 'local', 'tipo', 'intensidade', 'data_observada', 'registrado_em', 'descricao'];
    var cel = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var linhas = lista.map(function (m) {
      return [m.lat, m.lng, m.estado, m.local, TIPOS[m.tipo], INTENSIDADES[m.intensidade], m.dataObservada,
        new Date(m.criadoEm).toISOString(), m.descricao].map(cel).join(';');
    });
    var csv = '﻿' + cab.join(';') + '\n' + linhas.join('\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = 'olho-na-mare-' + hojeISO() + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  });
})();
