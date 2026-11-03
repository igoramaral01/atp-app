/**
 * ATP App: backup semanal para o Google Drive.
 *
 * Toda semana cria, dentro da pasta escolhida, uma subpasta com a data
 * (ex.: "Backup 2026-12-06") contendo:
 *   - uma planilha Google por aluno (uma aba por mês, igual à planilha de treino)
 *   - um arquivo .json com o banco inteiro (serve para restaurar tudo)
 * Mantém só as últimas MANTER_SEMANAS cópias e apaga as mais antigas.
 *
 * Como instalar: veja as instruções na conversa / README.
 */

const PASTA_ID = 'COLE_AQUI_O_ID_DA_PASTA';
const PROJETO = 'atp-app-amaral';
const MANTER_SEMANAS = 12;

function instalar() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('fazerBackup').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(4).create();
  fazerBackup();
}

function fazerBackup() {
  const raiz = DriveApp.getFolderById(PASTA_ID);
  const hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
  const pasta = raiz.createFolder('Backup ' + hoje);

  const banco = {};
  ['athletes', 'users', 'meta'].forEach(c => banco[c] = lerColecao(c));
  pasta.createFile('banco-completo-' + hoje + '.json', JSON.stringify(banco, null, 1), MimeType.PLAIN_TEXT);

  Object.keys(banco.athletes).forEach(id => {
    const a = banco.athletes[id];
    const ss = SpreadsheetApp.create('ATP - ' + (a.nome || id) + ' - ' + hoje);
    DriveApp.getFileById(ss.getId()).moveTo(pasta);
    const fb = a.fb || {};
    (a.months || []).forEach((m, i) => {
      const sh = i === 0 ? ss.getSheets()[0].setName(nomeAba(m.nome)) : ss.insertSheet(nomeAba(m.nome));
      const cols = m.cols || [];
      const linhas = [[a.nome || ''], cols.map(c => c.l)];
      (m.rows || []).forEach(r => {
        if (r.w != null) linhas.push(['SEMANA ' + r.w]);
        else if (r.sum != null) linhas.push(['RESUMO', '', '', '', '', '', 'KM semana = ' + (r.km || 0)]);
        else {
          const f = (r.id && fb[r.id]) || {};
          linhas.push(cols.map(c => {
            const v = (c.id === 's' || c.id === 'r' || c.id === 'o') && f[c.id] !== undefined ? f[c.id] : r[c.id];
            return v == null ? '' : String(v);
          }));
        }
      });
      const largura = Math.max.apply(null, linhas.map(l => l.length));
      const tabela = linhas.map(l => l.concat(Array(largura - l.length).fill('')));
      sh.getRange(1, 1, tabela.length, largura).setValues(tabela);
      sh.getRange(2, 1, 1, largura).setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
    });
    const fichas = ss.insertSheet('Fichas');
    const lf = [['Pasta', 'Ficha', 'Exercício', 'Prescrição', 'Descanso (s)']];
    (a.pastas || []).forEach(p => (p.fichas || []).forEach(f => (f.ex || []).forEach(x =>
      lf.push([p.nome, f.nome, x.n, x.pres || '', x.desc != null ? x.desc : 60]))));
    fichas.getRange(1, 1, lf.length, 5).setValues(lf);
    fichas.getRange(1, 1, 1, 5).setFontWeight('bold');
  });

  const antigas = [];
  const it = raiz.getFolders();
  while (it.hasNext()) { const f = it.next(); if (/^Backup \d{4}-\d{2}-\d{2}$/.test(f.getName())) antigas.push(f); }
  antigas.sort((x, y) => y.getName().localeCompare(x.getName()));
  antigas.slice(MANTER_SEMANAS).forEach(f => f.setTrashed(true));
}

function nomeAba(n) { return String(n || 'Mês').replace(/[\[\]*?\/\\:]/g, ' ').slice(0, 90); }

function lerColecao(col) {
  const out = {};
  let token = '';
  do {
    const url = 'https://firestore.googleapis.com/v1/projects/' + PROJETO + '/databases/(default)/documents/' + col +
      '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : '');
    const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('Erro ao ler ' + col + ': ' + res.getContentText());
    const j = JSON.parse(res.getContentText());
    (j.documents || []).forEach(d => out[d.name.split('/').pop()] = valor({ mapValue: { fields: d.fields || {} } }));
    token = j.nextPageToken || '';
  } while (token);
  return out;
}

function valor(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valor);
  if ('mapValue' in v) { const o = {}; const f = v.mapValue.fields || {}; Object.keys(f).forEach(k => o[k] = valor(f[k])); return o; }
  return null;
}
