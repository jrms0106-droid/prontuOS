'use strict';

const api = window.prontuos;
const $ = (sel) => document.querySelector(sel);

const estado = { pacienteId: null, atendimentoId: null };

const CAMPOS_ATENDIMENTO = [
  ['queixa', 'Queixa principal'],
  ['anamnese', 'Anamnese / HDA'],
  ['exameFisico', 'Exame físico'],
  ['diagnostico', 'Hipótese diagnóstica'],
  ['cid', 'CID-10'],
  ['conduta', 'Conduta / prescrição'],
];

function avisar(msg) {
  const el = $('#aviso');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => (el.hidden = true), 3000);
}

async function tentar(fn) {
  try {
    return await fn();
  } catch (e) {
    avisar(e.message);
  }
}

function idade(nascimento) {
  if (!nascimento) return '';
  const n = new Date(nascimento + 'T00:00:00');
  const h = new Date();
  let anos = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) anos--;
  return `${anos} anos`;
}

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function agoraLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function dadosDoForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function preencherForm(form, dados) {
  form.reset();
  for (const el of form.elements) {
    if (el.name && dados[el.name] != null) el.value = dados[el.name];
  }
}

// ---------- Pacientes ----------

async function carregarLista() {
  const pacientes = await tentar(() => api.pacientes.listar($('#busca').value));
  if (!pacientes) return;
  const ul = $('#lista-pacientes');
  ul.replaceChildren();
  if (!pacientes.length) {
    const li = document.createElement('li');
    li.className = 'sem-itens';
    li.textContent = $('#busca').value ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado.';
    ul.append(li);
    return;
  }
  for (const p of pacientes) {
    const li = document.createElement('li');
    li.className = p.id === estado.pacienteId ? 'ativo' : '';
    const nome = document.createElement('div');
    nome.textContent = p.nome;
    const det = document.createElement('small');
    det.textContent = [idade(p.nascimento), p.cpf].filter(Boolean).join(' · ');
    li.append(nome, det);
    li.addEventListener('click', () => abrirPaciente(p.id));
    ul.append(li);
  }
}

function mostrarTelaPaciente() {
  $('#vazio').hidden = true;
  $('#tela-paciente').hidden = false;
  fecharFormAtendimento();
}

function novoPaciente() {
  estado.pacienteId = null;
  mostrarTelaPaciente();
  preencherForm($('#form-paciente'), {});
  $('#titulo-paciente').textContent = 'Novo paciente';
  $('#btn-excluir-paciente').hidden = true;
  $('#btn-imprimir').hidden = true;
  $('#area-atendimentos').hidden = true;
  $('#form-paciente [name=nome]').focus();
  carregarLista();
}

async function abrirPaciente(id) {
  const p = await tentar(() => api.pacientes.obter(id));
  if (!p) return;
  estado.pacienteId = id;
  mostrarTelaPaciente();
  preencherForm($('#form-paciente'), p);
  $('#titulo-paciente').textContent = [p.nome, idade(p.nascimento)].filter(Boolean).join(' — ');
  $('#btn-excluir-paciente').hidden = false;
  $('#btn-imprimir').hidden = false;
  $('#area-atendimentos').hidden = false;
  carregarLista();
  carregarAtendimentos();
}

async function salvarPaciente(e) {
  e.preventDefault();
  const dados = dadosDoForm(e.target);
  if (estado.pacienteId) dados.id = estado.pacienteId;
  const p = await tentar(() => api.pacientes.salvar(dados));
  if (!p) return;
  avisar('Paciente salvo.');
  abrirPaciente(p.id);
}

async function excluirPaciente() {
  if (!estado.pacienteId) return;
  if (!confirm('Excluir este paciente e todos os seus atendimentos? Esta ação não pode ser desfeita.')) return;
  await tentar(() => api.pacientes.excluir(estado.pacienteId));
  estado.pacienteId = null;
  $('#tela-paciente').hidden = true;
  $('#vazio').hidden = false;
  avisar('Paciente excluído.');
  carregarLista();
}

// ---------- Atendimentos ----------

