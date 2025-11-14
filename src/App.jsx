// src/App.jsx - ENTERPRISE VERSION (NO FIREBASE) - localStorage persistence
import { useEffect, useState } from "react";
import { 
  PlusCircle, Trash2, Edit2, Download, Paperclip, History, Shield, 
  AlertTriangle, CheckCircle2, User, Calendar, FileText, Search, Filter, X, ShieldOff 
} from "lucide-react";
import * as XLSX from "xlsx";

/**
 * Persistência local:
 * - key: 'protocols_v2'
 * - formato: array de objetos protocol (see createNewProtocol)
 *
 * ATTACHMENTS: salvos como base64 dentro do objeto attachment (campo `dataUrl`).
 * Em produção, trocar por upload para servidor e salvar apenas metadata+url.
 */

const STORAGE_KEY = "protocols_v2";

export default function App() {
  // state
  const [protocols, setProtocols] = useState([]);
  const [filteredProtocols, setFilteredProtocols] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [showNewProtocolModal, setShowNewProtocolModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [currentUser, setCurrentUser] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);

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

  // ---------- Utilitários de armazenamento local ----------
  const loadFromStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Erro lendo localStorage:", err);
      return [];
    }
  };

  const saveToStorage = (arr) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      // dispatch storage event manually for same-tab listeners
      window.dispatchEvent(new Event("storage"));
    } catch (err) {
      console.error("Erro salvando localStorage:", err);
      addNotification("Erro ao salvar localmente (ver console)", "error");
    }
  };

  // Sincroniza entre abas/janelas (se usuário abrir em outra aba)
  useEffect(() => {
    const handler = () => {
      setProtocols(loadFromStorage());
    };
    window.addEventListener("storage", handler);
    // initial load
    setProtocols(loadFromStorage());
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Identificação do usuário
  useEffect(() => {
    const savedUser = localStorage.getItem('protocol_system_user');
    if (!savedUser) {
      setShowUserModal(true);
    } else {
      setCurrentUser(savedUser);
    }
  }, []);

  // Filtragem
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

  const addNotification = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  const generateProtocolId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const seq = String(Math.floor(Math.random() * 9000) + 1000);
    return `PT${year}${month}${day}-${seq}`;
  };

  // Auditoria
  const createAuditLog = (protocolId, action, details, user = currentUser) => {
    return {
      timestamp: new Date().toISOString(),
      user: user || 'Sistema',
      action: action,
      details: details,
      ip: 'N/A' // Em produção, capture o IP (backend)
    };
  };

  // ---------- Attachments handling (base64 in localStorage) ----------
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const toRead = files.map(f => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: Date.now() + "_" + Math.random().toString(36).slice(2,9),
          name: f.name,
          size: (f.size / 1024).toFixed(2) + ' KB',
          type: f.type || 'application/octet-stream',
          dataUrl: reader.result,
          uploadedBy: currentUser,
          uploadDate: new Date().toISOString()
        });
      };
      reader.onerror = () => {
        resolve(null);
      };
      reader.readAsDataURL(f);
    }));

    Promise.all(toRead).then(results => {
      const good = results.filter(Boolean);
      if (good.length) {
        setAttachments(prev => [...prev, ...good]);
      }
    });
  };

  const removeAttachment = (id) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Helper to download attachment
  const downloadAttachment = (att) => {
    if (!att || !att.dataUrl) return;
    const a = document.createElement('a');
    a.href = att.dataUrl;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ---------- CRUD local ----------
  const createNewProtocol = async () => {
    if (!currentUser) {
      addNotification('Identifique-se antes de criar um protocolo', 'error');
      setShowUserModal(true);
      return;
    }
    if (!newProtocol.email_cliente || !newProtocol.assunto_original) {
      addNotification('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    const id_protocolo = generateProtocolId();
    const now = new Date().toISOString();

    const auditLog = createAuditLog(id_protocolo, 'CRIAÇÃO', 'Protocolo criado no sistema');

    const base = {
      id: Date.now() + "_" + Math.random().toString(36).slice(2,9),
      id_protocolo,
      data_entrada: now,
      email_cliente: newProtocol.email_cliente,
      assunto_original: newProtocol.assunto_original,
      status_processo: '1. Orçamento Solicitado',
      responsavel: newProtocol.responsavel || 'Não atribuído',
      data_ultima_atualizacao: now,
      detalhes: newProtocol.detalhes || '',
      aprovacao_orcamento: 'PENDENTE',
      aprovacao_orcamento_por: null,
      aprovacao_orcamento_data: null,
      confirmacao_cliente: 'PENDENTE',
      confirmacao_cliente_por: null,
      confirmacao_cliente_data: null,
      criado_por: currentUser,
      attachments: attachments.map(a => ({ ...a })), // copy current attachments
      historico_auditoria: [auditLog]
    };

    // persist
    const all = loadFromStorage();
    all.unshift(base);
    saveToStorage(all);
    setProtocols(all);

    // reset UI
    setShowNewProtocolModal(false);
    setNewProtocol({ email_cliente: '', assunto_original: '', detalhes: '', responsavel: '' });
    setAttachments([]);
    addNotification(`✅ Protocolo ${id_protocolo} criado com sucesso!`);
  };

  const updateProtocolStatus = (protocolIdInternal, newStatus) => {
    if (!currentUser) {
      addNotification('Identifique-se antes de fazer alterações', 'error');
      return;
    }
    const all = loadFromStorage();
    const idx = all.findIndex(x => x.id === protocolIdInternal);
    if (idx === -1) return;
    const p = all[idx];

    const auditLog = createAuditLog(
      p.id_protocolo,
      'MUDANÇA_STATUS',
      `Status alterado de "${p.status_processo}" para "${newStatus}"`
    );

    p.status_processo = newStatus;
    p.data_ultima_atualizacao = new Date().toISOString();
    p.historico_auditoria = [...(p.historico_auditoria || []), auditLog];

    all[idx] = p;
    saveToStorage(all);
    setProtocols(all);

    // atualiza selected se aberto
    if (selectedProtocol && selectedProtocol.id === p.id) setSelectedProtocol({ ...p });
    addNotification('✅ Status atualizado com sucesso!');
  };

  const updateApprovalStatus = (protocolIdInternal, field, value) => {
    if (!currentUser) {
      addNotification('Identifique-se antes de aprovar', 'error');
      return;
    }
    const all = loadFromStorage();
    const idx = all.findIndex(x => x.id === protocolIdInternal);
    if (idx === -1) return;
    const p = all[idx];

    const now = new Date().toISOString();
    const fieldLabel = field === 'aprovacao_orcamento' ? 'Aprovação Interna' : 'Confirmação do Cliente';

    const auditLog = createAuditLog(
      p.id_protocolo,
      field === 'aprovacao_orcamento' ? 'APROVAÇÃO_INTERNA' : 'CONFIRMAÇÃO_CLIENTE',
      `${fieldLabel}: ${value}`
    );

    p[field] = value;
    p[`${field}_por`] = currentUser;
    p[`${field}_data`] = now;
    p.data_ultima_atualizacao = now;
    p.historico_auditoria = [...(p.historico_auditoria || []), auditLog];

    const aprov = p.aprovacao_orcamento;
    const conf = p.confirmacao_cliente;

    if (aprov === 'APROVADO' && conf === 'CONFIRMADO') {
      p.status_processo = '3. Orçamento Aprovado - Iniciar Produção';
      const aprovaLog = createAuditLog(
        p.id_protocolo,
        'APROVAÇÃO_DUPLA',
        'Aprovação dupla confirmada - Produção liberada'
      );
      p.historico_auditoria.push(aprovaLog);
      addNotification('🎉 Aprovação dupla confirmada! Produção iniciada.', 'success');
    }

    all[idx] = p;
    saveToStorage(all);
    setProtocols(all);

    if (selectedProtocol && selectedProtocol.id === p.id) setSelectedProtocol({ ...p });
  };

  const openEditModal = (protocol) => {
    setEditProtocol({ ...protocol });
    setShowEditModal(true);
  };

  const saveEditedProtocol = async () => {
    if (!editProtocol || !currentUser) return;
    const all = loadFromStorage();
    const idx = all.findIndex(p => p.id === editProtocol.id);
    if (idx === -1) return;

    const original = all[idx];
    const changes = [];

    if (original.email_cliente !== editProtocol.email_cliente)
      changes.push(`E-mail: ${original.email_cliente} → ${editProtocol.email_cliente}`);
    if (original.assunto_original !== editProtocol.assunto_original)
      changes.push(`Assunto alterado`);
    if (original.responsavel !== editProtocol.responsavel)
      changes.push(`Responsável: ${original.responsavel} → ${editProtocol.responsavel}`);

    const auditLog = createAuditLog(
      editProtocol.id_protocolo,
      'EDIÇÃO',
      `Campos editados: ${changes.join(', ') || 'Detalhes atualizados'}`
    );

    original.email_cliente = editProtocol.email_cliente;
    original.assunto_original = editProtocol.assunto_original;
    original.responsavel = editProtocol.responsavel;
    original.detalhes = editProtocol.detalhes || '';
    original.data_ultima_atualizacao = new Date().toISOString();
    original.historico_auditoria = [...(original.historico_auditoria || []), auditLog];

    // adicionar novos anexos (attachments state)
    if (attachments.length > 0) {
      const existing = original.attachments || [];
      original.attachments = [...existing, ...attachments.map(a => ({ ...a }))];
    }

    all[idx] = original;
    saveToStorage(all);
    setProtocols(all);

    // reset
    setShowEditModal(false);
    setEditProtocol(null);
    setAttachments([]);
    addNotification('✅ Protocolo editado com sucesso!');
  };

  const deleteProtocol = (docId) => {
    if (!currentUser) {
      addNotification('Identifique-se antes de excluir', 'error');
      return;
    }

    const all = loadFromStorage();
    const p = all.find(x => x.id === docId);
    if (!p) return;

    const confirmMsg = `⚠️ ATENÇÃO: Tem certeza absoluta que deseja EXCLUIR PERMANENTEMENTE o protocolo ${p.id_protocolo}?\n\nEsta ação NÃO PODE ser desfeita!\n\nTodos os dados e anexos serão perdidos.`;
    if (!window.confirm(confirmMsg)) return;

    const filtered = all.filter(x => x.id !== docId);
    saveToStorage(filtered);
    setProtocols(filtered);
    setShowDetailModal(false);
    setSelectedProtocol(null);
    addNotification(`✅ Protocolo ${p.id_protocolo} excluído por ${currentUser}`);
  };

  const openAttachment = (att) => {
    if (!att) return;
    if (att.dataUrl) {
      // abre em nova aba
      const w = window.open();
      w.document.write(`<iframe src="${att.dataUrl}" frameborder="0" style="border:0;top:0;left:0;bottom:0;right:0;width:100%;height:100%;" allowfullscreen></iframe>`);
      w.document.title = att.name;
    } else if (att.url) {
      window.open(att.url, '_blank');
    }
  };

  // ---------- Export XLSX (melhor organizado) ----------
  const exportToXLSX = () => {
    const wb = XLSX.utils.book_new();

    // SHEET 1: Dados Principais
    const headers1 = [
      'ID Protocolo',
      'Data de Entrada',
      'E-mail do Cliente',
      'Assunto',
      'Status do Processo',
      'Responsável',
      'Criado Por',
      'Aprovação Orçamento',
      'Aprovado Por',
      'Data Aprovação',
      'Confirmação Cliente',
      'Confirmado Por',
      'Data Confirmação',
      'Última Atualização',
      'Detalhes',
      'Qtd Anexos'
    ];

    const rows1 = filteredProtocols.map(p => [
      p.id_protocolo || '',
      p.data_entrada ? new Date(p.data_entrada).toLocaleString('pt-BR') : '',
      p.email_cliente || '',
      p.assunto_original || '',
      p.status_processo || '',
      p.responsavel || '',
      p.criado_por || '',
      p.aprovacao_orcamento || '',
      p.aprovacao_orcamento_por || '',
      p.aprovacao_orcamento_data ? new Date(p.aprovacao_orcamento_data).toLocaleString('pt-BR') : '',
      p.confirmacao_cliente || '',
      p.confirmacao_cliente_por || '',
      p.confirmacao_cliente_data ? new Date(p.confirmacao_cliente_data).toLocaleString('pt-BR') : '',
      p.data_ultima_atualizacao ? new Date(p.data_ultima_atualizacao).toLocaleString('pt-BR') : '',
      p.detalhes || '',
      p.attachments ? p.attachments.length : 0
    ]);

    const ws1 = XLSX.utils.aoa_to_sheet([headers1, ...rows1]);

    // Col widths & autofilter
    ws1['!cols'] = [
      { wch: 18 },  { wch: 20 },  { wch: 30 },  { wch: 40 },  { wch: 35 },  { wch: 20 },
      { wch: 20 },  { wch: 15 },  { wch: 20 },  { wch: 20 },  { wch: 15 },  { wch: 20 },
      { wch: 20 },  { wch: 20 },  { wch: 60 },  { wch: 12 }
    ];
    // add autofilter
    ws1['!autofilter'] = { ref: `A1:P1` };

    XLSX.utils.book_append_sheet(wb, ws1, 'Protocolos');

    // SHEET 2: Auditoria
    const auditData = [];
    filteredProtocols.forEach(p => {
      if (p.historico_auditoria && p.historico_auditoria.length > 0) {
        p.historico_auditoria.forEach(log => {
          auditData.push([
            p.id_protocolo,
            new Date(log.timestamp).toLocaleString('pt-BR'),
            log.user,
            log.action,
            log.details
          ]);
        });
      }
    });

    if (auditData.length > 0) {
      const headers2 = ['ID Protocolo', 'Data/Hora', 'Usuário', 'Ação', 'Detalhes'];
      const ws2 = XLSX.utils.aoa_to_sheet([headers2, ...auditData]);
      ws2['!cols'] = [
        { wch: 18 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 80 }
      ];
      ws2['!autofilter'] = { ref: `A1:E1` };
      XLSX.utils.book_append_sheet(wb, ws2, 'Auditoria');
    }

    // SHEET 3: Estatísticas
    const stats = [
      ['Estatística', 'Valor'],
      ['Total de Protocolos', filteredProtocols.length],
      ['Orçamentos Solicitados', filteredProtocols.filter(p => p.status_processo === '1. Orçamento Solicitado').length],
      ['Orçamentos Enviados', filteredProtocols.filter(p => p.status_processo === '2. Orçamento Enviado').length],
      ['Aprovados para Produção', filteredProtocols.filter(p => p.status_processo === '3. Orçamento Aprovado - Iniciar Produção').length],
      ['Entregues', filteredProtocols.filter(p => p.status_processo === '4. Entregue ao Cliente').length],
      ['Aprovações Pendentes', filteredProtocols.filter(p => p.aprovacao_orcamento === 'PENDENTE').length],
      ['Confirmações Cliente Pendentes', filteredProtocols.filter(p => p.confirmacao_cliente === 'PENDENTE').length],
      ['', ''],
      ['Relatório gerado em:', new Date().toLocaleString('pt-BR')],
      ['Gerado por:', currentUser]
    ];

    const ws3 = XLSX.utils.aoa_to_sheet(stats);
    ws3['!cols'] = [{ wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Estatísticas');

    XLSX.writeFile(wb, `PROTOCOLO_EMPRESA_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`);
    addNotification('✅ Relatório Excel exportado com sucesso!');
  };

  // ---------- UI Helpers ----------
  const saveUser = () => {
    if (!currentUser || currentUser.trim() === '') {
      addNotification('Digite seu nome', 'error');
      return;
    }
    localStorage.setItem('protocol_system_user', currentUser);
    setShowUserModal(false);
    addNotification(`✅ Bem-vindo, ${currentUser}!`);
  };

  const changeUser = () => {
    setShowUserModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      '1. Orçamento Solicitado': 'bg-amber-50 text-amber-700 border-amber-300',
      '2. Orçamento Enviado': 'bg-blue-50 text-blue-700 border-blue-300',
      '3. Orçamento Aprovado - Iniciar Produção': 'bg-emerald-50 text-emerald-700 border-emerald-300',
      '4. Entregue ao Cliente': 'bg-slate-50 text-slate-700 border-slate-300'
    };
    return colors[status] || 'bg-gray-50 text-gray-700';
  };

  const getStatusIcon = (status) => {
    const icons = {
      '1. Orçamento Solicitado': '⏳',
      '2. Orçamento Enviado': '📧',
      '3. Orçamento Aprovado - Iniciar Produção': '✅',
      '4. Entregue ao Cliente': '📦'
    };
    return icons[status] || '📋';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {notifications.map(notif => (
          <div
            key={notif.id}
            className={`px-5 py-3 rounded-xl shadow-2xl ${notif.type === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'} text-white animate-slide-in backdrop-blur-sm border border-white/20`}
          >
            <p className="font-semibold">{notif.message}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md shadow-xl border-b-2 border-blue-200/50 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-4 rounded-2xl shadow-xl">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                  SISTEMA EMPRESARIAL DE PROTOCOLO
                </h1>
                <p className="text-sm text-slate-600 mt-1 font-semibold flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Usuário: <span className="text-blue-600">{currentUser || 'Não identificado'}</span>
                  {currentUser && (
                    <button onClick={changeUser} className="text-xs underline ml-2">alterar</button>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowNewProtocolModal(true)} 
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-3 rounded-xl hover:shadow-2xl transition-all font-bold"
              >
                <PlusCircle className="w-5 h-5" /> Novo Protocolo
              </button>
              <button 
                onClick={exportToXLSX} 
                className="flex items-center gap-2 bg-white px-5 py-3 rounded-xl border-2 border-slate-300 hover:shadow-xl transition-all font-bold"
              >
                <Download className="w-5 h-5" /> Exportar Excel
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="mt-4 flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por ID, cliente, assunto..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-slate-300 bg-white/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-6 py-3 rounded-xl border-2 border-slate-300 bg-white/80 font-bold focus:border-blue-500"
            >
              <option value="TODOS">📊 Todos os Status</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {statusOptions.map((status, idx) => {
            const count = protocols.filter(p => p.status_processo === status).length;
            const grads = [
              'from-amber-400 via-orange-500 to-red-500',
              'from-blue-400 via-cyan-500 to-teal-500',
              'from-emerald-400 via-green-500 to-lime-500',
              'from-slate-400 via-gray-500 to-zinc-500'
            ];
            return (
              <div key={status} className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border-2 border-slate-200/50 p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-600 uppercase tracking-wider">{status.split('.')[1]?.trim()}</p>
                    <p className="text-5xl font-black text-slate-900 mt-3">{count}</p>
                  </div>
                  <div className={`p-5 rounded-2xl bg-gradient-to-br ${grads[idx]} text-white shadow-xl text-3xl`}>
                    {getStatusIcon(status)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Table */}
        <div className="mt-6 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border-2 border-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-100 via-blue-50 to-indigo-50 border-b-2 border-blue-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">ID Protocolo</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Responsável</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Aprovações</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Criado Por</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Anexos</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-100">
                {filteredProtocols.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-16 text-center">
                      <AlertTriangle className="mx-auto mb-4 w-20 h-20 text-slate-300" />
                      <p className="text-xl font-bold text-slate-700">Nenhum protocolo encontrado</p>
                      <p className="text-sm text-slate-500 mt-2">Crie um novo protocolo para começar</p>
                    </td>
                  </tr>
                ) : (
                  filteredProtocols.map((protocol) => (
                    <tr key={protocol.id} className="hover:bg-blue-50/50 transition-all">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-black text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg">{protocol.id_protocolo}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-sm text-slate-900">{protocol.email_cliente}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs mt-1">{protocol.assunto_original}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black border-2 ${getStatusColor(protocol.status_processo)} shadow-sm`}>
                          <span className="text-base">{getStatusIcon(protocol.status_processo)}</span>
                          {protocol.status_processo.split('.')[1]?.trim()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-700">{protocol.responsavel}</td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className={`px-3 py-1 rounded-lg text-xs font-black ${protocol.aprovacao_orcamento === 'APROVADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            Int: {protocol.aprovacao_orcamento}
                          </div>
                          <div className={`px-3 py-1 rounded-lg text-xs font-black ${protocol.confirmacao_cliente === 'CONFIRMADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            Cli: {protocol.confirmacao_cliente}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">{protocol.criado_por || '-'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                        {protocol.data_entrada ? new Date(protocol.data_entrada).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {protocol.attachments && protocol.attachments.length > 0 ? (
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-800 text-xs font-black border border-blue-300">
                            <Paperclip className="w-4 h-4" /> {protocol.attachments.length}
                          </span>
                        ) : <span className="text-xs text-slate-400">-</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { setSelectedProtocol(protocol); setShowDetailModal(true); }} 
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold"
                          >
                            Abrir
                          </button>
                          <button 
                            onClick={() => { setSelectedProtocol(protocol); setShowHistoryModal(true); }}
                            className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200" 
                            title="Histórico"
                          >
                            <History className="w-4 h-4 text-slate-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- Modals (User / New / History / Detail / Edit) --- */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border-4 border-blue-500">
            <div className="p-8 text-center">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">IDENTIFICAÇÃO OBRIGATÓRIA</h2>
              <p className="text-sm text-slate-600 mb-6">Por razões de segurança e auditoria, identifique-se antes de usar o sistema.</p>
              
              <input
                type="text"
                value={currentUser}
                onChange={(e) => setCurrentUser(e.target.value)}
                placeholder="Digite seu nome completo"
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl mb-4 font-semibold text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                onKeyPress={(e) => e.key === 'Enter' && saveUser()}
              />
              
              <button
                onClick={saveUser}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:shadow-xl transition-all"
              >
                Confirmar Identidade
              </button>
              
              <p className="text-xs text-slate-500 mt-4">⚠️ Todas as ações serão registradas em seu nome</p>
            </div>
          </div>
        </div>
      )}

      {showNewProtocolModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-blue-300">
            <div className="p-6 border-b-2 border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="text-2xl font-black text-slate-900">📋 CRIAR NOVO PROTOCOLO</h2>
              <p className="text-sm text-slate-600 mt-1 font-semibold">Preencha todos os campos obrigatórios</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="block text-sm font-black text-slate-700 mb-2 flex items-center gap-2">
                    <span className="text-red-500">*</span> E-mail do Cliente
                  </label>
                  <input 
                    type="email" 
                    value={newProtocol.email_cliente} 
                    onChange={(e) => setNewProtocol({ ...newProtocol, email_cliente: e.target.value })} 
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-semibold" 
                    placeholder="cliente@empresa.com" 
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-black text-slate-700 mb-2 flex items-center gap-2">
                    <span className="text-red-500">*</span> Assunto do Orçamento
                  </label>
                  <input 
                    type="text" 
                    value={newProtocol.assunto_original} 
                    onChange={(e) => setNewProtocol({ ...newProtocol, assunto_original: e.target.value })} 
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-semibold" 
                    placeholder="Descreva brevemente o orçamento solicitado" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2">Responsável pelo Atendimento</label>
                  <input 
                    type="text" 
                    value={newProtocol.responsavel} 
                    onChange={(e) => setNewProtocol({ ...newProtocol, responsavel: e.target.value })} 
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-semibold" 
                    placeholder="Nome do responsável" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2">Criado Por</label>
                  <input 
                    type="text" 
                    value={currentUser} 
                    disabled
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-100 font-bold text-slate-600" 
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-black text-slate-700 mb-2">Detalhes e Observações</label>
                  <textarea 
                    value={newProtocol.detalhes} 
                    onChange={(e) => setNewProtocol({ ...newProtocol, detalhes: e.target.value })} 
                    rows="4" 
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-medium" 
                    placeholder="Informações adicionais sobre o orçamento..." 
                  />
                </div>
              </div>

              <div className="border-2 border-dashed border-blue-300 rounded-xl p-6 bg-blue-50">
                <label className="block text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                  <Paperclip className="w-5 h-5" /> Anexar Documentos (Todos os formatos aceitos)
                </label>
                <input 
                  type="file" 
                  multiple 
                  onChange={handleFileUpload} 
                  className="w-full text-sm file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer" 
                />
                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between bg-white p-4 rounded-xl border-2 border-blue-200 shadow-sm">
                        <div className="flex items-center gap-3">
                          <FileText className="w-6 h-6 text-blue-600" />
                          <div>
                            <p className="text-sm font-bold text-slate-900">{att.name}</p>
                            <p className="text-xs text-slate-500">{att.size} • Enviado por: {att.uploadedBy}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => downloadAttachment(att)} className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-lg">
                            Baixar
                          </button>
                          <button onClick={() => removeAttachment(att.id)} className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg">
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t-2 border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button 
                onClick={() => { setShowNewProtocolModal(false); setAttachments([]); setNewProtocol({ email_cliente: '', assunto_original: '', detalhes: '', responsavel: '' }); }} 
                className="px-6 py-3 border-2 border-slate-300 rounded-xl hover:bg-white transition-all font-bold"
              >
                Cancelar
              </button>
              <button 
                onClick={createNewProtocol} 
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-2xl transition-all font-bold flex items-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Criar Protocolo
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && selectedProtocol && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-amber-300">
            <div className="p-6 border-b-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <History className="w-8 h-8 text-amber-600" />
                HISTÓRICO DE AUDITORIA - {selectedProtocol.id_protocolo}
              </h2>
              <p className="text-sm text-slate-600 mt-1 font-semibold">Registro completo de todas as ações realizadas</p>
            </div>
            <div className="p-6">
              {selectedProtocol.historico_auditoria && selectedProtocol.historico_auditoria.length > 0 ? (
                <div className="space-y-4">
                  {selectedProtocol.historico_auditoria.map((log, idx) => (
                    <div key={idx} className="border-l-4 border-blue-500 bg-slate-50 p-4 rounded-r-xl shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-black uppercase">{log.action}</span>
                            <span className="text-xs font-bold text-slate-500">
                              <Calendar className="w-3 h-3 inline mr-1" />
                              {new Date(log.timestamp).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-700 mb-2">{log.details}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <User className="w-3 h-3" />
                            <span className="font-bold">Por: {log.user}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-semibold">Nenhum registro de auditoria encontrado</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t-2 border-slate-200 flex justify-end bg-slate-50">
              <button 
                onClick={() => { setShowHistoryModal(false); setSelectedProtocol(null); }} 
                className="px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-xl font-bold hover:shadow-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedProtocol && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border-2 border-blue-300">
            <div className="p-6 border-b-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black text-slate-900">PROTOCOLO: {selectedProtocol.id_protocolo}</h2>
                <p className="text-sm text-slate-600 font-semibold mt-1">Gerenciamento completo do protocolo</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setShowHistoryModal(true); }} 
                  className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl font-bold hover:bg-amber-200 flex items-center gap-2 border-2 border-amber-300"
                >
                  <History className="w-4 h-4" /> Histórico
                </button>
                <button 
                  onClick={() => openEditModal(selectedProtocol)} 
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-bold hover:bg-blue-200 flex items-center gap-2 border-2 border-blue-300"
                >
                  <Edit2 className="w-4 h-4" /> Editar
                </button>
                <button 
                  onClick={() => deleteProtocol(selectedProtocol.id)} 
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-xl font-bold hover:bg-red-200 flex items-center gap-2 border-2 border-red-300"
                >
                  <Trash2 className="w-4 h-4" /> Excluir
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border-2 border-blue-200">
                  <label className="block text-xs font-black text-slate-600 uppercase mb-2">Cliente</label>
                  <p className="text-lg font-black text-slate-900">{selectedProtocol.email_cliente}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-5 rounded-xl border-2 border-emerald-200">
                  <label className="block text-xs font-black text-slate-600 uppercase mb-2">Responsável</label>
                  <p className="text-lg font-black text-slate-900">{selectedProtocol.responsavel}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-xl border-2 border-amber-200">
                  <label className="block text-xs font-black text-slate-600 uppercase mb-2">Criado Por</label>
                  <p className="text-lg font-black text-slate-900">{selectedProtocol.criado_por || 'N/A'}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-xl border-2 border-purple-200">
                  <label className="block text-xs font-black text-slate-600 uppercase mb-2">Data de Criação</label>
                  <p className="text-lg font-black text-slate-900">
                    {selectedProtocol.data_entrada ? new Date(selectedProtocol.data_entrada).toLocaleString('pt-BR') : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Assunto e Detalhes */}
              <div className="bg-slate-50 p-5 rounded-xl border-2 border-slate-200">
                <label className="block text-sm font-black text-slate-700 mb-3">ASSUNTO</label>
                <p className="text-sm font-semibold text-slate-900">{selectedProtocol.assunto_original}</p>
              </div>

              {selectedProtocol.detalhes && (
                <div className="bg-slate-50 p-5 rounded-xl border-2 border-slate-200">
                  <label className="block text-sm font-black text-slate-700 mb-3">DETALHES E OBSERVAÇÕES</label>
                  <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{selectedProtocol.detalhes}</p>
                </div>
              )}

              {/* Attachments */}
              {selectedProtocol.attachments && selectedProtocol.attachments.length > 0 && (
                <div className="bg-blue-50 p-5 rounded-xl border-2 border-blue-200">
                  <label className="block text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                    <Paperclip className="w-5 h-5" /> ANEXOS ({selectedProtocol.attachments.length})
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedProtocol.attachments.map(att => (
                      <div key={att.id || att.name} className="flex items-center gap-3 bg-white p-4 rounded-xl border-2 border-blue-300 shadow-sm hover:shadow-md transition-all">
                        <FileText className="w-8 h-8 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{att.name}</p>
                          <p className="text-xs text-slate-600">{att.size}</p>
                          {att.uploadedBy && (
                            <p className="text-xs text-slate-500">Por: {att.uploadedBy}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => openAttachment(att)} 
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex-shrink-0"
                          >
                            Abrir
                          </button>
                          <button 
                            onClick={() => downloadAttachment(att)} 
                            className="px-3 py-2 bg-white text-blue-600 rounded-lg text-xs font-bold border border-blue-200"
                          >
                            Baixar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status & Approvals */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border-2 border-indigo-300">
                <h3 className="text-lg font-black text-slate-900 mb-5 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-indigo-600" />
                  CONTROLE DE PROCESSO E APROVAÇÕES
                </h3>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-3">Status do Processo</label>
                    <select 
                      value={selectedProtocol.status_processo} 
                      onChange={(e) => updateProtocolStatus(selectedProtocol.id, e.target.value)} 
                      className="w-full px-4 py-4 border-2 border-indigo-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 font-bold text-base bg-white"
                    >
                      {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-3">Aprovação Interna (Orçamento)</label>
                      <select 
                        value={selectedProtocol.aprovacao_orcamento} 
                        onChange={(e) => updateApprovalStatus(selectedProtocol.id, 'aprovacao_orcamento', e.target.value)} 
                        className="w-full px-4 py-4 border-2 border-emerald-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 font-bold text-base bg-white"
                      >
                        <option value="PENDENTE">⏳ PENDENTE</option>
                        <option value="APROVADO">✅ APROVADO</option>
                      </select>
                      {selectedProtocol.aprovacao_orcamento === 'APROVADO' && selectedProtocol.aprovacao_orcamento_por && (
                        <p className="text-xs text-emerald-700 font-bold mt-2">
                          ✅ Aprovado por: {selectedProtocol.aprovacao_orcamento_por} em {new Date(selectedProtocol.aprovacao_orcamento_data).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-3">Confirmação do Cliente</label>
                      <select 
                        value={selectedProtocol.confirmacao_cliente} 
                        onChange={(e) => updateApprovalStatus(selectedProtocol.id, 'confirmacao_cliente', e.target.value)} 
                        className="w-full px-4 py-4 border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-bold text-base bg-white"
                      >
                        <option value="PENDENTE">⏳ PENDENTE</option>
                        <option value="CONFIRMADO">✅ CONFIRMADO</option>
                      </select>
                      {selectedProtocol.confirmacao_cliente === 'CONFIRMADO' && selectedProtocol.confirmacao_cliente_por && (
                        <p className="text-xs text-blue-700 font-bold mt-2">
                          ✅ Confirmado por: {selectedProtocol.confirmacao_cliente_por} em {new Date(selectedProtocol.confirmacao_cliente_data).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-6 border-t-2 border-slate-200 flex justify-end bg-slate-50">
              <button 
                onClick={() => { setShowDetailModal(false); setSelectedProtocol(null); }} 
                className="px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-xl font-bold hover:shadow-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editProtocol && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-blue-300">
            <div className="p-6 border-b-2 border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="text-2xl font-black text-slate-900">✏️ EDITAR PROTOCOLO - {editProtocol.id_protocolo}</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="block text-sm font-black text-slate-700 mb-2">E-mail do Cliente</label>
                  <input 
                    type="email" 
                    value={editProtocol.email_cliente} 
                    onChange={(e) => setEditProtocol({ ...editProtocol, email_cliente: e.target.value })} 
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-semibold" 
                    placeholder="cliente@empresa.com" 
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-black text-slate-700 mb-2">Assunto do Orçamento</label>
                  <input 
                    type="text" 
                    value={editProtocol.assunto_original} 
                    onChange={(e) => setEditProtocol({ ...editProtocol, assunto_original: e.target.value })} 
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-semibold" 
                    placeholder="Assunto" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2">Responsável</label>
                  <input 
                    type="text" 
                    value={editProtocol.responsavel} 
                    onChange={(e) => setEditProtocol({ ...editProtocol, responsavel: e.target.value })} 
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2">Criado Por</label>
                  <input 
                    type="text" 
                    value={editProtocol.criado_por} 
                    disabled
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-100 font-bold text-slate-600" 
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-black text-slate-700 mb-2">Detalhes</label>
                  <textarea 
                    value={editProtocol.detalhes} 
                    onChange={(e) => setEditProtocol({ ...editProtocol, detalhes: e.target.value })} 
                    rows="4" 
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-medium" 
                  />
                </div>
              </div>

              <div className="border-2 border-dashed border-blue-300 rounded-xl p-6 bg-blue-50">
                <label className="block text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                  <Paperclip className="w-5 h-5" /> Adicionar Anexos
                </label>
                <input type="file" multiple onChange={handleFileUpload} className="w-full text-sm file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer" />
                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between bg-white p-4 rounded-xl border-2 border-blue-200 shadow-sm">
                        <div className="flex items-center gap-3">
                          <FileText className="w-6 h-6 text-blue-600" />
                          <div>
                            <p className="text-sm font-bold text-slate-900">{att.name}</p>
                            <p className="text-xs text-slate-500">{att.size} • Enviado por: {att.uploadedBy}</p>
                          </div>
                        </div>
                        <button onClick={() => removeAttachment(att.id)} className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t-2 border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button onClick={() => { setShowEditModal(false); setEditProtocol(null); setAttachments([]); }} className="px-6 py-3 border-2 border-slate-300 rounded-xl hover:bg-white transition-all font-bold">Cancelar</button>
              <button onClick={saveEditedProtocol} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-2xl transition-all font-bold">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Para migrar para backend real:
 * - Substituir loadFromStorage/saveToStorage pelas chamadas à API.
 * - Endpoints sugeridos:
 *   GET /api/protocols -> lista
 *   POST /api/protocols -> cria
 *   PUT /api/protocols/:id -> atualiza
 *   DELETE /api/protocols/:id -> remove
 *   POST /api/protocols/:id/attachments -> upload (retorna URL)
 * - No backend: gravar auditoria numa tabela separada (historico_auditoria),
 *   controlar usuário autenticado, guardar IP real, e armazenar arquivos em disco/obj storage.
 *
 * Testes recomendados:
 * - Criar protocolo com anexos > 2MB para verificar limitação do localStorage.
 * - Testar sincronização entre abas.
 *
 * Se quiser, eu adapto esse componente para usar seu backend Node.js + MySQL (me envie as rotas / convenções).
 */
