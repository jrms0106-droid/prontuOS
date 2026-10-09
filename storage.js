'use strict';

// Armazenamento local do ProntuOS: um arquivo JSON na pasta de dados do
// usuário do sistema operacional, com gravação atômica e backups automáticos.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = 'prontuos-dados.json';
const BACKUP_DIR = 'backups';
const MAX_BACKUPS = 30;

function emptyDb() {
  return { versao: 1, pacientes: [], atendimentos: [] };
}

function novoId() {
  return crypto.randomUUID();
}

class Storage {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, DATA_FILE);
    this.backupDir = path.join(dir, BACKUP_DIR);
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.db = this._load();
  }

  _load() {
    if (!fs.existsSync(this.file)) return emptyDb();
    const db = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    return { ...emptyDb(), ...db };
  }

  _save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  // Cria no máximo um backup por dia e mantém os MAX_BACKUPS mais recentes.
  backupDiario() {
    if (!fs.existsSync(this.file)) return null;
    const dia = new Date().toISOString().slice(0, 10);
    const destino = path.join(this.backupDir, `prontuos-${dia}.json`);
    if (!fs.existsSync(destino)) fs.copyFileSync(this.file, destino);
    const antigos = fs.readdirSync(this.backupDir).filter((f) => f.endsWith('.json')).sort();
    for (const f of antigos.slice(0, Math.max(0, antigos.length - MAX_BACKUPS))) {
      fs.unlinkSync(path.join(this.backupDir, f));
    }
    return destino;
  }

  listarPacientes(busca = '') {
    const termo = normalizar(busca);
    return this.db.pacientes
      .filter((p) => !termo || normalizar(`${p.nome} ${p.cpf || ''} ${p.telefone || ''}`).includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  obterPaciente(id) {
    return this.db.pacientes.find((p) => p.id === id) || null;
  }

  salvarPaciente(dados) {
    if (!dados || !String(dados.nome || '').trim()) throw new Error('O nome do paciente é obrigatório.');
    const agora = new Date().toISOString();
    let paciente = dados.id && this.obterPaciente(dados.id);
    if (paciente) {
      Object.assign(paciente, dados, { atualizadoEm: agora });
    } else {
      paciente = { ...dados, id: novoId(), criadoEm: agora, atualizadoEm: agora };
      this.db.pacientes.push(paciente);
    }
    paciente.nome = paciente.nome.trim();
    this._save();
    return paciente;
  }

  excluirPaciente(id) {
    this.db.pacientes = this.db.pacientes.filter((p) => p.id !== id);
    this.db.atendimentos = this.db.atendimentos.filter((a) => a.pacienteId !== id);
    this._save();
  }

  listarAtendimentos(pacienteId) {
    return this.db.atendimentos
      .filter((a) => a.pacienteId === pacienteId)
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }

  salvarAtendimento(dados) {
    if (!dados || !this.obterPaciente(dados.pacienteId)) throw new Error('Paciente não encontrado.');
    if (!dados.data) throw new Error('A data do atendimento é obrigatória.');
    const agora = new Date().toISOString();
    let atendimento = dados.id && this.db.atendimentos.find((a) => a.id === dados.id);
    if (atendimento) {
      Object.assign(atendimento, dados, { atualizadoEm: agora });
    } else {
      atendimento = { ...dados, id: novoId(), criadoEm: agora, atualizadoEm: agora };
      this.db.atendimentos.push(atendimento);
    }
    this._save();
    return atendimento;
  }

  excluirAtendimento(id) {
    this.db.atendimentos = this.db.atendimentos.filter((a) => a.id !== id);
    this._save();
  }

  exportar(destino) {
    fs.writeFileSync(destino, JSON.stringify(this.db, null, 2), 'utf8');
  }

  importar(origem) {
    const db = JSON.parse(fs.readFileSync(origem, 'utf8'));
    if (!Array.isArray(db.pacientes) || !Array.isArray(db.atendimentos)) {
      throw new Error('Arquivo de backup inválido.');
    }
    this.backupDiario();
    this.db = { ...emptyDb(), ...db };
    this._save();
  }
}

function normalizar(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

module.exports = { Storage };