async function carregarAtendimentos() {
  const lista = await tentar(() => api.atendimentos.listar(estado.pacienteId));
  if (!lista) return;
  const ol = $('#lista-atendimentos');
  ol.replaceChildren();
  if (!lista.length) {
    const li = document.createElement('li');
    li.textContent = 'Nenhum atendimento registrado.';
    ol.append(li);
    return;
  }
  for (const a of lista) {
    const li = document.createElement('li');
    const topo = document.createElement('div');
    topo.className = 'topo';
    const titulo = document.createElement('strong');
    titulo.textContent = [formatarData(a.data), a.profissional].filter(Boolean).join(' — ');
    const botoes = document.createElement('div');
    botoes.className = 'botoes sem-impressao';
    const editar = document.createElement('button');
    editar.textContent = 'Editar';
    editar.addEventListener('click', () => abrirFormAtendimento(a));
    const excluir = document.createElement('button');
    excluir.textContent = 'Excluir';
    excluir.className = 'perigo';
    excluir.addEventListener('click', () => excluirAtendimento(a.id));
    botoes.append(editar, excluir);
    topo.append(titulo, botoes);

    const dl = document.createElement('dl');
    for (const [campo, rotulo] of CAMPOS_ATENDIMENTO) {
      if (!a[campo]) continue;
      const dt = document.createElement('dt');
      dt.textContent = rotulo;
      const dd = document.createElement('dd');
      dd.textContent = a[campo];
      dl.append(dt, dd);
    }
    li.append(topo, dl);
    ol.append(li);
  }
}

function abrirFormAtendimento(atendimento) {
  const form = $('#form-atendimento');
  estado.atendimentoId = atendimento ? atendimento.id : null;
  preencherForm(form, atendimento || { data: agoraLocal() });
  form.hidden = false;
  form.querySelector('[name=queixa]').focus();
}

function fecharFormAtendimento() {
  estado.atendimentoId = null;
  $('#form-atendimento').hidden = true;
}

async function salvarAtendimento(e) {
  e.preventDefault();
  const dados = dadosDoForm(e.target);
  dados.pacienteId = estado.pacienteId;
  if (estado.atendimentoId) dados.id = estado.atendimentoId;
  const a = await tentar(() => api.atendimentos.salvar(dados));
  if (!a) return;
  avisar('Atendimento salvo.');
  fecharFormAtendimento();
  carregarAtendimentos();
}

async function excluirAtendimento(id) {
  if (!confirm('Excluir este atendimento?')) return;
  await tentar(() => api.atendimentos.excluir(id));
  carregarAtendimentos();
}

// ---------- Integração com o sistema ----------

async function carregarSistema() {
  const info = await tentar(() => api.sistema.info());
  if (!info) return;
  $('#chk-inicio').checked = info.iniciarComSistema;
  $('#info-sistema').textContent = `v${info.versao} · Dados em: ${info.pastaDados}`;
}

async function alternarInicio(e) {
  const ativo = await tentar(() => api.sistema.inicioAutomatico(e.target.checked));
  if (ativo === undefined) return;
  e.target.checked = ativo;
  avisar(ativo ? 'O ProntuOS iniciará junto com o computador.' : 'Início automático desativado.');
}

// ---------- Eventos ----------

$('#btn-novo').addEventListener('click', novoPaciente);
$('#busca').addEventListener('input', carregarLista);
$('#form-paciente').addEventListener('submit', salvarPaciente);
$('#btn-excluir-paciente').addEventListener('click', excluirPaciente);
$('#btn-imprimir').addEventListener('click', () => tentar(() => api.sistema.imprimir()));
$('#btn-novo-atendimento').addEventListener('click', () => abrirFormAtendimento(null));
$('#btn-cancelar-atendimento').addEventListener('click', fecharFormAtendimento);
$('#form-atendimento').addEventListener('submit', salvarAtendimento);
$('#chk-inicio').addEventListener('change', alternarInicio);
$('#btn-exportar').addEventListener('click', async () => {
  if (await tentar(() => api.sistema.exportar())) avisar('Backup exportado.');
});
$('#btn-importar').addEventListener('click', async () => {
  if (await tentar(() => api.sistema.importar())) avisar('Backup importado.');
});
$('#btn-pasta').addEventListener('click', () => tentar(() => api.sistema.abrirPasta()));

api.aoEvento('menu:novo-paciente', novoPaciente);
api.aoEvento('dados:recarregar', () => {
  estado.pacienteId = null;
  $('#tela-paciente').hidden = true;
  $('#vazio').hidden = false;
  carregarLista();
});

carregarLista();
carregarSistema();
