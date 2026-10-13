const $ = id => document.getElementById(id);
let session;
try { session = JSON.parse(sessionStorage.getItem('caderno-session') || 'null'); } catch { session = null; }
let notes = [], editing = null, registering = false, busy = false, toastTimer;
function notify(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 3500); }
function signedOut() {
  session = null; notes = []; sessionStorage.removeItem('caderno-session');
  $('workspace').hidden = true; $('access').hidden = false;
  $('editor').close(); $('confirm-delete').close(); $('password').value = '';
}
async function api(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(session ? { Authorization: `Bearer ${session.token}` } : {}) };
  let response;
  try { response = await fetch(path, { ...options, headers }); } catch { throw new Error('Não foi possível conectar. Verifique sua conexão e tente novamente.'); }
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401 && path.startsWith('/notes')) { signedOut(); $('auth-error').textContent = 'Sua sessão terminou. Entre novamente.'; }
    throw new Error(data?.error?.message || 'Não foi possível concluir. Tente novamente.');
  }
  return data;
}
function render() {
  const query = $('search').value.toLocaleLowerCase('pt-BR').trim();
  const filtered = notes.filter(n => `${n.title} ${n.text}`.toLocaleLowerCase('pt-BR').includes(query));
  $('notes').replaceChildren(); $('count').textContent = notes.length;
  $('results').textContent = `${filtered.length} ${filtered.length === 1 ? 'nota' : 'notas'}`;
  for (const note of [...filtered].reverse()) {
    const card = document.createElement('button'); card.className = 'note-card';
    const title = document.createElement('h2'); title.textContent = note.title;
    const text = document.createElement('p'); text.textContent = note.text;
    const hint = document.createElement('small'); hint.textContent = 'ABRIR NOTA ↗';
    card.append(title, text, hint); card.addEventListener('click', () => openEditor(note)); $('notes').append(card);
  }
  $('empty').hidden = filtered.length !== 0;
  $('empty-title').textContent = query ? 'Nenhuma nota por aqui.' : 'Uma página em branco. Muitas possibilidades.';
  $('empty-copy').textContent = query ? 'Tente buscar por outra palavra.' : 'Crie sua primeira nota e dê um lugar às suas ideias.';
  $('empty-create').hidden = !!query;
}
async function loadNotes() {
  $('status').textContent = 'Carregando suas notas…'; $('retry').hidden = true; $('empty').hidden = true;
  try { notes = await api('/notes'); render(); $('status').textContent = ''; }
  catch (error) { $('status').textContent = error.message; $('retry').hidden = false; }
}
function enter() { $('access').hidden = true; $('workspace').hidden = false; $('account').textContent = session.email; $('search').value = ''; loadNotes(); }
$('auth-switch').onclick = () => {
  registering = !registering; $('auth-error').textContent = '';
  $('auth-title').textContent = registering ? 'Dê espaço às suas ideias.' : 'Bom ter você aqui.';
  $('auth-subtitle').textContent = registering ? 'Crie sua conta e comece seu caderno.' : 'Entre para reencontrar suas ideias.';
  $('auth-submit').textContent = registering ? 'Criar meu caderno →' : 'Entrar no caderno →';
  $('auth-switch').textContent = registering ? 'Entrar' : 'Criar conta';
  $('switch-label').textContent = registering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?';
  $('password').autocomplete = registering ? 'new-password' : 'current-password';
};
$('auth-form').onsubmit = async event => {
  event.preventDefault(); $('auth-error').textContent = ''; $('auth-submit').disabled = true; $('auth-switch').disabled = true;
  const credentials = { email: $('email').value.trim(), password: $('password').value };
  try {
    if (new TextEncoder().encode(credentials.password).length > 72) throw new Error('A senha deve ter no máximo 72 bytes.');
    if (registering) { await api('/auth/register', { method: 'POST', body: JSON.stringify(credentials) }); notify('Conta criada. Bem-vindo ao seu caderno!'); }
    const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
    session = { ...result, email: credentials.email.toLowerCase() }; sessionStorage.setItem('caderno-session', JSON.stringify(session)); $('password').value = ''; enter();
  } catch (error) { $('auth-error').textContent = error.message; }
  finally { $('auth-submit').disabled = false; $('auth-switch').disabled = false; }
};
function openEditor(note = null) {
  editing = note; $('note-title').value = note?.title || ''; $('note-text').value = note?.text || '';
  $('editor-label').textContent = note ? 'SUA NOTA' : 'NOVA NOTA'; $('delete-note').hidden = !note; $('note-error').textContent = '';
  $('editor').showModal(); $('note-title').focus();
}
function closeEditor() {
  if (busy) return;
  const changed = $('note-title').value !== (editing?.title || '') || $('note-text').value !== (editing?.text || '');
  if (!changed || confirm('Descartar as alterações não salvas?')) $('editor').close();
}
$('new-note').onclick = $('empty-create').onclick = () => openEditor();
$('close-editor').onclick = $('cancel-editor').onclick = closeEditor;
$('editor').addEventListener('cancel', event => { event.preventDefault(); closeEditor(); });
$('note-form').onsubmit = async event => {
  event.preventDefault(); if (busy) return;
  const body = { title: $('note-title').value.trim(), text: $('note-text').value };
  if (!body.title || !body.text.trim()) { $('note-error').textContent = 'Preencha o título e o texto da nota.'; return; }
  busy = true; $('save-note').disabled = true; $('delete-note').disabled = true; $('note-error').textContent = '';
  try {
    const saved = await api(editing ? `/notes/${editing.id}` : '/notes', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
    notes = editing ? notes.map(n => n.id === saved.id ? saved : n) : [...notes, saved];
    $('search').value = ''; render(); $('editor').close(); notify('Nota salva. Ideia guardada.');
  } catch (error) { $('note-error').textContent = error.message; }
  finally { busy = false; $('save-note').disabled = false; $('delete-note').disabled = false; }
};
$('delete-note').onclick = () => { $('delete-error').textContent = ''; $('confirm-delete').showModal(); };
$('cancel-delete').onclick = () => { if (!busy) $('confirm-delete').close(); };
$('confirm-delete').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('confirm-delete-button').onclick = async () => {
  if (busy || !editing) return; busy = true; $('confirm-delete-button').disabled = true;
  try { await api(`/notes/${editing.id}`, { method: 'DELETE' }); notes = notes.filter(n => n.id !== editing.id); render(); $('confirm-delete').close(); $('editor').close(); notify('Nota excluída.'); }
  catch (error) { $('delete-error').textContent = error.message; }
  finally { busy = false; $('confirm-delete-button').disabled = false; }
};
$('search').oninput = render; $('retry').onclick = loadNotes; $('logout').onclick = signedOut;
if (session?.token) enter(); else signedOut();
