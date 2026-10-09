'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Storage } = require('../storage');

function pastaTemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'prontuos-'));
}

test('salva e recarrega pacientes e atendimentos do disco', () => {
  const dir = pastaTemp();
  const s = new Storage(dir);
  const p = s.salvarPaciente({ nome: '  José da Silva ', cpf: '123' });
  s.salvarAtendimento({ pacienteId: p.id, data: '2026-10-09T10:00', queixa: 'Cefaleia' });

  const s2 = new Storage(dir);
  assert.strictEqual(s2.obterPaciente(p.id).nome, 'José da Silva');
  assert.strictEqual(s2.listarAtendimentos(p.id)[0].queixa, 'Cefaleia');
});

test('busca ignora acentos e maiúsculas', () => {
  const s = new Storage(pastaTemp());
  s.salvarPaciente({ nome: 'Ângela Souza' });
  s.salvarPaciente({ nome: 'Bruno Lima' });
  assert.deepStrictEqual(s.listarPacientes('angela').map((p) => p.nome), ['Ângela Souza']);
});

test('valida campos obrigatórios', () => {
  const s = new Storage(pastaTemp());
  assert.throws(() => s.salvarPaciente({ nome: ' ' }), /nome/);
  const p = s.salvarPaciente({ nome: 'Ana' });
  assert.throws(() => s.salvarAtendimento({ pacienteId: p.id }), /data/);
  assert.throws(() => s.salvarAtendimento({ pacienteId: 'x', data: '2026-01-01' }), /Paciente/);
});

test('excluir paciente remove seus atendimentos', () => {
  const s = new Storage(pastaTemp());
  const p = s.salvarPaciente({ nome: 'Ana' });
  s.salvarAtendimento({ pacienteId: p.id, data: '2026-01-01' });
  s.excluirPaciente(p.id);
  assert.strictEqual(s.db.atendimentos.length, 0);
});

test('exporta, importa e faz backup diário', () => {
  const dir = pastaTemp();
  const s = new Storage(dir);
  s.salvarPaciente({ nome: 'Ana' });
  const arquivo = path.join(dir, 'export.json');
  s.exportar(arquivo);

  const outra = new Storage(pastaTemp());
  outra.importar(arquivo);
  assert.strictEqual(outra.listarPacientes()[0].nome, 'Ana');

  assert.ok(fs.existsSync(s.backupDiario()));
  fs.writeFileSync(arquivo, '{"x":1}');
  assert.throws(() => outra.importar(arquivo), /inválido/);
});
