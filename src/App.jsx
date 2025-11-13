// src/ProtocolManagementSystem.jsx
import { useEffect, useState } from "react";
import { PlusCircle, Trash2, Edit2, Download, Paperclip } from "lucide-react";
import * as XLSX from "xlsx";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

const ProtocolManagementSystem = () => {
  // state
  const [protocols, setProtocols] = useState([]);
  const [filteredProtocols, setFilteredProtocols] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [showNewProtocolModal, setShowNewProtocolModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [attachments, setAttachments] = useState([]);

  const [newProtocol, setNewProtocol] = useState({
    email_cliente: '',
    assunto_original: '',
    detalhes: '',
    responsavel: ''
  });
  const [editProtocol, setEditProtocol] = useState(null);

  const statusOptions = [
    '1. Orçamento Solicitado',
    '2. Orçamento Enviado',
    '3. Orçamento Aprovado - Iniciar Produção',
    '4. Entregue ao Cliente'
  ];

  // Firestore collection ref
  const protocolsCol = collection(db, 'protocols');

  // realtime listener
  useEffect(() => {
    const q = query(protocolsCol, orderBy('data_entrada', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProtocols(docs);
    }, err => {
      console.error('onSnapshot error', err);
      addNotification('Erro ao sincronizar dados', 'error');
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filtering & searching
  useEffect(() => {
    let filtered = protocols || [];
    if (statusFilter !== 'TODOS') {
      filtered = filtered.filter(p => p.status_processo === statusFilter);
    }
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        (p.id_protocolo || '').toLowerCase().includes(term) ||
        (p.email_cliente || '').toLowerCase().includes(term) ||
        (p.assunto_original || '').toLowerCase().includes(term)
      );
    }
    setFilteredProtocols(filtered);
  }, [protocols, statusFilter, searchTerm]);

  // helpers
  const addNotification = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4500);
  };

  const generateProtocolId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const seq = String(Math.floor(Math.random() * 900) + 100); // random 3 digits to avoid collisions
    return `${year}${month}${day}-${seq}`;
  };

  // file handling (local before uploading)
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const newAtt = files.map(f => ({
      id: Date.now() + Math.random(),
      name: f.name,
      size: (f.size / 1024).toFixed(2) + ' KB',
      type: f.type || 'application/octet-stream',
      file: f
    }));
    setAttachments(prev => [...prev, ...newAtt]);
  };

  const removeAttachment = (id) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // upload attachments to Storage under attachments/{docId}/{filename}
  const uploadAttachments = async (docId) => {
    if (!attachments || attachments.length === 0) return [];
    const uploaded = [];
    for (const att of attachments) {
      const storagePath = `attachments/${docId}/${Date.now()}_${att.name}`;
      const fileRef = ref(storage, storagePath);
      try {
        await uploadBytes(fileRef, att.file);
        const url = await getDownloadURL(fileRef);
        uploaded.push({
          id: att.id,
          name: att.name,
          size: att.size,
          type: att.type,
          url,
          path: storagePath // important for later deletion
        });
      } catch (err) {
        console.error('upload error', err);
        addNotification(`Erro ao enviar ${att.name}`, 'error');
      }
    }
    return uploaded;
  };

  // create
  const createNewProtocol = async () => {
    if (!newProtocol.email_cliente || !newProtocol.assunto_original) {
      addNotification('Preencha os campos obrigatórios', 'error');
      return;
    }

    const id_protocolo = generateProtocolId();
    const base = {
      id_protocolo,
      data_entrada: new Date().toISOString(),
      email_cliente: newProtocol.email_cliente,
      assunto_original: newProtocol.assunto_original,
      status_processo: '1. Orçamento Solicitado',
      responsavel: newProtocol.responsavel || 'Não atribuído',
      data_ultima_atualizacao: new Date().toISOString(),
      detalhes: newProtocol.detalhes || '',
      aprovacao_orcamento: 'PENDENTE',
      confirmacao_cliente: 'PENDENTE',
      attachments: []
    };

    try {
      const docRef = await addDoc(protocolsCol, base);
      // upload attachments (if any)
      const uploaded = await uploadAttachments(docRef.id);
      if (uploaded.length > 0) {
        await updateDoc(doc(db, 'protocols', docRef.id), { attachments: uploaded });
      }
      setShowNewProtocolModal(false);
      setNewProtocol({ email_cliente: '', assunto_original: '', detalhes: '', responsavel: '' });
      setAttachments([]);
      addNotification(`Protocolo ${id_protocolo} criado com sucesso!`);
    } catch (err) {
      console.error('create error', err);
      addNotification('Erro ao criar protocolo', 'error');
    }
  };

  // update status with approval logic
  const updateProtocolStatus = async (docId, newStatus) => {
    try {
      const p = protocols.find(x => x.id === docId);
      if (!p) return;
      const updated = { status_processo: newStatus, data_ultima_atualizacao: new Date().toISOString() };

      // Check approval combo rules (if both approvals done, set status to 3)
      if (
        (p.aprovacao_orcamento === 'APROVADO' || updated.aprovacao_orcamento === 'APROVADO') &&
        (p.confirmacao_cliente === 'CONFIRMADO' || updated.confirmacao_cliente === 'CONFIRMADO')
      ) {
        // If either approval fields are already set, ensure status becomes 3 when appropriate
        updated.status_processo = '3. Orçamento Aprovado - Iniciar Produção';
      }

      await updateDoc(doc(db, 'protocols', docId), updated);
      addNotification('Status atualizado com sucesso!');
    } catch (err) {
      console.error('updateStatus error', err);
      addNotification('Erro ao atualizar status', 'error');
    }
  };

  // update approval fields (aprovacao_orcamento or confirmacao_cliente)
  const updateApprovalStatus = async (docId, field, value) => {
    try {
      const p = protocols.find(x => x.id === docId);
      if (!p) return;
      const updated = { [field]: value, data_ultima_atualizacao: new Date().toISOString() };

      // if both approvals are positive, change status_processo
      const aprov = field === 'aprovacao_orcamento' ? value : p.aprovacao_orcamento;
      const conf = field === 'confirmacao_cliente' ? value : p.confirmacao_cliente;

      if (aprov === 'APROVADO' && conf === 'CONFIRMADO') {
        updated.status_processo = '3. Orçamento Aprovado - Iniciar Produção';
        addNotification('Aprovação dupla confirmada! Produção iniciada.', 'success');
      }

      await updateDoc(doc(db, 'protocols', docId), updated);
    } catch (err) {
      console.error('updateApproval error', err);
      addNotification('Erro ao atualizar aprovação', 'error');
    }
  };

  // edit (open modal)
  const openEditModal = (protocol) => {
    setEditProtocol({ ...protocol });
    setShowEditModal(true);
  };

  // save edit
  const saveEditedProtocol = async () => {
    if (!editProtocol) return;
    try {
      const docRef = doc(db, 'protocols', editProtocol.id);
      await updateDoc(docRef, {
        email_cliente: editProtocol.email_cliente,
        assunto_original: editProtocol.assunto_original,
        responsavel: editProtocol.responsavel,
        detalhes: editProtocol.detalhes || '',
        data_ultima_atualizacao: new Date().toISOString()
      });

      // if there are new local attachments queued in attachments state, upload and append
      if (attachments.length > 0) {
        const uploaded = await uploadAttachments(editProtocol.id);
        if (uploaded.length > 0) {
          const existing = editProtocol.attachments || [];
          await updateDoc(docRef, { attachments: [...existing, ...uploaded] });
        }
        setAttachments([]);
      }

      setShowEditModal(false);
      setEditProtocol(null);
      addNotification('Protocolo editado com sucesso!');
    } catch (err) {
      console.error('save edit error', err);
      addNotification('Erro ao salvar edição', 'error');
    }
  };

  // delete protocol (and its attachments in storage)
  const deleteProtocol = async (docId) => {
    if (!window.confirm('Tem certeza que deseja excluir este protocolo? Esta ação não pode ser desfeita.')) return;
    try {
      const p = protocols.find(x => x.id === docId);
      if (p && p.attachments && p.attachments.length) {
        for (const att of p.attachments) {
          if (att.path) {
            try {
              await deleteObject(ref(storage, att.path));
            } catch (err) {
              // file might already be missing; continue
              console.warn('delete file error', err);
            }
          }
        }
      }
      await deleteDoc(doc(db, 'protocols', docId));
      setShowDetailModal(false);
      setSelectedProtocol(null);
      addNotification('Protocolo excluído com sucesso!');
    } catch (err) {
      console.error('delete error', err);
      addNotification('Erro ao excluir protocolo', 'error');
    }
  };

  // download attachment (open in new tab)
  const openAttachment = (att) => {
    if (att.url) window.open(att.url, '_blank');
  };

  // export XLSX (uses filteredProtocols to export what's visible)
  const exportToXLSX = () => {
    const headers = [
      'ID Protocolo',
      'Data de Entrada',
      'E-mail do Cliente',
      'Assunto',
      'Status do Processo',
      'Responsável',
      'Aprovação Orçamento',
      'Confirmação Cliente',
      'Última Atualização',
      'Detalhes',
      'Anexos'
    ];

    const rows = filteredProtocols.map(p => [
      p.id_protocolo,
      p.data_entrada ? new Date(p.data_entrada).toLocaleString('pt-BR') : '',
      p.email_cliente,
      p.assunto_original,
      p.status_processo,
      p.responsavel,
      p.aprovacao_orcamento,
      p.confirmacao_cliente,
      p.data_ultima_atualizacao ? new Date(p.data_ultima_atualizacao).toLocaleString('pt-BR') : '',
      p.detalhes || '',
      p.attachments ? p.attachments.length : 0
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Protocolos');
    XLSX.writeFile(workbook, `protocolos_${new Date().toISOString().split('T')[0]}.xlsx`);
    addNotification('Planilha XLSX exportada com sucesso!');
  };

  // UI helpers
  const getStatusColor = (status) => {
    const colors = {
      '1. Orçamento Solicitado': 'bg-amber-50 text-amber-700 border-amber-200',
      '2. Orçamento Enviado': 'bg-blue-50 text-blue-700 border-blue-200',
      '3. Orçamento Aprovado - Iniciar Produção': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      '4. Entregue ao Cliente': 'bg-slate-50 text-slate-700 border-slate-200'
    };
    return colors[status] || 'bg-gray-50 text-gray-700';
  };

  const getStatusIcon = (status) => {
    const icons = {
      '1. Orçamento Solicitado': <Clock className="w-4 h-4" />,
      '2. Orçamento Enviado': <Mail className="w-4 h-4" />,
      '3. Orçamento Aprovado - Iniciar Produção': <CheckCircle className="w-4 h-4" />,
      '4. Entregue ao Cliente': <Package className="w-4 h-4" />
    };
    return icons[status] || <AlertCircle className="w-4 h-4" />;
  };

  // render (keeps your original markup and style)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {notifications.map(notif => (
          <div
            key={notif.id}
            className={`px-5 py-3 rounded-xl shadow-2xl ${
              notif.type === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
            } text-white animate-slide-in backdrop-blur-sm border border-white/20`}
          >
            <p className="font-medium">{notif.message}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-lg border-b border-slate-200/50 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl shadow-lg">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Sistema de Gestão de Protocolo
                </h1>
                <p className="text-sm text-slate-600 mt-1 font-medium">Gerenciamento profissional de orçamentos e entregas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por ID, cliente ou assunto..."
                  className="pl-10 pr-4 py-2 rounded-xl border border-slate-300 bg-white/60"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white/60"
              >
                <option value="TODOS">📊 Todos os Status</option>
                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => setShowNewProtocolModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl">
                <Plus className="w-4 h-4" /> Novo
              </button>
              <button onClick={exportToXLSX} className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border">
                <Download className="w-4 h-4" /> Exportar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {statusOptions.map((status, idx) => {
            const count = protocols.filter(p => p.status_processo === status).length;
            const grads = ['from-amber-400 to-orange-500', 'from-blue-400 to-cyan-500', 'from-emerald-400 to-green-500', 'from-slate-400 to-gray-500'];
            return (
              <div key={status} className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-600 uppercase">{status.split('.')[1]?.trim()}</p>
                    <p className="text-3xl font-bold mt-2">{count}</p>
                  </div>
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${grads[idx]} text-white`}>
                    {getStatusIcon(status)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* table */}
        <div className="mt-6 bg-white/80 rounded-2xl shadow-lg border p-4 overflow-x-auto">
          <table className="w-full">
            <thead className="text-xs text-slate-600 uppercase">
              <tr>
                <th className="p-3 text-left">ID</th>
                <th className="p-3 text-left">Cliente</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Responsável</th>
                <th className="p-3 text-left">Aprovações</th>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Anexos</th>
                <th className="p-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProtocols.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-12 text-center text-slate-500">
                    <AlertCircle className="mx-auto mb-3 w-14 h-14 text-slate-300" />
                    <div className="text-lg font-semibold">Nenhum protocolo encontrado</div>
                    <div className="text-sm mt-2">Crie um novo protocolo para começar</div>
                  </td>
                </tr>
              ) : (
                filteredProtocols.map(protocol => (
                  <tr key={protocol.id} className="border-t hover:bg-slate-50/50">
                    <td className="p-3 font-mono text-sm font-bold text-blue-600">{protocol.id_protocolo}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{protocol.email_cliente}</div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">{protocol.assunto_original}</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border ${getStatusColor(protocol.status_processo)}`}>
                        {getStatusIcon(protocol.status_processo)}
                        {protocol.status_processo.split('.')[1]?.trim()}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-slate-700">{protocol.responsavel}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${protocol.aprovacao_orcamento === 'APROVADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>Int: {protocol.aprovacao_orcamento}</span>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${protocol.confirmacao_cliente === 'CONFIRMADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>Cli: {protocol.confirmacao_cliente}</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-slate-700">{protocol.data_entrada ? new Date(protocol.data_entrada).toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="p-3">
                      {protocol.attachments && protocol.attachments.length > 0 ? (
                        <button className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs" onClick={() => { setSelectedProtocol(protocol); setShowDetailModal(true); }}>
                          <Paperclip className="w-3 h-3" /> {protocol.attachments.length}
                        </button>
                      ) : <span className="text-xs text-slate-400">-</span>}
                    </td>
                    <td className="p-3 text-sm">
                      <div className="flex gap-2">
                        <button onClick={() => { setSelectedProtocol(protocol); setShowDetailModal(true); }} className="text-blue-600 hover:underline font-semibold">Abrir</button>
                        <button onClick={() => openEditModal(protocol)} className="text-amber-600" title="Editar"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteProtocol(protocol.id)} className="text-red-600" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Protocol Modal */}
      {showNewProtocolModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="text-2xl font-bold">Criar Novo Protocolo</h2>
              <p className="text-sm text-slate-600 mt-1">Preencha os dados do orçamento solicitado</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">E-mail do Cliente *</label>
                  <input type="email" value={newProtocol.email_cliente} onChange={(e) => setNewProtocol({ ...newProtocol, email_cliente: e.target.value })} className="w-full px-4 py-3 border rounded-xl" placeholder="cliente@exemplo.com" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Assunto *</label>
                  <input type="text" value={newProtocol.assunto_original} onChange={(e) => setNewProtocol({ ...newProtocol, assunto_original: e.target.value })} className="w-full px-4 py-3 border rounded-xl" placeholder="Solicitação de orçamento..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Responsável</label>
                  <input type="text" value={newProtocol.responsavel} onChange={(e) => setNewProtocol({ ...newProtocol, responsavel: e.target.value })} className="w-full px-4 py-3 border rounded-xl" placeholder="Nome do responsável" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Detalhes</label>
                  <textarea value={newProtocol.detalhes} onChange={(e) => setNewProtocol({ ...newProtocol, detalhes: e.target.value })} rows="4" className="w-full px-4 py-3 border rounded-xl" placeholder="Informações adicionais..." />
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50">
                <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Paperclip className="w-5 h-5" /> Anexos (Todos os formatos)</label>
                <input type="file" multiple onChange={handleFileUpload} className="w-full text-sm" />
                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="text-sm font-semibold">{att.name}</p>
                            <p className="text-xs text-slate-500">{att.size}</p>
                          </div>
                        </div>
                        <button onClick={() => removeAttachment(att.id)} className="text-red-600"><X className="w-5 h-5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3 bg-slate-50">
              <button onClick={() => { setShowNewProtocolModal(false); setAttachments([]); }} className="px-6 py-3 border rounded-xl">Cancelar</button>
              <button onClick={createNewProtocol} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl">Criar Protocolo</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editProtocol && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b bg-amber-50">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Edit2 className="w-6 h-6" /> Editar Protocolo {editProtocol.id_protocolo}</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">E-mail do Cliente</label>
                  <input type="email" value={editProtocol.email_cliente} onChange={(e) => setEditProtocol({ ...editProtocol, email_cliente: e.target.value })} className="w-full px-4 py-3 border rounded-xl" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Assunto</label>
                  <input type="text" value={editProtocol.assunto_original} onChange={(e) => setEditProtocol({ ...editProtocol, assunto_original: e.target.value })} className="w-full px-4 py-3 border rounded-xl" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Responsável</label>
                  <input type="text" value={editProtocol.responsavel} onChange={(e) => setEditProtocol({ ...editProtocol, responsavel: e.target.value })} className="w-full px-4 py-3 border rounded-xl" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Detalhes</label>
                  <textarea value={editProtocol.detalhes || ''} onChange={(e) => setEditProtocol({ ...editProtocol, detalhes: e.target.value })} rows="4" className="w-full px-4 py-3 border rounded-xl" />
                </div>
              </div>

              <div className="border-2 border-dashed rounded-xl p-4 bg-slate-50">
                <label className="block text-sm font-bold mb-2">Adicionar Anexos</label>
                <input type="file" multiple onChange={handleFileUpload} />
                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between bg-white p-2 rounded border">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-sm">{att.name}</p>
                          </div>
                        </div>
                        <button onClick={() => removeAttachment(att.id)} className="text-red-600"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3 bg-slate-50">
              <button onClick={() => { setShowEditModal(false); setEditProtocol(null); setAttachments([]); }} className="px-6 py-3 border rounded-xl">Cancelar</button>
              <button onClick={saveEditedProtocol} className="px-6 py-3 bg-amber-600 text-white rounded-xl flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedProtocol && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b bg-blue-50 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Protocolo {selectedProtocol.id_protocolo}</h2>
                <p className="text-sm text-slate-600">Gerenciar status e aprovações</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditModal(selectedProtocol)} className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl flex items-center gap-2"><Edit2 className="w-4 h-4" /> Editar</button>
                <button onClick={() => deleteProtocol(selectedProtocol.id)} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl flex items-center gap-2"><Trash2 className="w-4 h-4" /> Excluir</button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500">Cliente</label>
                    <p className="font-semibold">{selectedProtocol.email_cliente}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500">Responsável</label>
                    <p className="font-semibold">{selectedProtocol.responsavel}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500">Data de Entrada</label>
                    <p className="font-semibold">{selectedProtocol.data_entrada ? new Date(selectedProtocol.data_entrada).toLocaleString('pt-BR') : '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500">Última Atualização</label>
                    <p className="font-semibold">{selectedProtocol.data_ultima_atualizacao ? new Date(selectedProtocol.data_ultima_atualizacao).toLocaleString('pt-BR') : '-'}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold">Assunto</label>
                <div className="p-4 bg-slate-50 rounded border">{selectedProtocol.assunto_original}</div>
              </div>

              {selectedProtocol.detalhes && (
                <div>
                  <label className="block text-sm font-bold">Detalhes</label>
                  <div className="p-4 bg-slate-50 rounded border whitespace-pre-wrap">{selectedProtocol.detalhes}</div>
                </div>
              )}

              {selectedProtocol.attachments && selectedProtocol.attachments.length > 0 && (
                <div>
                  <label className="block text-sm font-bold mb-3 flex items-center gap-2"><Paperclip className="w-5 h-5" /> Anexos ({selectedProtocol.attachments.length})</label>
                  <div className="space-y-2">
                    {selectedProtocol.attachments.map(att => (
                      <div key={att.id || att.name} className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl border">
                        <FileText className="w-6 h-6 text-blue-600" />
                        <div className="flex-1">
                          <p className="font-semibold">{att.name}</p>
                          <p className="text-xs text-slate-600">{att.size || ''} • {att.type || ''}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openAttachment(att)} className="px-3 py-1 rounded bg-white border">Abrir</button>
                          {/* Optionally: button to remove single attachment (not implemented here to avoid accidental deletes) */}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border-2">
                <h3 className="text-sm font-bold mb-3">Controle de Processo</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">Status do Processo</label>
                    <select value={selectedProtocol.status_processo} onChange={(e) => updateProtocolStatus(selectedProtocol.id, e.target.value)} className="w-full p-3 border rounded-xl">
                      {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2">Aprovação Interna</label>
                      <select value={selectedProtocol.aprovacao_orcamento} onChange={(e) => updateApprovalStatus(selectedProtocol.id, 'aprovacao_orcamento', e.target.value)} className="w-full p-3 border rounded-xl">
                        <option value="PENDENTE">⏳ PENDENTE</option>
                        <option value="APROVADO">✅ APROVADO</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">Confirmação Cliente</label>
                      <select value={selectedProtocol.confirmacao_cliente} onChange={(e) => updateApprovalStatus(selectedProtocol.id, 'confirmacao_cliente', e.target.value)} className="w-full p-3 border rounded-xl">
                        <option value="PENDENTE">⏳ PENDENTE</option>
                        <option value="CONFIRMADO">✅ CONFIRMADO</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {selectedProtocol.aprovacao_orcamento === 'APROVADO' && selectedProtocol.confirmacao_cliente === 'CONFIRMADO' && (
                <div className="bg-emerald-50 p-4 rounded-xl border-2 border-emerald-300 flex items-start gap-4">
                  <div className="bg-emerald-500 p-3 rounded-xl">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-900">🎉 Aprovação Dupla Confirmada!</p>
                    <p className="text-sm text-emerald-700 mt-1">O sistema mudará automaticamente o status para "Orçamento Aprovado - Iniciar Produção".</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-between bg-slate-50">
              <button onClick={() => openEditModal(selectedProtocol)} className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl flex items-center gap-2"><Edit2 className="w-4 h-4" /> Editar</button>
              <button onClick={() => { setShowDetailModal(false); setSelectedProtocol(null); }} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProtocolManagementSystem;
