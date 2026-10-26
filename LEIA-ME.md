# Olho na Maré

Mapa colaborativo e anônimo de manchas de petróleo nas praias do litoral nordestino.
Qualquer pessoa abre o site, toca em **Marcar vazamento**, toca no ponto da praia e registra o que viu. Ninguém precisa criar conta nem se identificar.

## Arquivos

```
olho-na-mare/
├── index.html        página principal
├── css/style.css     visual
├── js/config.js      ← aqui você cola a configuração do Firebase
├── js/storage.js     salva e lê as marcações
├── js/app.js         mapa, formulário, busca, lista, exportação CSV
└── firestore.rules   regras de segurança do banco de dados
```

O site é 100% estático (só HTML, CSS e JavaScript): funciona em qualquer hospedagem gratuita.

## Passo 1: criar o banco de dados (Firebase, gratuito)

Sem esta etapa o site funciona em **modo demonstração**: cada pessoa só vê as próprias marcações. Para que todos vejam as marcações de todos:

1. Acesse https://console.firebase.google.com e entre com uma conta Google (a sua, de professor).
2. **Criar projeto** → dê o nome `olho-na-mare` → pode desativar o Google Analytics → Criar.
3. No menu lateral: **Criação → Firestore Database → Criar banco de dados**.
   - Local: `southamerica-east1 (São Paulo)`.
   - Modo: **produção**.
4. Na aba **Regras** do Firestore, apague o conteúdo e cole todo o arquivo `firestore.rules`. Clique em **Publicar**.
5. Volte à página inicial do projeto (ícone de engrenagem → **Configurações do projeto**). Em "Seus apps", clique no ícone **`</>`** (Web), dê um apelido (ex.: `site`) e clique em **Registrar app**. Não precisa ativar o Firebase Hosting aqui.
6. O console mostra um bloco `const firebaseConfig = { apiKey: "...", ... }`. Copie cada valor para o arquivo `js/config.js`.

> A `apiKey` do Firebase não é secreta: ela fica visível em qualquer site que usa Firebase. Quem protege os dados são as regras do `firestore.rules`, que só permitem **criar** marcações válidas (dentro do litoral nordestino, com campos e tamanhos corretos) e **proíbem editar ou apagar** pelo site.

O plano gratuito (Spark) permite 50 mil leituras e 20 mil gravações por dia, mais que suficiente para uma turma ou uma escola inteira.

## Passo 2: publicar o site

Escolha uma opção:

**Netlify Drop (mais fácil, 1 minuto)**
1. Acesse https://app.netlify.com/drop
2. Arraste a pasta `olho-na-mare` inteira para a página.
3. Pronto: você recebe um endereço `https://algum-nome.netlify.app`. Crie uma conta gratuita para manter o site no ar e escolher o nome (ex.: `olhonamare.netlify.app`).

**GitHub Pages**
1. Crie um repositório público no GitHub e envie o conteúdo da pasta.
2. Em **Settings → Pages**, escolha a branch `main` e a pasta `/ (root)`.
3. O site fica em `https://seu-usuario.github.io/nome-do-repositorio/`.

**Firebase Hosting** (mesmo projeto do banco) também funciona, se preferir tudo num só lugar.

## Moderação

Como as marcações são anônimas, alguém pode registrar algo falso ou ofensivo. Para remover:
Firebase → Firestore Database → coleção `marcacoes` → abra o documento → **Excluir documento**. O mapa atualiza sozinho para todos.

Proteções já incluídas:
- só aceita pontos entre o Maranhão e o sul da Bahia;
- textos limitados a 120 (local) e 500 (descrição) caracteres, sem HTML;
- intervalo mínimo de 45 segundos entre marcações no mesmo navegador (ajustável em `js/config.js`);
- ninguém consegue editar ou apagar marcações pelo site.

## Recursos para usar em aula

- **Baixar planilha (CSV)** no painel exporta as marcações filtradas (abre no Excel ou Google Planilhas) para análises: quantas por estado, por mês, por intensidade.
- Filtros por estado, período e intensidade.
- Camada de satélite para identificar a praia com precisão.
- Botão de localização: no celular, na praia, leva direto ao ponto onde a pessoa está (exige site em `https://`, que todas as opções acima já oferecem).

## Créditos dos mapas

Mapa base © colaboradores do OpenStreetMap; imagens de satélite © Esri; busca de endereços pelo Nominatim (OpenStreetMap). São serviços gratuitos para uso educacional de baixo volume e não exigem chave.
