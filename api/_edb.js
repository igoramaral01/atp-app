const HOST='exercisedb.p.rapidapi.com';const KEY=process.env.EXERCISEDB_KEY;
// Português -> inglês (termos mais usados na academia)
const PT = {
  agachamento: 'squat', supino: 'bench press', remada: 'row', puxada: 'pulldown', 'barra fixa': 'pull-up',
  stiff: 'stiff leg deadlift', 'levantamento terra': 'deadlift', terra: 'deadlift', 'leg press': 'leg press',
  panturrilha: 'calf raise', avanço: 'lunge', afundo: 'lunge', passada: 'walking lunge', 'elevação pélvica': 'hip thrust',
  ponte: 'glute bridge', prancha: 'plank', abdominal: 'crunch', rosca: 'curl', tríceps: 'triceps', triceps: 'triceps',
  desenvolvimento: 'shoulder press', 'elevação lateral': 'lateral raise', crucifixo: 'fly', flexão: 'push-up',
  'cadeira extensora': 'leg extension', extensora: 'leg extension', 'mesa flexora': 'leg curl', flexora: 'leg curl',
  abdução: 'abduction', adução: 'adduction', mergulho: 'dips', paralelas: 'dips', encolhimento: 'shrug', burpee: 'burpee',
  'bird dog': 'bird dog', hiperextensão: 'hyperextension', 'face pull': 'face pull', polia: 'cable', halter: 'dumbbell',
  barra: 'barbell', elástico: 'band', kettlebell: 'kettlebell', búlgaro: 'bulgarian split squat',
};
module.exports.toEn=function toEn(q) {
  let s = q.toLowerCase().trim();
  if (PT[s]) return PT[s];
  for (const k of Object.keys(PT).sort((a, b) => b.length - a.length)) s = s.replace(k, PT[k]);
  return s;
}

module.exports.edb=async function edb(p) {
  const r = await fetch('https://' + HOST + p, { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST } });
  return r;
}


