'use strict';

const { contextBridge, ipcRenderer } = require('electron');

async function chamar(canal, ...args) {
  const r = await ipcRenderer.invoke(canal, ...args);
  if (!r.ok) throw new Error(r.erro);
  return r.valor;
}

contextBridge.exposeInMainWorld('prontuos', {
  pacientes: {
    listar: (busca) => chamar('pacientes:listar', busca),
    obter: (id) => chamar('pacientes:obter', id),
    salvar: (dados) => chamar('pacientes:salvar', dados),
    excluir: (id) => chamar('pacientes:excluir', id),
  },
  atendimentos: {
    listar: (pacienteId) => chamar('atendimentos:listar', pacienteId),
    salvar: (dados) => chamar('atendimentos:salvar', dados),
    excluir: (id) => chamar('atendimentos:excluir', id),
  },
  sistema: {
    info: () => chamar('sistema:info'),
    inicioAutomatico: (ativo) => chamar('sistema:inicio-automatico', ativo),
    abrirPasta: () => chamar('sistema:abrir-pasta'),
    exportar: () => chamar('sistema:exportar'),
    importar: () => chamar('sistema:importar'),
    imprimir: () => chamar('sistema:imprimir'),
  },
  aoEvento: (canal, fn) => {
    const permitidos = ['menu:novo-paciente', 'dados:recarregar'];
    if (permitidos.includes(canal)) ipcRenderer.on(canal, () => fn());
  },
});
