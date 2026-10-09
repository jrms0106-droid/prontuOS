# ProntuOS

Prontuário eletrônico que funciona como **aplicativo instalado no computador**
(Windows, macOS e Linux). Não precisa de internet: todos os dados ficam salvos
no próprio computador.

## Funcionalidades

- Cadastro de pacientes (dados pessoais, alergias, antecedentes, medicamentos em uso)
- Registro de atendimentos (queixa, anamnese, exame físico, hipótese diagnóstica, CID-10, conduta/prescrição)
- Busca por nome, CPF ou telefone (ignora acentos)
- Impressão do prontuário pela impressora do sistema
- Exportar/importar backup e backups automáticos diários (os 30 mais recentes)

## Integração com o sistema do computador

- **Instalador nativo** com atalho na Área de Trabalho e no Menu Iniciar (Windows),
  `.dmg` (macOS) e `.AppImage` (Linux)
- **Dados na pasta do usuário do sistema**:
  - Windows: `%APPDATA%\ProntuOS`
  - macOS: `~/Library/Application Support/ProntuOS`
  - Linux: `~/.config/ProntuOS`
- **Iniciar com o computador** (opção na barra lateral ou no menu *Sistema*):
  o ProntuOS abre minimizado na bandeja ao ligar o computador
- **Ícone na bandeja do sistema**: fechar a janela mantém o app aberto em segundo
  plano; use *Sair* para encerrar
- Apenas uma instância aberta por vez
- Janelas nativas de salvar/abrir arquivo e de impressão

## Como obter o instalador

Os instaladores são gerados automaticamente pelo GitHub Actions a cada envio:
abra a aba **Actions** do repositório → execução mais recente de *Instaladores* →
baixe o artefato do seu sistema (ex.: `ProntuOS-Windows`) e execute o instalador.

> Os instaladores não são assinados digitalmente; o Windows/macOS pode exibir um
> aviso de segurança na primeira execução ("Mais informações" → "Executar assim mesmo").

## Desenvolvimento

Requer Node.js 20 ou superior.

```bash
npm install
npm start          # abre o app
npm test           # testes do armazenamento
npm run dist:win   # gera instalador Windows em dist/ (também dist:mac, dist:linux)
```

Estrutura:

- `main.js` — processo principal (janela, bandeja, menu, início automático, backups)
- `preload.js` — ponte segura entre a interface e o sistema
- `storage.js` — gravação dos dados em arquivo local
- `src/` — interface (HTML/CSS/JS)
